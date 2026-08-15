using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Tasks;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class TaskService : ITaskService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public TaskService(
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

    public async Task<List<TaskResponse>> GetTasksAsync(
        int workspaceId,
        int projectId)
    {
        await EnsureProjectExistsAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskView);

        var tasks = await _dbContext.TaskItems
            .AsNoTracking()
            .Where(task =>
                task.ProjectId == projectId &&
                !task.IsDeleted)
            .OrderBy(task => task.Status)
            .ThenBy(task => task.Position)
            .ThenBy(task => task.CreatedAt)
            .ToListAsync();

        return tasks
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<TaskResponse> GetTaskByIdAsync(
        int workspaceId,
        int projectId,
        int taskId)
    {
        await EnsureProjectExistsAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskView);

        var task = await GetTaskAsync(
            projectId,
            taskId);

        return MapToResponse(task);
    }

    public async Task<TaskResponse> CreateTaskAsync(
        int workspaceId,
        int projectId,
        CreateTaskRequest request)
    {
        var project = await GetActiveProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskCreate);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Cannot create tasks in an archived project.");
        }

        var normalizedTitle =
            request.Title.Trim();

        var duplicateTitleExists =
            await _dbContext.TaskItems.AnyAsync(task =>
                task.ProjectId == projectId &&
                !task.IsDeleted &&
                task.Title == normalizedTitle);

        if (duplicateTitleExists)
        {
            throw new ConflictException(
                "A task with the same title already exists in this project.");
        }

        var normalizedDueDate =
            NormalizeDueDate(request.DueDate);

        if (normalizedDueDate.HasValue &&
            normalizedDueDate.Value <= DateTime.UtcNow)
        {
            throw new BadRequestException(
                "Task due date must be in the future.");
        }

        var lastPosition = await _dbContext.TaskItems
            .Where(task =>
                task.ProjectId == projectId &&
                !task.IsDeleted &&
                task.Status == TaskItemStatus.Todo)
            .Select(task => (double?)task.Position)
            .MaxAsync();

        var now =
            DateTime.UtcNow;

        var task = new TaskItem
        {
            ProjectId = projectId,
            Title = normalizedTitle,
            Description = NormalizeOptionalText(
                request.Description),
            Status = TaskItemStatus.Todo,
            Priority = request.Priority,
            DueDate = normalizedDueDate,
            Position = (lastPosition ?? 0) + 1,
            CreatedByUserId = _currentUserService.UserId,
            CreatedAt = now
        };

        _dbContext.TaskItems.Add(task);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.created",
            nameof(TaskItem),
            task.Id,
            $"Created task: {task.Title}");

        return MapToResponse(task);
    }

    public async Task<TaskResponse> UpdateTaskAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskRequest request)
    {
        var project = await GetActiveProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskDetailsUpdate);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Tasks in archived projects cannot be updated.");
        }

        var task = await GetTaskAsync(
            projectId,
            taskId);

        var normalizedTitle =
            request.Title.Trim();

        var duplicateTitleExists =
            await _dbContext.TaskItems.AnyAsync(existingTask =>
                existingTask.ProjectId == projectId &&
                existingTask.Id != taskId &&
                !existingTask.IsDeleted &&
                existingTask.Title == normalizedTitle);

        if (duplicateTitleExists)
        {
            throw new ConflictException(
                "A task with the same title already exists in this project.");
        }

        var previousPriority =
            task.Priority;

        var previousDueDate =
            NormalizeDueDate(task.DueDate);

        var requestedDueDate =
            NormalizeDueDate(request.DueDate);

        var priorityChanged =
            previousPriority != request.Priority;

        var dueDateChanged =
            !Nullable.Equals(
                previousDueDate,
                requestedDueDate);

        /*
         * Existing overdue tasks may still be edited.
         * But a user may not deliberately change the due
         * date to another date that is already in the past.
         */
        if (dueDateChanged &&
            requestedDueDate.HasValue &&
            requestedDueDate.Value <= DateTime.UtcNow)
        {
            throw new BadRequestException(
                "A changed task due date must be in the future.");
        }

        task.Title =
            normalizedTitle;

        task.Description =
            NormalizeOptionalText(
                request.Description);

        task.Priority =
            request.Priority;

        task.DueDate =
            requestedDueDate;

        task.UpdatedAt =
            DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.updated",
            nameof(TaskItem),
            task.Id,
            $"Updated task details: {task.Title}");

        if (priorityChanged ||
            dueDateChanged)
        {
            var notificationRecipientUserIds =
                await GetTaskNotificationRecipientUserIdsAsync(
                    task.Id,
                    project.ManagerUserId);

            var notificationTitle =
                GetTaskDetailsNotificationTitle(
                    priorityChanged,
                    dueDateChanged);

            var notificationType =
                GetTaskDetailsNotificationType(
                    priorityChanged,
                    dueDateChanged);

            var notificationMessage =
                BuildTaskDetailsNotificationMessage(
                    task.Title,
                    priorityChanged,
                    previousPriority,
                    task.Priority,
                    dueDateChanged,
                    previousDueDate,
                    task.DueDate);

            await _notificationService.CreateManyAsync(
                notificationRecipientUserIds,
                workspaceId,
                notificationTitle,
                notificationMessage,
                notificationType,
                nameof(TaskItem),
                task.Id);
        }

        return MapToResponse(task);
    }

    public async Task<TaskResponse> UpdateTaskStatusAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskStatusRequest request)
    {
        var project = await GetActiveProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskStatusUpdate);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Task status cannot be changed in an archived project.");
        }

        var task = await GetTaskAsync(
            projectId,
            taskId);

        var previousStatus =
            task.Status;

        var previousPosition =
            task.Position;

        var statusChanged =
            previousStatus != request.Status;

        var positionChanged =
            previousPosition != request.Position;

        if (!statusChanged &&
            !positionChanged)
        {
            return MapToResponse(task);
        }

        task.Status =
            request.Status;

        task.Position =
            request.Position;

        task.UpdatedAt =
            DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        if (statusChanged)
        {
            await _activityLogService.LogAsync(
                workspaceId,
                "task.status_changed",
                nameof(TaskItem),
                task.Id,
                $"Changed task status from {previousStatus} to {task.Status}: {task.Title}");

            var notificationRecipientUserIds =
                await GetTaskNotificationRecipientUserIdsAsync(
                    task.Id,
                    project.ManagerUserId);

            await _notificationService.CreateManyAsync(
                notificationRecipientUserIds,
                workspaceId,
                "Task status changed",
                $"Task \"{task.Title}\" status changed from {previousStatus} to {task.Status}.",
                "task.status_changed",
                nameof(TaskItem),
                task.Id);
        }
        else
        {
            await _activityLogService.LogAsync(
                workspaceId,
                "task.position_changed",
                nameof(TaskItem),
                task.Id,
                $"Changed task position from {previousPosition} to {task.Position}: {task.Title}");
        }

        return MapToResponse(task);
    }

    public async Task DeleteTaskAsync(
        int workspaceId,
        int projectId,
        int taskId)
    {
        var project = await GetActiveProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskDelete);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Tasks in archived projects cannot be deleted.");
        }

        var task = await GetTaskAsync(
            projectId,
            taskId);

        var notificationRecipientUserIds =
            await GetTaskNotificationRecipientUserIdsAsync(
                task.Id,
                project.ManagerUserId);

        var taskTitle =
            task.Title;

        var now =
            DateTime.UtcNow;

        task.IsDeleted =
            true;

        task.DeletedAt =
            now;

        task.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.deleted",
            nameof(TaskItem),
            task.Id,
            $"Deleted task: {taskTitle}");

        await _notificationService.CreateManyAsync(
            notificationRecipientUserIds,
            workspaceId,
            "Task deleted",
            $"Task \"{taskTitle}\" was deleted.",
            "task.deleted",
            nameof(TaskItem),
            task.Id);
    }

    private async Task EnsureProjectExistsAsync(
        int workspaceId,
        int projectId)
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
    }

    private async Task<Project> GetActiveProjectAsync(
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

    private async Task<HashSet<int>>
        GetTaskNotificationRecipientUserIdsAsync(
            int taskId,
            int? managerUserId)
    {
        var assigneeUserIds =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .Where(assignment =>
                    assignment.TaskItemId == taskId &&
                    !assignment.IsDeleted)
                .Select(assignment =>
                    assignment.UserId)
                .ToListAsync();

        var recipientUserIds =
            assigneeUserIds.ToHashSet();

        if (managerUserId.HasValue)
        {
            recipientUserIds.Add(
                managerUserId.Value);
        }

        return recipientUserIds;
    }

    private static string GetTaskDetailsNotificationTitle(
        bool priorityChanged,
        bool dueDateChanged)
    {
        if (priorityChanged &&
            dueDateChanged)
        {
            return "Task details changed";
        }

        return priorityChanged
            ? "Task priority changed"
            : "Task due date changed";
    }

    private static string GetTaskDetailsNotificationType(
        bool priorityChanged,
        bool dueDateChanged)
    {
        if (priorityChanged &&
            dueDateChanged)
        {
            return "task.details_changed";
        }

        return priorityChanged
            ? "task.priority_changed"
            : "task.due_date_changed";
    }

    private static string BuildTaskDetailsNotificationMessage(
        string taskTitle,
        bool priorityChanged,
        TaskPriority previousPriority,
        TaskPriority currentPriority,
        bool dueDateChanged,
        DateTime? previousDueDate,
        DateTime? currentDueDate)
    {
        var changes =
            new List<string>();

        if (priorityChanged)
        {
            changes.Add(
                $"priority changed from {previousPriority} to {currentPriority}");
        }

        if (dueDateChanged)
        {
            changes.Add(
                $"due date changed from {FormatDueDate(previousDueDate)} to {FormatDueDate(currentDueDate)}");
        }

        return
            $"Task \"{taskTitle}\" was updated: {string.Join("; ", changes)}.";
    }

    private static string FormatDueDate(
        DateTime? dueDate)
    {
        if (!dueDate.HasValue)
        {
            return "no due date";
        }

        var utcDueDate =
            AsUtc(dueDate.Value);

        return utcDueDate.ToString(
            "yyyy-MM-dd HH:mm 'UTC'",
            CultureInfo.InvariantCulture);
    }

    private static DateTime? NormalizeDueDate(
        DateTime? dueDate)
    {
        if (!dueDate.HasValue)
        {
            return null;
        }

        return AsUtc(
            dueDate.Value);
    }

    private static DateTime AsUtc(
        DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc =>
                value,

            DateTimeKind.Local =>
                value.ToUniversalTime(),

            _ =>
                DateTime.SpecifyKind(
                    value,
                    DateTimeKind.Utc)
        };
    }

    private static string? NormalizeOptionalText(
        string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static TaskResponse MapToResponse(
        TaskItem task)
    {
        return new TaskResponse
        {
            Id =
                task.Id,

            ProjectId =
                task.ProjectId,

            Title =
                task.Title,

            Description =
                task.Description,

            Status =
                task.Status.ToString(),

            Priority =
                task.Priority.ToString(),

            DueDate =
                NormalizeDueDate(task.DueDate),

            Position =
                task.Position,

            CreatedByUserId =
                task.CreatedByUserId,

            CreatedAt =
                AsUtc(task.CreatedAt),

            UpdatedAt =
                task.UpdatedAt.HasValue
                    ? AsUtc(task.UpdatedAt.Value)
                    : null
        };
    }
}