using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.ActivityLogs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Application.Services;

public sealed class ActivityLogService
    : IActivityLogService
{
    private readonly IApplicationDbContext _dbContext;

    private readonly ICurrentUserService
        _currentUserService;

    private readonly IPermissionService
        _permissionService;


    public ActivityLogService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService)
    {
        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;

        _permissionService =
            permissionService;
    }


    /* =========================================================
       WORKSPACE ACTIVITY LOG
       ========================================================= */

    public async Task<List<ActivityLogResponse>>
        GetWorkspaceActivityLogsAsync(
            int workspaceId)
    {
        await EnsureWorkspaceExistsAsync(
            workspaceId);

        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        if (string.IsNullOrWhiteSpace(roleName))
        {
            throw new ForbiddenException(
                "You do not have permission to perform this action.");
        }

        var userId =
            _currentUserService.UserId;

        var activityLogsQuery =
            _dbContext.ActivityLogs
                .AsNoTracking()
                .Include(activityLog =>
                    activityLog.User)
                .Where(activityLog =>
                    activityLog.WorkspaceId ==
                        workspaceId &&
                    !activityLog.IsDeleted);

        if (roleName == SystemRoles.ProjectManager)
        {
            var projectIds =
                await _dbContext.Projects
                    .AsNoTracking()
                    .Where(project =>
                        project.WorkspaceId == workspaceId &&
                        !project.IsDeleted &&
                        (
                            project.ManagerUserId == userId ||
                            project.Members.Any(member =>
                                member.UserId == userId &&
                                !member.IsDeleted)
                        ))
                    .Select(project =>
                        project.Id)
                    .ToListAsync();

            var taskIds =
                await _dbContext.TaskItems
                    .AsNoTracking()
                    .Where(task =>
                        projectIds.Contains(task.ProjectId))
                    .Select(task =>
                        task.Id)
                    .ToListAsync();

            var assigneeIds =
                await _dbContext.TaskAssignees
                    .AsNoTracking()
                    .Where(assignment =>
                        taskIds.Contains(assignment.TaskItemId))
                    .Select(assignment =>
                        assignment.Id)
                    .ToListAsync();

            var commentIds =
                await _dbContext.TaskComments
                    .AsNoTracking()
                    .Where(comment =>
                        taskIds.Contains(comment.TaskItemId))
                    .Select(comment =>
                        comment.Id)
                    .ToListAsync();

            var attachmentIds =
                await _dbContext.TaskAttachments
                    .AsNoTracking()
                    .Where(attachment =>
                        taskIds.Contains(attachment.TaskItemId))
                    .Select(attachment =>
                        attachment.Id)
                    .ToListAsync();

            var dependencyIds =
                await _dbContext.TaskDependencies
                    .AsNoTracking()
                    .Where(dependency =>
                        taskIds.Contains(dependency.TaskItemId) ||
                        taskIds.Contains(dependency.DependsOnTaskItemId))
                    .Select(dependency =>
                        dependency.Id)
                    .ToListAsync();

            var projectMemberIds =
                await _dbContext.ProjectMembers
                    .AsNoTracking()
                    .Where(member =>
                        projectIds.Contains(member.ProjectId))
                    .Select(member =>
                        member.Id)
                    .ToListAsync();

            activityLogsQuery =
                activityLogsQuery.Where(activityLog =>
                    activityLog.UserId == userId ||
                    activityLog.EntityName == nameof(WorkspaceInvitation) ||
                    (
                        activityLog.EntityName == nameof(Project) &&
                        projectIds.Contains(activityLog.EntityId)
                    ) ||
                    (
                        activityLog.EntityName == nameof(ProjectMember) &&
                        projectMemberIds.Contains(activityLog.EntityId)
                    ) ||
                    (
                        activityLog.EntityName == nameof(TaskItem) &&
                        taskIds.Contains(activityLog.EntityId)
                    ) ||
                    (
                        activityLog.EntityName == nameof(TaskAssignee) &&
                        assigneeIds.Contains(activityLog.EntityId)
                    ) ||
                    (
                        activityLog.EntityName == nameof(TaskComment) &&
                        commentIds.Contains(activityLog.EntityId)
                    ) ||
                    (
                        activityLog.EntityName == nameof(TaskAttachment) &&
                        attachmentIds.Contains(activityLog.EntityId)
                    ) ||
                    (
                        activityLog.EntityName == nameof(TaskDependency) &&
                        dependencyIds.Contains(activityLog.EntityId)
                    ));
        }
        else if (roleName == SystemRoles.Member)
        {
            activityLogsQuery =
                activityLogsQuery.Where(activityLog =>
                    activityLog.UserId == userId);
        }
        else if (
            roleName != "SystemAdmin" &&
            roleName != SystemRoles.WorkspaceOwner &&
            roleName != "Owner")
        {
            throw new ForbiddenException(
                "You do not have permission to perform this action.");
        }

        var activityLogs =
            await activityLogsQuery
                .OrderByDescending(activityLog =>
                    activityLog.CreatedAt)
                .ThenByDescending(activityLog =>
                    activityLog.Id)
                .ToListAsync();


        return activityLogs
            .Select(MapToResponse)
            .ToList();
    }


    /* =========================================================
       TASK LIFE / HISTORY
       ========================================================= */

    public async Task<List<ActivityLogResponse>>
        GetTaskActivityLogsAsync(
            int workspaceId,
            int projectId,
            int taskId)
    {
        /*
         * نتأكد أولاً من صحة:
         *
         * Workspace
         *   -> Project
         *      -> Task
         */
        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);


        /*
         * كل مستخدم يستطيع مشاهدة المهمة
         * يستطيع مشاهدة تاريخها.
         */
        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskView);

        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        if (roleName == SystemRoles.Member)
        {
            var assigned =
                await _dbContext.TaskAssignees
                    .AsNoTracking()
                    .AnyAsync(assignment =>
                        assignment.TaskItemId == taskId &&
                        assignment.UserId == _currentUserService.UserId &&
                        !assignment.IsDeleted);

            if (!assigned)
            {
                throw new NotFoundException(
                    "Task not found.");
            }
        }


        /* =====================================================
           TASK ASSIGNEES

           لا نضع شرط IsDeleted لأننا نريد
           الاحتفاظ بالإسنادات القديمة ضمن
           حياة المهمة حتى بعد إزالتها.
           ===================================================== */

        var taskAssignees =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .Where(assignment =>
                    assignment.TaskItemId ==
                        taskId)
                .Select(assignment =>
                    new
                    {
                        assignment.Id,

                        assignment.UserId,

                        UserFullName =
                            assignment.User.FullName
                    })
                .ToListAsync();


        var taskAssigneeIds =
            taskAssignees
                .Select(assignment =>
                    assignment.Id)
                .ToList();


        /* =====================================================
           TASK COMMENTS

           نقرأ جميع التعليقات الخاصة بالمهمة
           بما فيها المحذوفة Soft Delete لأن
           سجل حذف التعليق يجب أن يبقى ظاهرًا.
           ===================================================== */

        var taskComments =
            await _dbContext.TaskComments
                .AsNoTracking()
                .Where(comment =>
                    comment.TaskItemId ==
                        taskId)
                .Select(comment =>
                    new
                    {
                        comment.Id,

                        comment.Content,

                        comment.UserId,

                        UserFullName =
                            comment.User.FullName
                    })
                .ToListAsync();


        var taskCommentIds =
            taskComments
                .Select(comment =>
                    comment.Id)
                .ToList();


        /* =====================================================
           TASK ATTACHMENTS

           نفس الفكرة:
           حتى المرفقات المحذوفة يجب أن يبقى
           حدث رفعها وحذفها ضمن حياة المهمة.
           ===================================================== */

        var taskAttachments =
            await _dbContext.TaskAttachments
                .AsNoTracking()
                .Where(attachment =>
                    attachment.TaskItemId ==
                        taskId)
                .Select(attachment =>
                    new
                    {
                        attachment.Id,

                        attachment.FileName,

                        attachment.UserId,

                        UserFullName =
                            attachment.User.FullName
                    })
                .ToListAsync();


        var taskAttachmentIds =
            taskAttachments
                .Select(attachment =>
                    attachment.Id)
                .ToList();


        /* =====================================================
           COLLECT ALL TASK-RELATED ACTIVITY

           نجمع الأحداث المسجلة على:

           1. TaskItem
           2. TaskAssignee
           3. TaskComment
           4. TaskAttachment
           ===================================================== */

        var activityLogs =
            await _dbContext.ActivityLogs
                .AsNoTracking()
                .Include(activityLog =>
                    activityLog.User)
                .Where(activityLog =>
                    activityLog.WorkspaceId ==
                        workspaceId &&
                    !activityLog.IsDeleted &&
                    (
                        /*
                         * المهمة نفسها.
                         */
                        (
                            activityLog.EntityName ==
                                nameof(TaskItem) &&
                            activityLog.EntityId ==
                                taskId
                        )

                        ||

                        /*
                         * الإسنادات.
                         */
                        (
                            activityLog.EntityName ==
                                nameof(TaskAssignee) &&
                            taskAssigneeIds.Contains(
                                activityLog.EntityId)
                        )

                        ||

                        /*
                         * التعليقات.
                         */
                        (
                            activityLog.EntityName ==
                                nameof(TaskComment) &&
                            taskCommentIds.Contains(
                                activityLog.EntityId)
                        )

                        ||

                        /*
                         * المرفقات.
                         */
                        (
                            activityLog.EntityName ==
                                nameof(TaskAttachment) &&
                            taskAttachmentIds.Contains(
                                activityLog.EntityId)
                        )
                    ))
                .OrderBy(activityLog =>
                    activityLog.CreatedAt)
                .ThenBy(activityLog =>
                    activityLog.Id)
                .ToListAsync();


        /* =====================================================
           LOOKUP DICTIONARIES
           ===================================================== */

        var taskAssigneesById =
            taskAssignees
                .ToDictionary(
                    assignment =>
                        assignment.Id);


        var taskCommentsById =
            taskComments
                .ToDictionary(
                    comment =>
                        comment.Id);


        var taskAttachmentsById =
            taskAttachments
                .ToDictionary(
                    attachment =>
                        attachment.Id);


        /* =====================================================
           BUILD RESPONSE
           ===================================================== */

        var response =
            new List<ActivityLogResponse>();


        foreach (
            var activityLog
            in activityLogs)
        {
            var item =
                MapToResponse(
                    activityLog);


            /* =================================================
               ASSIGNEE EVENT

               UserFullName:
               الشخص الذي نفذ الإجراء.

               TargetUserFullName:
               الشخص الذي تم إسناد المهمة له
               أو إزالة الإسناد عنه.
               ================================================= */

            if (
                activityLog.EntityName ==
                    nameof(TaskAssignee) &&
                taskAssigneesById.TryGetValue(
                    activityLog.EntityId,
                    out var taskAssignee))
            {
                item.TargetUserId =
                    taskAssignee.UserId;

                item.TargetUserFullName =
                    taskAssignee.UserFullName;
            }


            /* =================================================
               COMMENT EVENT

               نعيد وصفًا أوضح حتى يستطيع
               الـ Frontend عرضه مباشرة.
               ================================================= */

            else if (
                activityLog.EntityName ==
                    nameof(TaskComment) &&
                taskCommentsById.TryGetValue(
                    activityLog.EntityId,
                    out var taskComment))
            {
                item.Description =
                    BuildCommentDescription(
                        activityLog.Action,
                        taskComment.Content,
                        activityLog.Description);
            }


            /* =================================================
               ATTACHMENT EVENT
               ================================================= */

            else if (
                activityLog.EntityName ==
                    nameof(TaskAttachment) &&
                taskAttachmentsById.TryGetValue(
                    activityLog.EntityId,
                    out var taskAttachment))
            {
                item.Description =
                    BuildAttachmentDescription(
                        activityLog.Action,
                        taskAttachment.FileName,
                        activityLog.Description);
            }


            response.Add(
                item);
        }


        return response;
    }


    /* =========================================================
       WRITE LOG
       ========================================================= */

    public async Task LogAsync(
        int workspaceId,
        string action,
        string entityName,
        int entityId,
        string? description = null)
    {
        await EnsureWorkspaceExistsAsync(
            workspaceId);


        var currentUserId =
            _currentUserService.UserId;


        var currentUser =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id ==
                        currentUserId &&
                    user.IsActive &&
                    !user.IsDeleted);


        if (currentUser is null)
        {
            throw new UnauthorizedException(
                "Current user account is not available.");
        }


        var activityLog =
            new ActivityLog
            {
                WorkspaceId =
                    workspaceId,

                UserId =
                    currentUserId,

                Action =
                    NormalizeRequiredValue(
                        action,
                        "Activity action",
                        150),

                EntityName =
                    NormalizeRequiredValue(
                        entityName,
                        "Entity name",
                        150),

                EntityId =
                    entityId,

                Description =
                    NormalizeDescription(
                        description),

                CreatedAt =
                    DateTime.UtcNow,

                User =
                    currentUser
            };


        _dbContext.ActivityLogs.Add(
            activityLog);


        await _dbContext
            .SaveChangesAsync();
    }


    /* =========================================================
       COMMENT DESCRIPTION
       ========================================================= */

    private static string BuildCommentDescription(
        string action,
        string content,
        string? fallbackDescription)
    {
        var normalizedContent =
            string.IsNullOrWhiteSpace(
                content)
                ? "بدون محتوى"
                : content.Trim();


        /*
         * حتى لا يصبح سجل الحياة ضخمًا
         * إذا كان التعليق طويلًا.
         */
        if (
            normalizedContent.Length >
            180)
        {
            normalizedContent =
                normalizedContent[..180]
                + "...";
        }


        return action switch
        {
            "comment.created" =>
                $"أضاف تعليقًا: «{normalizedContent}»",

            "comment.updated" =>
                $"عدّل تعليقًا إلى: «{normalizedContent}»",

            "comment.deleted" =>
                $"حذف تعليقًا: «{normalizedContent}»",

            _ =>
                fallbackDescription
                ?? $"نشاط على تعليق: «{normalizedContent}»"
        };
    }


    /* =========================================================
       ATTACHMENT DESCRIPTION
       ========================================================= */

    private static string BuildAttachmentDescription(
        string action,
        string fileName,
        string? fallbackDescription)
    {
        var normalizedFileName =
            string.IsNullOrWhiteSpace(
                fileName)
                ? "ملف"
                : fileName.Trim();


        return action switch
        {
            "attachment.uploaded" =>
                $"رفع المرفق «{normalizedFileName}»",

            "attachment.deleted" =>
                $"حذف المرفق «{normalizedFileName}»",

            _ =>
                fallbackDescription
                ?? $"نشاط على المرفق «{normalizedFileName}»"
        };
    }


    /* =========================================================
       VALIDATION
       ========================================================= */

    private async Task EnsureWorkspaceExistsAsync(
        int workspaceId)
    {
        var workspaceExists =
            await _dbContext.Workspaces
                .AnyAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);


        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }
    }


    private async Task EnsureTaskExistsAsync(
        int workspaceId,
        int projectId,
        int taskId)
    {
        await EnsureWorkspaceExistsAsync(
            workspaceId);


        var projectExists =
            await _dbContext.Projects
                .AnyAsync(project =>
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
            await _dbContext.TaskItems
                .AnyAsync(task =>
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


    /* =========================================================
       NORMALIZATION
       ========================================================= */

    private static string NormalizeRequiredValue(
        string value,
        string fieldName,
        int maximumLength)
    {
        var normalizedValue =
            value.Trim();


        if (
            string.IsNullOrWhiteSpace(
                normalizedValue))
        {
            throw new BadRequestException(
                $"{fieldName} is required.");
        }


        if (
            normalizedValue.Length >
            maximumLength)
        {
            throw new BadRequestException(
                $"{fieldName} cannot exceed {maximumLength} characters.");
        }


        return normalizedValue;
    }


    private static string? NormalizeDescription(
        string? description)
    {
        if (
            string.IsNullOrWhiteSpace(
                description))
        {
            return null;
        }


        var normalizedDescription =
            description.Trim();


        if (
            normalizedDescription.Length >
            1000)
        {
            throw new BadRequestException(
                "Activity description cannot exceed 1000 characters.");
        }


        return normalizedDescription;
    }


    /* =========================================================
       MAPPING
       ========================================================= */

    private static ActivityLogResponse
        MapToResponse(
            ActivityLog activityLog)
    {
        return new ActivityLogResponse
        {
            Id =
                activityLog.Id,

            WorkspaceId =
                activityLog.WorkspaceId,

            UserId =
                activityLog.UserId,

            UserFullName =
                activityLog.User.FullName,

            Action =
                activityLog.Action,

            EntityName =
                activityLog.EntityName,

            EntityId =
                activityLog.EntityId,

            Description =
                activityLog.Description,

            CreatedAt =
                activityLog.CreatedAt,

            TargetUserId =
                null,

            TargetUserFullName =
                null
        };
    }
}