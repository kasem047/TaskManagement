using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.TaskComments;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Application.Services;

public sealed class TaskCommentService
    : ITaskCommentService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public TaskCommentService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _permissionService = permissionService;
        _activityLogService = activityLogService;
        _notificationService = notificationService;
    }

    public async Task<List<TaskCommentResponse>>
        GetTaskCommentsAsync(
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

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        var comments = await _dbContext.TaskComments
            .AsNoTracking()
            .Include(comment => comment.User)
            .Where(comment =>
                comment.TaskItemId == taskId &&
                !comment.IsDeleted)
            .OrderBy(comment => comment.CreatedAt)
            .ToListAsync();

        return comments
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<TaskCommentResponse>
        CreateTaskCommentAsync(
            int workspaceId,
            int projectId,
            int taskId,
            CreateTaskCommentRequest request)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskComment);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Comments cannot be added to tasks in an archived project.");
        }

        var task = await GetTaskAsync(
            projectId,
            taskId);

        var currentUserId =
            _currentUserService.UserId;

        var currentUser = await _dbContext.Users
            .FirstOrDefaultAsync(user =>
                user.Id == currentUserId &&
                user.IsActive &&
                !user.IsDeleted);

        if (currentUser is null)
        {
            throw new UnauthorizedException(
                "Current user account is not available.");
        }

        var comment = new TaskComment
        {
            TaskItemId = taskId,
            UserId = currentUserId,
            Content = NormalizeContent(
                request.Content),
            CreatedAt = DateTime.UtcNow,
            User = currentUser
        };

        _dbContext.TaskComments.Add(comment);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "comment.created",
            nameof(TaskComment),
            comment.Id,
            $"Added comment to task: {task.Title}");

        var assigneeUserIds =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .Where(assignment =>
                    assignment.TaskItemId == task.Id &&
                    !assignment.IsDeleted)
                .Select(assignment =>
                    assignment.UserId)
                .ToListAsync();

        var notificationRecipientUserIds =
            assigneeUserIds.ToHashSet();

        if (project.ManagerUserId.HasValue)
        {
            notificationRecipientUserIds.Add(
                project.ManagerUserId.Value);
        }

        await _notificationService.CreateManyAsync(
            notificationRecipientUserIds,
            workspaceId,
            "تعليق جديد على مهمة",
            $"أُضيف تعليق جديد على المهمة \"{task.Title}\".",
            "task.comment_added",
            nameof(TaskItem),
            task.Id);

        return MapToResponse(comment);
    }

    public async Task<TaskCommentResponse>
        UpdateTaskCommentAsync(
            int workspaceId,
            int projectId,
            int taskId,
            int commentId,
            UpdateTaskCommentRequest request)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskComment);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Comments in archived projects cannot be updated.");
        }

        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);

        var comment = await GetCommentAsync(
            taskId,
            commentId);

        EnsureCommentOwner(comment);

        comment.Content = NormalizeContent(
            request.Content);

        comment.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "comment.updated",
            nameof(TaskComment),
            comment.Id,
            $"Updated comment on task {taskId}.");

        return MapToResponse(comment);
    }

    public async Task DeleteTaskCommentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int commentId)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskComment);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Comments in archived projects cannot be deleted.");
        }

        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);

        var comment = await GetCommentAsync(
            taskId,
            commentId);

        EnsureCommentOwner(comment);

        var now = DateTime.UtcNow;

        comment.IsDeleted = true;
        comment.DeletedAt = now;
        comment.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "comment.deleted",
            nameof(TaskComment),
            comment.Id,
            $"Deleted comment from task {taskId}.");
    }

    private async Task<Project> GetProjectAsync(
        int workspaceId,
        int projectId)
    {
        var project = await _dbContext.Projects
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
        var task = await _dbContext.TaskItems
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

    private async Task EnsureMemberAssignedWhenRequiredAsync(
        int workspaceId,
        int taskId)
    {
        var roleName =
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId);

        if (roleName != SystemRoles.Member)
        {
            return;
        }

        var assigned =
            await _dbContext.TaskAssignees.AnyAsync(assignment =>
                assignment.TaskItemId == taskId &&
                assignment.UserId == _currentUserService.UserId &&
                !assignment.IsDeleted);

        if (!assigned)
        {
            throw new ForbiddenException(
                "You can only access tasks assigned to you.");
        }
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

    private async Task<TaskComment> GetCommentAsync(
        int taskId,
        int commentId)
    {
        var comment = await _dbContext.TaskComments
            .Include(taskComment =>
                taskComment.User)
            .FirstOrDefaultAsync(taskComment =>
                taskComment.Id == commentId &&
                taskComment.TaskItemId == taskId &&
                !taskComment.IsDeleted);

        if (comment is null)
        {
            throw new NotFoundException(
                "Task comment not found.");
        }

        return comment;
    }

    private void EnsureCommentOwner(
        TaskComment comment)
    {
        if (comment.UserId !=
            _currentUserService.UserId)
        {
            throw new ForbiddenException(
                "You can only update or delete your own comments.");
        }
    }

    private static string NormalizeContent(
        string content)
    {
        var normalizedContent =
            content.Trim();

        if (string.IsNullOrWhiteSpace(
                normalizedContent))
        {
            throw new BadRequestException(
                "Comment content cannot be empty.");
        }

        return normalizedContent;
    }

    private static TaskCommentResponse MapToResponse(
        TaskComment comment)
    {
        return new TaskCommentResponse
        {
            Id = comment.Id,
            TaskItemId = comment.TaskItemId,
            UserId = comment.UserId,
            UserFullName = comment.User.FullName,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt
        };
    }
}