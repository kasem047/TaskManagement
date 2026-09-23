using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.TaskAssignees;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class TaskAssigneeService
    : ITaskAssigneeService
{
    private readonly IApplicationDbContext
        _dbContext;

    private readonly IPermissionService
        _permissionService;

    private readonly IActivityLogService
        _activityLogService;

    private readonly INotificationService
        _notificationService;


    public TaskAssigneeService(
        IApplicationDbContext dbContext,
        IPermissionService permissionService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext =
            dbContext;

        _permissionService =
            permissionService;

        _activityLogService =
            activityLogService;

        _notificationService =
            notificationService;
    }


    /* =========================================================
       GET
       ========================================================= */

    public async Task<List<TaskAssigneeResponse>>
        GetTaskAssigneesAsync(
            int workspaceId,
            int projectId,
            int taskId)
    {
        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskView);


        var activeAssignments =
            await _dbContext
                .TaskAssignees
                .Include(assignment =>
                    assignment.User)
                .Where(assignment =>
                    assignment.TaskItemId ==
                        taskId &&
                    !assignment.IsDeleted)
                .OrderByDescending(
                    assignment =>
                        assignment.UpdatedAt ??
                        assignment.CreatedAt)
                .ThenByDescending(
                    assignment =>
                        assignment.Id)
                .ToListAsync();


        /*
         * إصلاح تلقائي للبيانات القديمة التي
         * نتج عنها أكثر من مسؤول لنفس المهمة.
         *
         * نحتفظ بأحدث إسناد فقط.
         */
        if (
            activeAssignments.Count >
            1)
        {
            var now =
                DateTime.UtcNow;


            foreach (
                var invalidAssignment
                in activeAssignments.Skip(1))
            {
                invalidAssignment.IsDeleted =
                    true;

                invalidAssignment.DeletedAt =
                    now;

                invalidAssignment.UpdatedAt =
                    now;
            }


            await _dbContext
                .SaveChangesAsync();


            activeAssignments =
                activeAssignments
                    .Take(1)
                    .ToList();
        }


        return activeAssignments
            .Select(
                MapToResponse)
            .ToList();
    }


    /* =========================================================
       ASSIGNABLE MEMBERS
       ========================================================= */

    public async Task<List<AssignableMemberResponse>>
        GetAssignableMembersAsync(
            int workspaceId,
            int projectId)
    {
        await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskAssign);

        await EnsureWorkspaceOwnerCannotAssignAsync(
            workspaceId);

        var projectMemberUserIds =
            await GetProjectMemberUserIdsAsync(
                projectId);

        var workspaceMembers =
            await _dbContext
                .WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .Where(member =>
                    member.WorkspaceId ==
                        workspaceId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted)
                .OrderBy(member =>
                    member.User.FullName)
                .ToListAsync();

        return workspaceMembers
            .Where(member =>
                IsAssignableMember(
                    member,
                    projectMemberUserIds))
            .Select(member =>
                new AssignableMemberResponse
                {
                    UserId =
                        member.UserId,
                    FullName =
                        member.User.FullName,
                    Email =
                        member.User.Email ??
                        string.Empty,
                    RoleName =
                        member.Role?.Name ??
                        SystemRoles.Member
                })
            .ToList();
    }


    /* =========================================================
       ASSIGN / REASSIGN
       ========================================================= */

    public async Task<TaskAssigneeResponse>
        AssignUserAsync(
            int workspaceId,
            int projectId,
            int taskId,
            AssignTaskRequest request)
    {
        var project =
            await GetProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskAssign);

        await EnsureWorkspaceOwnerCannotAssignAsync(
            workspaceId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Users cannot be assigned to tasks in an archived project.");
        }


        var task =
            await GetTaskAsync(
                projectId,
                taskId);


        var workspaceMember =
            await _dbContext
                .WorkspaceMembers
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(
                    member =>
                        member.WorkspaceId ==
                            workspaceId &&
                        member.UserId ==
                            request.UserId &&
                        member.Status ==
                            WorkspaceMemberStatus.Active &&
                        !member.IsDeleted);


        if (workspaceMember is null)
        {
            throw new NotFoundException(
                "The selected user is not an active member of this workspace.");
        }


        if (
            !workspaceMember.User.IsActive ||
            workspaceMember.User.IsDeleted)
        {
            throw new ConflictException(
                "The selected user account is inactive or deleted.");
        }


        if (
            workspaceMember.Role?.Name ==
                SystemRoles.WorkspaceOwner ||
            workspaceMember.Role?.Name ==
                "Owner")
        {
            throw new BadRequestException(
                "Workspace owner cannot be assigned to a task.");
        }


        var projectMemberUserIds =
            await GetProjectMemberUserIdsAsync(
                projectId);

        var isProjectMember =
            projectMemberUserIds.Contains(
                request.UserId);


        if (
            !IsAssignableMember(
                workspaceMember,
                projectMemberUserIds))
        {
            throw new BadRequestException(
                "The selected user must be a member of this project or a workspace member with the Member role.");
        }


        var projectMembership =
            await _dbContext
                .ProjectMembers
                .FirstOrDefaultAsync(member =>
                    member.ProjectId == projectId &&
                    member.UserId == request.UserId);


        var now =
            DateTime.UtcNow;


        if (!isProjectMember)
        {
            if (projectMembership is null)
            {
                _dbContext.ProjectMembers.Add(
                    new ProjectMember
                    {
                        ProjectId = projectId,
                        UserId = request.UserId,
                        CreatedAt = now
                    });
            }
            else
            {
                projectMembership.IsDeleted = false;
                projectMembership.DeletedAt = null;
                projectMembership.UpdatedAt = now;
            }
        }


        var allAssignments =
            await _dbContext
                .TaskAssignees
                .Include(assignment =>
                    assignment.User)
                .Where(assignment =>
                    assignment.TaskItemId ==
                        taskId)
                .ToListAsync();


        var currentActiveAssignments =
            allAssignments
                .Where(assignment =>
                    !assignment.IsDeleted)
                .ToList();


        /*
         * إذا هو أصلًا المسؤول الوحيد،
         * لا نكرر الإسناد.
         */
        if (
            currentActiveAssignments.Count ==
                1 &&
            currentActiveAssignments[0]
                .UserId ==
                request.UserId)
        {
            return MapToResponse(
                currentActiveAssignments[0]);
        }


        var previousAssigneeUserIds =
            currentActiveAssignments
                .Where(assignment =>
                    assignment.UserId !=
                        request.UserId)
                .Select(assignment =>
                    assignment.UserId)
                .ToHashSet();


        /*
         * إلغاء أي إسناد حالي.
         *
         * هكذا المهمة لا يمكن أن يكون
         * لها أكثر من مسؤول.
         */
        foreach (
            var activeAssignment
            in currentActiveAssignments)
        {
            if (
                activeAssignment.UserId ==
                request.UserId)
            {
                continue;
            }


            activeAssignment.IsDeleted =
                true;

            activeAssignment.DeletedAt =
                now;

            activeAssignment.UpdatedAt =
                now;
        }


        var targetAssignment =
            allAssignments
                .FirstOrDefault(
                    assignment =>
                        assignment.UserId ==
                        request.UserId);


        if (targetAssignment is null)
        {
            targetAssignment =
                new TaskAssignee
                {
                    TaskItemId =
                        taskId,

                    UserId =
                        request.UserId,

                    CreatedAt =
                        now,

                    User =
                        workspaceMember.User
                };


            _dbContext
                .TaskAssignees
                .Add(
                    targetAssignment);
        }
        else
        {
            targetAssignment.IsDeleted =
                false;

            targetAssignment.DeletedAt =
                null;

            targetAssignment.UpdatedAt =
                now;

            targetAssignment.User =
                workspaceMember.User;
        }


        await _dbContext
            .SaveChangesAsync();


        var previousNames =
            currentActiveAssignments
                .Where(assignment =>
                    assignment.UserId !=
                        request.UserId)
                .Select(assignment =>
                    assignment.User.FullName)
                .Distinct()
                .ToList();


        var logDescription =
            previousNames.Count == 0

                ? $"Assigned user {workspaceMember.User.FullName} to task {task.Title}."

                : $"Changed task assignee from {string.Join(", ", previousNames)} to {workspaceMember.User.FullName} for task {task.Title}.";


        await _activityLogService
            .LogAsync(
                workspaceId,
                previousNames.Count == 0
                    ? "task.assignee_added"
                    : "task.assignee_changed",
                nameof(TaskAssignee),
                targetAssignment.Id,
                logDescription);


        var recipients =
            previousAssigneeUserIds;


        recipients.Add(
            request.UserId);


        if (
            project.ManagerUserId
                .HasValue)
        {
            recipients.Add(
                project.ManagerUserId
                    .Value);
        }


        await _notificationService
            .CreateManyAsync(
                recipients,
                workspaceId,
                previousNames.Count == 0
                    ? "تم إسناد مهمة إليك"
                    : "تغيّر إسناد مهمة",
                $"أصبحت المهمة \"{task.Title}\" مسندة إلى \"{workspaceMember.User.FullName}\".",
                previousNames.Count == 0
                    ? "task.assigned"
                    : "task.assignee_changed",
                nameof(TaskItem),
                task.Id);


        return MapToResponse(
            targetAssignment);
    }


    /* =========================================================
       REMOVE
       ========================================================= */

    public async Task RemoveAssigneeAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int userId)
    {
        var project =
            await GetProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskAssign);

        await EnsureWorkspaceOwnerCannotAssignAsync(
            workspaceId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Task assignments cannot be changed in an archived project.");
        }


        var task =
            await GetTaskAsync(
                projectId,
                taskId);


        var activeAssignments =
            await _dbContext
                .TaskAssignees
                .Include(assignment =>
                    assignment.User)
                .Where(assignment =>
                    assignment.TaskItemId ==
                        taskId &&
                    !assignment.IsDeleted)
                .ToListAsync();


        var taskAssignee =
            activeAssignments
                .FirstOrDefault(
                    assignment =>
                        assignment.UserId ==
                        userId);


        if (taskAssignee is null)
        {
            throw new NotFoundException(
                "Task assignment not found.");
        }


        var now =
            DateTime.UtcNow;


        /*
         * بما أن النظام أصبح Single Assignee،
         * ننظف أي Legacy Assignments أيضًا.
         */
        foreach (
            var assignment
            in activeAssignments)
        {
            assignment.IsDeleted =
                true;

            assignment.DeletedAt =
                now;

            assignment.UpdatedAt =
                now;
        }


        await _dbContext
            .SaveChangesAsync();


        await _activityLogService
            .LogAsync(
                workspaceId,
                "task.assignee_removed",
                nameof(TaskAssignee),
                taskAssignee.Id,
                $"Removed user {taskAssignee.User.FullName} from task {task.Title}.");


        var recipients =
            activeAssignments
                .Select(assignment =>
                    assignment.UserId)
                .ToHashSet();


        if (
            project.ManagerUserId
                .HasValue)
        {
            recipients.Add(
                project.ManagerUserId
                    .Value);
        }


        await _notificationService
            .CreateManyAsync(
                recipients,
                workspaceId,
                "أُلغي إسناد مهمة",
                $"لم تعد المهمة \"{task.Title}\" مسندة لأي عضو.",
                "task.unassigned",
                nameof(TaskItem),
                task.Id);
    }


    /* =========================================================
       HELPERS
       ========================================================= */

    private async Task<Project>
        GetProjectAsync(
            int workspaceId,
            int projectId)
    {
        var project =
            await _dbContext
                .Projects
                .FirstOrDefaultAsync(
                    project =>
                        project.Id ==
                            projectId &&
                        project.WorkspaceId ==
                            workspaceId &&
                        !project.IsDeleted);


        if (project is null)
        {
            throw new NotFoundException(
                "Project not found.");
        }


        return project;
    }


    private async Task<TaskItem>
        GetTaskAsync(
            int projectId,
            int taskId)
    {
        var task =
            await _dbContext
                .TaskItems
                .FirstOrDefaultAsync(
                    task =>
                        task.Id ==
                            taskId &&
                        task.ProjectId ==
                            projectId &&
                        !task.IsDeleted);


        if (task is null)
        {
            throw new NotFoundException(
                "Task not found.");
        }


        return task;
    }


    private async Task
        EnsureTaskExistsAsync(
            int workspaceId,
            int projectId,
            int taskId)
    {
        var projectExists =
            await _dbContext
                .Projects
                .AnyAsync(
                    project =>
                        project.Id ==
                            projectId &&
                        project.WorkspaceId ==
                            workspaceId &&
                        !project.IsDeleted);


        if (!projectExists)
        {
            throw new NotFoundException(
                "Project not found.");
        }


        var taskExists =
            await _dbContext
                .TaskItems
                .AnyAsync(
                    task =>
                        task.Id ==
                            taskId &&
                        task.ProjectId ==
                            projectId &&
                        !task.IsDeleted);


        if (!taskExists)
        {
            throw new NotFoundException(
                "Task not found.");
        }
    }


    private async Task EnsureWorkspaceOwnerCannotAssignAsync(
        int workspaceId)
    {
        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        if (roleName == SystemRoles.WorkspaceOwner ||
            roleName == "Owner")
        {
            throw new ForbiddenException(
                "Workspace owners cannot assign tasks.");
        }

        if (roleName == SystemRoles.Member)
        {
            throw new ForbiddenException(
                "Members cannot assign or change task assignees.");
        }
    }


    private async Task<HashSet<int>>
        GetProjectMemberUserIdsAsync(
            int projectId)
    {
        var userIds =
            await _dbContext
                .ProjectMembers
                .AsNoTracking()
                .Where(member =>
                    member.ProjectId ==
                        projectId &&
                    !member.IsDeleted)
                .Select(member =>
                    member.UserId)
                .ToListAsync();

        return userIds.ToHashSet();
    }


    private static bool IsAssignableMember(
        WorkspaceMember member,
        HashSet<int> projectMemberUserIds)
    {
        var roleName =
            member.Role?.Name;

        if (
            roleName ==
                SystemRoles.WorkspaceOwner ||
            roleName ==
                "Owner")
        {
            return false;
        }

        if (
            !member.User.IsActive ||
            member.User.IsDeleted)
        {
            return false;
        }

        if (projectMemberUserIds.Contains(member.UserId))
        {
            return true;
        }

        return roleName ==
            SystemRoles.Member;
    }


    private static TaskAssigneeResponse
        MapToResponse(
            TaskAssignee taskAssignee)
    {
        return new TaskAssigneeResponse
        {
            Id =
                taskAssignee.Id,

            TaskItemId =
                taskAssignee.TaskItemId,

            UserId =
                taskAssignee.UserId,

            UserFullName =
                taskAssignee.User.FullName,

            AssignedAt =
                taskAssignee.UpdatedAt ??
                taskAssignee.CreatedAt
        };
    }
}