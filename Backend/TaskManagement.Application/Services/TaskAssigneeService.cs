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
    private readonly IApplicationDbContext _dbContext;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public TaskAssigneeService(
        IApplicationDbContext dbContext,
        IPermissionService permissionService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
        _permissionService = permissionService;
        _activityLogService = activityLogService;
        _notificationService = notificationService;
    }

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

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskView);

        var assignees = await _dbContext.TaskAssignees
            .AsNoTracking()
            .Include(taskAssignee =>
                taskAssignee.User)
            .Where(taskAssignee =>
                taskAssignee.TaskItemId == taskId &&
                !taskAssignee.IsDeleted)
            .OrderBy(taskAssignee =>
                taskAssignee.CreatedAt)
            .ToListAsync();

        return assignees
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<TaskAssigneeResponse> AssignUserAsync(
        int workspaceId,
        int projectId,
        int taskId,
        AssignTaskRequest request)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskAssign);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Users cannot be assigned to tasks in an archived project.");
        }

        var task = await GetTaskAsync(
            projectId,
            taskId);

        var workspaceMember =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == request.UserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (workspaceMember is null)
        {
            throw new NotFoundException(
                "The selected user is not an active member of this workspace.");
        }

        if (!workspaceMember.User.IsActive ||
            workspaceMember.User.IsDeleted)
        {
            throw new ConflictException(
                "The selected user account is inactive or deleted.");
        }

        var existingAssignment =
            await _dbContext.TaskAssignees
                .Include(taskAssignee =>
                    taskAssignee.User)
                .FirstOrDefaultAsync(taskAssignee =>
                    taskAssignee.TaskItemId == taskId &&
                    taskAssignee.UserId == request.UserId);

        if (existingAssignment is not null &&
            !existingAssignment.IsDeleted)
        {
            throw new ConflictException(
                "The selected user is already assigned to this task.");
        }

        var now = DateTime.UtcNow;

        TaskAssignee taskAssignee;

        if (existingAssignment is not null)
        {
            existingAssignment.IsDeleted = false;
            existingAssignment.DeletedAt = null;
            existingAssignment.UpdatedAt = now;

            taskAssignee = existingAssignment;
        }
        else
        {
            taskAssignee = new TaskAssignee
            {
                TaskItemId = taskId,
                UserId = request.UserId,
                CreatedAt = now,
                User = workspaceMember.User
            };

            _dbContext.TaskAssignees.Add(
                taskAssignee);
        }

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.assignee_added",
            nameof(TaskAssignee),
            taskAssignee.Id,
            $"Assigned user {taskAssignee.User.FullName} to task {task.Title}.");

        var notificationRecipientUserIds =
            new HashSet<int>
            {
                request.UserId
            };

        if (project.ManagerUserId.HasValue)
        {
            notificationRecipientUserIds.Add(
                project.ManagerUserId.Value);
        }

        await _notificationService.CreateManyAsync(
            notificationRecipientUserIds,
            workspaceId,
            "Task assignee added",
            $"User \"{taskAssignee.User.FullName}\" was assigned to task \"{task.Title}\".",
            "task.assigned",
            nameof(TaskItem),
            task.Id);

        return MapToResponse(
            taskAssignee);
    }

    public async Task RemoveAssigneeAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int userId)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskAssign);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Task assignments cannot be changed in an archived project.");
        }

        var task = await GetTaskAsync(
            projectId,
            taskId);

        var taskAssignee =
            await _dbContext.TaskAssignees
                .Include(assignment =>
                    assignment.User)
                .FirstOrDefaultAsync(assignment =>
                    assignment.TaskItemId == taskId &&
                    assignment.UserId == userId &&
                    !assignment.IsDeleted);

        if (taskAssignee is null)
        {
            throw new NotFoundException(
                "Task assignment not found.");
        }

        var now = DateTime.UtcNow;

        taskAssignee.IsDeleted = true;
        taskAssignee.DeletedAt = now;
        taskAssignee.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.assignee_removed",
            nameof(TaskAssignee),
            taskAssignee.Id,
            $"Removed user {taskAssignee.User.FullName} from task {task.Title}.");

        var notificationRecipientUserIds =
            new HashSet<int>
            {
                userId
            };

        if (project.ManagerUserId.HasValue)
        {
            notificationRecipientUserIds.Add(
                project.ManagerUserId.Value);
        }

        await _notificationService.CreateManyAsync(
            notificationRecipientUserIds,
            workspaceId,
            "Task assignee removed",
            $"User \"{taskAssignee.User.FullName}\" was removed from task \"{task.Title}\".",
            "task.unassigned",
            nameof(TaskItem),
            task.Id);
    }

    private async Task<Project> GetProjectAsync(
        int workspaceId,
        int projectId)
    {
        var project =
            await _dbContext.Projects
                .FirstOrDefaultAsync(project =>
                    project.Id == projectId &&
                    project.WorkspaceId == workspaceId &&
                    !project.IsDeleted);

        if (project is null)
        {
            throw new NotFoundException(
                "Project not found.");
        }

        return project;
    }

    private async Task<TaskItem> GetTaskAsync(
        int projectId,
        int taskId)
    {
        var task =
            await _dbContext.TaskItems
                .FirstOrDefaultAsync(task =>
                    task.Id == taskId &&
                    task.ProjectId == projectId &&
                    !task.IsDeleted);

        if (task is null)
        {
            throw new NotFoundException(
                "Task not found.");
        }

        return task;
    }

    private async Task EnsureTaskExistsAsync(
        int workspaceId,
        int projectId,
        int taskId)
    {
        var projectExists =
            await _dbContext.Projects.AnyAsync(project =>
                project.Id == projectId &&
                project.WorkspaceId == workspaceId &&
                !project.IsDeleted);

        if (!projectExists)
        {
            throw new NotFoundException(
                "Project not found.");
        }

        var taskExists =
            await _dbContext.TaskItems.AnyAsync(task =>
                task.Id == taskId &&
                task.ProjectId == projectId &&
                !task.IsDeleted);

        if (!taskExists)
        {
            throw new NotFoundException(
                "Task not found.");
        }
    }

    private static TaskAssigneeResponse MapToResponse(
        TaskAssignee taskAssignee)
    {
        return new TaskAssigneeResponse
        {
            Id = taskAssignee.Id,
            TaskItemId = taskAssignee.TaskItemId,
            UserId = taskAssignee.UserId,
            UserFullName =
                taskAssignee.User.FullName,
            AssignedAt =
                taskAssignee.UpdatedAt ??
                taskAssignee.CreatedAt
        };
    }
}