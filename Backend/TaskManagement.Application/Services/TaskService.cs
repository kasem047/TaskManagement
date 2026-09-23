using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Tasks;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class TaskService : ITaskService
{
    private readonly IApplicationDbContext
        _dbContext;

    private readonly ICurrentUserService
        _currentUserService;

    private readonly IPermissionService
        _permissionService;

    private readonly IActivityLogService
        _activityLogService;

    private readonly INotificationService
        _notificationService;


    public TaskService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;

        _permissionService =
            permissionService;

        _activityLogService =
            activityLogService;

        _notificationService =
            notificationService;
    }


    /* =========================================================
       GET TASKS
       ========================================================= */

    public async Task<List<TaskResponse>>
        GetTasksAsync(
            int workspaceId,
            int projectId)
    {
        await EnsureProjectExistsAsync(
            workspaceId,
            projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskView);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);

        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        var query =
            _dbContext
                .TaskItems
                .AsNoTracking()
                .Where(task =>
                    task.ProjectId ==
                        projectId &&
                    !task.IsDeleted);

        if (roleName == SystemRoles.Member)
        {
            var userId =
                _currentUserService.UserId;

            query =
                query.Where(task =>
                    task.TaskAssignees.Any(assignment =>
                        !assignment.IsDeleted &&
                        assignment.UserId == userId));
        }

        var tasks =
            await query
                .OrderBy(task =>
                    task.Status)
                .ThenBy(task =>
                    task.Position)
                .ThenBy(task =>
                    task.CreatedAt)
                .ToListAsync();


        return tasks
            .Select(
                MapToResponse)
            .ToList();
    }


    /* =========================================================
       GET TASK
       ========================================================= */

    public async Task<TaskResponse>
        GetTaskByIdAsync(
            int workspaceId,
            int projectId,
            int taskId)
    {
        await EnsureProjectExistsAsync(
            workspaceId,
            projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskView);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);

        var task =
            await GetTaskAsync(
                projectId,
                taskId);

        await EnsureTaskVisibleForCurrentUserAsync(
            workspaceId,
            task.Id);


        return MapToResponse(
            task);
    }


    /* =========================================================
       CREATE TASK
       ========================================================= */

    public async Task<TaskResponse>
        CreateTaskAsync(
            int workspaceId,
            int projectId,
            CreateTaskRequest request)
    {
        var project =
            await GetActiveProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskCreate);

        await EnsureWorkspaceOwnerCannotManageTasksAsync(
            workspaceId);

        await EnsureMemberCannotRestructureTasksAsync(
            workspaceId);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Cannot create tasks in an archived project.");
        }


        var normalizedTitle =
            request.Title.Trim();


        var duplicateTitleExists =
            await _dbContext
                .TaskItems
                .AnyAsync(task =>
                    task.ProjectId ==
                        projectId &&
                    !task.IsDeleted &&
                    task.Title ==
                        normalizedTitle);


        if (duplicateTitleExists)
        {
            throw new ConflictException(
                "A task with the same title already exists in this project.");
        }


        var normalizedDueDate =
            NormalizeDueDate(
                request.DueDate);


        if (
            normalizedDueDate.HasValue &&
            normalizedDueDate.Value <=
                DateTime.UtcNow)
        {
            throw new BadRequestException(
                "Task due date must be in the future.");
        }


        var lastPosition =
            await _dbContext
                .TaskItems
                .Where(task =>
                    task.ProjectId ==
                        projectId &&
                    !task.IsDeleted &&
                    task.Status ==
                        TaskItemStatus.Todo)
                .Select(task =>
                    (double?)task.Position)
                .MaxAsync();


        var now =
            DateTime.UtcNow;


        var task =
            new TaskItem
            {
                ProjectId =
                    projectId,

                Title =
                    normalizedTitle,

                Description =
                    NormalizeOptionalText(
                        request.Description),

                Status =
                    TaskItemStatus.Todo,

                Priority =
                    request.Priority,

                DueDate =
                    normalizedDueDate,

                Position =
                    (lastPosition ?? 0) + 1,

                CreatedByUserId =
                    _currentUserService.UserId,

                ProgressPercentage =
                    null,

                ProgressNote =
                    null,

                ProgressUpdatedAt =
                    null,

                CreatedAt =
                    now
            };


        _dbContext
            .TaskItems
            .Add(
                task);


        await _dbContext
            .SaveChangesAsync();


        await _activityLogService
            .LogAsync(
                workspaceId,
                "task.created",
                nameof(TaskItem),
                task.Id,
                $"Created task: {task.Title}");


        return MapToResponse(
            task);
    }


    /* =========================================================
       UPDATE DETAILS
       ========================================================= */

    public async Task<TaskResponse>
        UpdateTaskAsync(
            int workspaceId,
            int projectId,
            int taskId,
            UpdateTaskRequest request)
    {
        var project =
            await GetActiveProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskDetailsUpdate);

        await EnsureWorkspaceOwnerCannotManageTasksAsync(
            workspaceId);

        await EnsureMemberCannotRestructureTasksAsync(
            workspaceId);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Tasks in archived projects cannot be updated.");
        }


        var task =
            await GetTaskAsync(
                projectId,
                taskId);


        var normalizedTitle =
            request.Title.Trim();


        var duplicateTitleExists =
            await _dbContext
                .TaskItems
                .AnyAsync(existingTask =>
                    existingTask.ProjectId ==
                        projectId &&
                    existingTask.Id !=
                        taskId &&
                    !existingTask.IsDeleted &&
                    existingTask.Title ==
                        normalizedTitle);


        if (duplicateTitleExists)
        {
            throw new ConflictException(
                "A task with the same title already exists in this project.");
        }


        var previousPriority =
            task.Priority;


        var previousDueDate =
            NormalizeDueDate(
                task.DueDate);


        var requestedDueDate =
            NormalizeDueDate(
                request.DueDate);


        var priorityChanged =
            previousPriority !=
            request.Priority;


        var dueDateChanged =
            !Nullable.Equals(
                previousDueDate,
                requestedDueDate);


        if (
            dueDateChanged &&
            requestedDueDate.HasValue &&
            requestedDueDate.Value <=
                DateTime.UtcNow)
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


        await _dbContext
            .SaveChangesAsync();


        await _activityLogService
            .LogAsync(
                workspaceId,
                "task.updated",
                nameof(TaskItem),
                task.Id,
                $"Updated task details: {task.Title}");


        if (
            priorityChanged ||
            dueDateChanged)
        {
            var recipients =
                await GetTaskNotificationRecipientUserIdsAsync(
                    task.Id,
                    project.ManagerUserId);


            await _notificationService
                .CreateManyAsync(
                    recipients,
                    workspaceId,
                    GetTaskDetailsNotificationTitle(
                        priorityChanged,
                        dueDateChanged),
                    BuildTaskDetailsNotificationMessage(
                        task.Title,
                        priorityChanged,
                        previousPriority,
                        task.Priority,
                        dueDateChanged,
                        previousDueDate,
                        task.DueDate),
                    GetTaskDetailsNotificationType(
                        priorityChanged,
                        dueDateChanged),
                    nameof(TaskItem),
                    task.Id);
        }


        return MapToResponse(
            task);
    }


    /* =========================================================
       UPDATE STATUS / PROGRESS / POSITION
       ========================================================= */

    public async Task<TaskResponse>
        UpdateTaskStatusAsync(
            int workspaceId,
            int projectId,
            int taskId,
            UpdateTaskStatusRequest request)
    {
        var project =
            await GetActiveProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskStatusUpdate);

        await EnsureWorkspaceOwnerCannotManageTasksAsync(
            workspaceId);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);

        await EnsureTaskVisibleForCurrentUserAsync(
            workspaceId,
            taskId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Task status cannot be changed in an archived project.");
        }


        var task =
            await GetTaskAsync(
                projectId,
                taskId);


        var previousStatus =
            task.Status;

        var previousPosition =
            task.Position;

        var previousProgressPercentage =
            task.ProgressPercentage;

        var previousProgressNote =
            task.ProgressNote;


        var normalizedProgressNote =
            NormalizeOptionalText(
                request.ProgressNote);


        var normalizedChangeReason =
            NormalizeOptionalText(
                request.ChangeReason);


        ValidateProgressRequest(
            request,
            normalizedProgressNote);


        var statusChanged =
            previousStatus !=
            request.Status;


        var positionChanged =
            previousPosition !=
            request.Position;


        var progressChanged =
            request.Status ==
                TaskItemStatus.PartiallyCompleted &&
            (
                task.ProgressPercentage !=
                    request.ProgressPercentage ||

                !string.Equals(
                    task.ProgressNote,
                    normalizedProgressNote,
                    StringComparison.Ordinal)
            );


        if (
            !statusChanged &&
            !positionChanged &&
            !progressChanged)
        {
            return MapToResponse(
                task);
        }


        /*
         * RULE:
         *
         * لا يمكن تغيير حالة المهمة
         * قبل إسنادها لمستخدم.
         *
         * تنطبق على الجميع:
         *
         * WorkspaceOwner
         * ProjectManager
         * Member
         */
        if (statusChanged)
        {
            await EnsureTaskHasAssigneeAsync(
                task.Id);
        }


        /*
         * RULE:
         *
         * عند الانتقال إلى حالة تنفيذ
         * أو إنجاز، يجب أن تكون جميع
         * اعتماديات المهمة Done.
         *
         * Todo و Cancelled لا يحتاجان
         * تحقق اكتمال الاعتماديات.
         */
        if (
            statusChanged &&
            (
                request.Status ==
                    TaskItemStatus.InProgress ||

                request.Status ==
                    TaskItemStatus.PartiallyCompleted ||

                request.Status ==
                    TaskItemStatus.Done
            ))
        {
            await EnsureDependenciesSatisfiedAsync(
                task.Id);
        }


        await EnsureWorkflowChangeAllowedAsync(
            workspaceId,
            task,
            request.Status,
            statusChanged,
            positionChanged,
            progressChanged,
            normalizedChangeReason);


        var now =
            DateTime.UtcNow;


        if (
            request.Status ==
            TaskItemStatus.PartiallyCompleted)
        {
            task.ProgressPercentage =
                request.ProgressPercentage;

            task.ProgressNote =
                normalizedProgressNote;


            if (
                statusChanged ||
                progressChanged)
            {
                task.ProgressUpdatedAt =
                    now;
            }
        }
        else if (
            request.Status ==
            TaskItemStatus.Done)
        {
            task.ProgressPercentage =
                100;

            task.ProgressUpdatedAt =
                now;
        }
        else if (
            statusChanged &&
            (
                request.Status ==
                    TaskItemStatus.Todo ||

                request.Status ==
                    TaskItemStatus.InProgress
            ))
        {
            task.ProgressPercentage =
                null;

            task.ProgressNote =
                null;

            task.ProgressUpdatedAt =
                null;
        }


        task.Status =
            request.Status;

        task.Position =
            request.Position;

        task.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        if (statusChanged)
        {
            await _activityLogService
                .LogAsync(
                    workspaceId,
                    "task.status_changed",
                    nameof(TaskItem),
                    task.Id,
                    BuildStatusLogDescription(
                        task.Title,
                        previousStatus,
                        task.Status,
                        normalizedChangeReason));
        }


        if (
            request.Status ==
                TaskItemStatus.PartiallyCompleted &&
            (
                statusChanged ||
                progressChanged
            ))
        {
            await _activityLogService
                .LogAsync(
                    workspaceId,
                    "task.progress_updated",
                    nameof(TaskItem),
                    task.Id,
                    BuildProgressLogDescription(
                        task.ProgressPercentage,
                        task.ProgressNote));
        }


        if (
            positionChanged &&
            !statusChanged)
        {
            await _activityLogService
                .LogAsync(
                    workspaceId,
                    "task.position_changed",
                    nameof(TaskItem),
                    task.Id,
                    $"Changed task position from {previousPosition} to {task.Position}: {task.Title}");
        }


        if (
            statusChanged ||
            progressChanged)
        {
            var recipients =
                await GetTaskNotificationRecipientUserIdsAsync(
                    task.Id,
                    project.ManagerUserId);


            var notification =
                BuildWorkflowNotification(
                    task,
                    previousStatus,
                    statusChanged,
                    progressChanged,
                    previousProgressPercentage,
                    previousProgressNote,
                    normalizedChangeReason);


            await _notificationService
                .CreateManyAsync(
                    recipients,
                    workspaceId,
                    notification.Title,
                    notification.Message,
                    notification.Type,
                    nameof(TaskItem),
                    task.Id);
        }

        if (
            statusChanged &&
            request.Status ==
                TaskItemStatus.Done)
        {
            await TryNotifyOnTimeCompletionRewardAsync(
                workspaceId,
                project,
                task,
                now);
        }


        return MapToResponse(
            task);
    }


    /* =========================================================
       DEPENDENCIES - GET
       ========================================================= */

    public async Task<List<TaskDependencyResponse>>
        GetTaskDependenciesAsync(
            int workspaceId,
            int projectId,
            int taskId)
    {
        await EnsureProjectExistsAsync(
            workspaceId,
            projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskView);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);

        await EnsureTaskVisibleForCurrentUserAsync(
            workspaceId,
            taskId);


        var dependencies =
            await _dbContext
                .TaskDependencies
                .AsNoTracking()
                .Include(dependency =>
                    dependency.DependsOnTaskItem)
                .Where(dependency =>
                    dependency.TaskItemId ==
                        taskId &&
                    !dependency.IsDeleted &&
                    !dependency.DependsOnTaskItem
                        .IsDeleted)
                .OrderBy(dependency =>
                    dependency.DependsOnTaskItem
                        .Title)
                .ToListAsync();


        return dependencies
            .Select(
                dependency =>
                    new TaskDependencyResponse
                    {
                        TaskId =
                            taskId,

                        DependsOnTaskId =
                            dependency
                                .DependsOnTaskItemId,

                        DependsOnTaskTitle =
                            dependency
                                .DependsOnTaskItem
                                .Title,

                        DependsOnTaskStatus =
                            GetStatusResponseName(
                                dependency
                                    .DependsOnTaskItem
                                    .Status),

                        IsSatisfied =
                            dependency
                                .DependsOnTaskItem
                                .Status ==
                            TaskItemStatus.Done
                    })
            .ToList();
    }


    /* =========================================================
       DEPENDENCIES - SET
       ========================================================= */

    public async Task<List<TaskDependencyResponse>>
        SetTaskDependenciesAsync(
            int workspaceId,
            int projectId,
            int taskId,
            SetTaskDependenciesRequest request)
    {
        var project =
            await GetActiveProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskDetailsUpdate);

        await EnsureWorkspaceOwnerCannotManageTasksAsync(
            workspaceId);

        await EnsureMemberCannotRestructureTasksAsync(
            workspaceId);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Dependencies cannot be changed in an archived project.");
        }


        var task =
            await GetTaskAsync(
                projectId,
                taskId);


        /*
         * RULE:
         *
         * الاعتماديات تُحدد أو تُعدّل فقط
         * قبل بدء تنفيذ المهمة.
         *
         * بعد خروج المهمة من Todo
         * تصبح الاعتماديات للقراءة فقط.
         */
        if (
            task.Status !=
            TaskItemStatus.Todo)
        {
            throw new ConflictException(
                "Task dependencies can only be changed while the task is in Todo status.");
        }


        var requestedIds =
            request.DependsOnTaskIds
                .Distinct()
                .ToHashSet();


        /*
         * المهمة لا تعتمد على نفسها.
         */
        if (
            requestedIds.Contains(
                taskId))
        {
            throw new BadRequestException(
                "A task cannot depend on itself.");
        }


        /*
         * حد منطقي لمنع إدخال
         * عدد غير طبيعي من العلاقات.
         */
        if (
            requestedIds.Count >
            50)
        {
            throw new BadRequestException(
                "A task cannot have more than 50 dependencies.");
        }


        if (
            requestedIds.Count >
            0)
        {
            var dependencyTasks =
                await _dbContext
                    .TaskItems
                    .AsNoTracking()
                    .Where(candidate =>
                        candidate.ProjectId ==
                            projectId &&
                        !candidate.IsDeleted &&
                        requestedIds.Contains(
                            candidate.Id))
                    .Select(candidate =>
                        new
                        {
                            candidate.Id,
                            candidate.Status
                        })
                    .ToListAsync();


            /*
             * جميع الاعتماديات يجب أن تكون
             * مهام حقيقية ضمن نفس المشروع.
             */
            if (
                dependencyTasks.Count !=
                requestedIds.Count)
            {
                throw new BadRequestException(
                    "All dependencies must belong to the same project and must be active tasks.");
            }


            /*
             * RULE:
             *
             * المهمة الملغاة لا يجوز
             * اختيارها كاعتمادية جديدة.
             *
             * Done مسموحة وتكون
             * اعتمادية محققة مباشرة.
             */
            if (
                dependencyTasks.Any(
                    candidate =>
                        candidate.Status ==
                        TaskItemStatus.Cancelled))
            {
                throw new ConflictException(
                    "A cancelled task cannot be used as a dependency.");
            }


            /*
             * منع الاعتماد الدائري.
             */
            await EnsureNoCircularDependencyAsync(
                projectId,
                taskId,
                requestedIds);
        }


        var existingDependencies =
            await _dbContext
                .TaskDependencies
                .Where(dependency =>
                    dependency.TaskItemId ==
                        taskId)
                .ToListAsync();


        var now =
            DateTime.UtcNow;


        /*
         * Soft Delete / Reactivation
         * للعلاقات الموجودة سابقًا.
         */
        foreach (
            var existing
            in existingDependencies)
        {
            if (
                requestedIds.Contains(
                    existing.DependsOnTaskItemId))
            {
                if (
                    existing.IsDeleted)
                {
                    existing.IsDeleted =
                        false;

                    existing.DeletedAt =
                        null;

                    existing.UpdatedAt =
                        now;
                }


                continue;
            }


            if (
                !existing.IsDeleted)
            {
                existing.IsDeleted =
                    true;

                existing.DeletedAt =
                    now;

                existing.UpdatedAt =
                    now;
            }
        }


        /*
         * إضافة العلاقات الجديدة فقط.
         */
        foreach (
            var dependencyTaskId
            in requestedIds)
        {
            var exists =
                existingDependencies
                    .Any(existing =>
                        existing
                            .DependsOnTaskItemId ==
                        dependencyTaskId);


            if (exists)
            {
                continue;
            }


            _dbContext
                .TaskDependencies
                .Add(
                    new TaskDependency
                    {
                        TaskItemId =
                            taskId,

                        DependsOnTaskItemId =
                            dependencyTaskId,

                        CreatedAt =
                            now
                    });
        }


        await _dbContext
            .SaveChangesAsync();


        var dependencyTitles =
            requestedIds.Count == 0

                ? new List<string>()

                : await _dbContext
                    .TaskItems
                    .AsNoTracking()
                    .Where(candidate =>
                        requestedIds.Contains(
                            candidate.Id))
                    .OrderBy(candidate =>
                        candidate.Title)
                    .Select(candidate =>
                        candidate.Title)
                    .ToListAsync();


        await _activityLogService
            .LogAsync(
                workspaceId,
                "task.dependencies_updated",
                nameof(TaskItem),
                task.Id,
                dependencyTitles.Count == 0

                    ? $"Removed all dependencies from task: {task.Title}"

                    : $"Updated dependencies for task {task.Title}: {string.Join(", ", dependencyTitles)}");


        var recipients =
            await GetTaskNotificationRecipientUserIdsAsync(
                task.Id,
                project.ManagerUserId);


        await _notificationService
            .CreateManyAsync(
                recipients,
                workspaceId,
                "تغيّرت اعتماديات مهمة",

                dependencyTitles.Count == 0

                    ? $"أُزيلت الاعتماديات من المهمة \"{task.Title}\"."

                    : $"أصبحت المهمة \"{task.Title}\" تعتمد على: {string.Join("، ", dependencyTitles)}.",

                "task.dependencies_updated",
                nameof(TaskItem),
                task.Id);


        return await GetTaskDependenciesAsync(
            workspaceId,
            projectId,
            taskId);
    }


    /* =========================================================
       DELETE TASK
       ========================================================= */

    public async Task DeleteTaskAsync(
        int workspaceId,
        int projectId,
        int taskId)
    {
        var project =
            await GetActiveProjectAsync(
                workspaceId,
                projectId);


        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.TaskDelete);

        await EnsureWorkspaceOwnerCannotManageTasksAsync(
            workspaceId);

        await EnsureMemberCannotRestructureTasksAsync(
            workspaceId);

        await EnsureProjectVisibleForCurrentUserAsync(
            workspaceId,
            projectId);


        if (project.IsArchived)
        {
            throw new ConflictException(
                "Tasks in archived projects cannot be deleted.");
        }


        var task =
            await GetTaskAsync(
                projectId,
                taskId);


        /*
         * إذا كانت مهمة أخرى تعتمد عليها،
         * يجب إزالة الاعتمادية أولًا.
         */
        var hasActiveDependents =
            await _dbContext
                .TaskDependencies
                .AsNoTracking()
                .AnyAsync(dependency =>
                    dependency
                        .DependsOnTaskItemId ==
                        taskId &&
                    !dependency.IsDeleted &&
                    !dependency.TaskItem
                        .IsDeleted);


        if (hasActiveDependents)
        {
            throw new ConflictException(
                "This task cannot be deleted because another task depends on it. Remove the dependency first.");
        }


        var recipients =
            await GetTaskNotificationRecipientUserIdsAsync(
                task.Id,
                project.ManagerUserId);


        var outgoingDependencies =
            await _dbContext
                .TaskDependencies
                .Where(dependency =>
                    dependency.TaskItemId ==
                        taskId &&
                    !dependency.IsDeleted)
                .ToListAsync();


        var taskTitle =
            task.Title;


        var now =
            DateTime.UtcNow;


        foreach (
            var dependency
            in outgoingDependencies)
        {
            dependency.IsDeleted =
                true;

            dependency.DeletedAt =
                now;

            dependency.UpdatedAt =
                now;
        }


        task.IsDeleted =
            true;

        task.DeletedAt =
            now;

        task.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        await _activityLogService
            .LogAsync(
                workspaceId,
                "task.deleted",
                nameof(TaskItem),
                task.Id,
                $"Deleted task: {taskTitle}");


        await _notificationService
            .CreateManyAsync(
                recipients,
                workspaceId,
                "تم حذف مهمة",
                $"تم حذف المهمة \"{taskTitle}\".",
                "task.deleted",
                nameof(TaskItem),
                task.Id);
    }


    /* =========================================================
       ASSIGNMENT RULE
       ========================================================= */

    private async Task EnsureTaskHasAssigneeAsync(
        int taskId)
    {
        var hasAssignee =
            await _dbContext
                .TaskAssignees
                .AsNoTracking()
                .AnyAsync(assignment =>
                    assignment.TaskItemId ==
                        taskId &&
                    !assignment.IsDeleted);


        if (!hasAssignee)
        {
            throw new ConflictException(
                "Task must be assigned to a user before its status can be changed.");
        }
    }


    /* =========================================================
       DEPENDENCY RULE
       ========================================================= */

    private async Task EnsureDependenciesSatisfiedAsync(
        int taskId)
    {
        var hasIncompleteDependency =
            await _dbContext
                .TaskDependencies
                .AsNoTracking()
                .AnyAsync(dependency =>
                    dependency.TaskItemId ==
                        taskId &&
                    !dependency.IsDeleted &&
                    (
                        dependency
                            .DependsOnTaskItem
                            .IsDeleted ||

                        dependency
                            .DependsOnTaskItem
                            .Status !=
                        TaskItemStatus.Done
                    ));


        if (hasIncompleteDependency)
        {
            throw new ConflictException(
                "Task cannot start or be completed until all of its dependencies are completed.");
        }
    }


    /* =========================================================
       CIRCULAR DEPENDENCY RULE
       ========================================================= */

    private async Task EnsureNoCircularDependencyAsync(
        int projectId,
        int taskId,
        HashSet<int> requestedDependencyIds)
    {
        /*
         * نقرأ جميع العلاقات الحالية
         * في المشروع، باستثناء العلاقات
         * الخارجة من المهمة الحالية لأننا
         * نستبدلها بالاختيار الجديد.
         */
        var existingEdges =
            await _dbContext
                .TaskDependencies
                .AsNoTracking()
                .Where(dependency =>
                    !dependency.IsDeleted &&
                    dependency.TaskItemId !=
                        taskId &&
                    !dependency.TaskItem
                        .IsDeleted &&
                    !dependency
                        .DependsOnTaskItem
                        .IsDeleted &&
                    dependency.TaskItem
                        .ProjectId ==
                        projectId)
                .Select(dependency =>
                    new
                    {
                        dependency.TaskItemId,
                        dependency.DependsOnTaskItemId
                    })
                .ToListAsync();


        var graph =
            existingEdges
                .GroupBy(edge =>
                    edge.TaskItemId)
                .ToDictionary(
                    group =>
                        group.Key,
                    group =>
                        group
                            .Select(edge =>
                                edge
                                    .DependsOnTaskItemId)
                            .ToList());


        /*
         * إذا كان أي Dependency يستطيع
         * الوصول إلى المهمة الحالية،
         * فإن إضافة:
         *
         * Current -> Dependency
         *
         * ستنشئ دورة.
         */
        foreach (
            var dependencyId
            in requestedDependencyIds)
        {
            if (
                CanReachTask(
                    dependencyId,
                    taskId,
                    graph,
                    new HashSet<int>()))
            {
                throw new ConflictException(
                    "The selected dependency would create a circular dependency.");
            }
        }
    }


    private static bool CanReachTask(
        int currentTaskId,
        int targetTaskId,
        Dictionary<int, List<int>> graph,
        HashSet<int> visited)
    {
        if (
            currentTaskId ==
            targetTaskId)
        {
            return true;
        }


        if (
            !visited.Add(
                currentTaskId))
        {
            return false;
        }


        if (
            !graph.TryGetValue(
                currentTaskId,
                out var dependencies))
        {
            return false;
        }


        foreach (
            var dependencyId
            in dependencies)
        {
            if (
                CanReachTask(
                    dependencyId,
                    targetTaskId,
                    graph,
                    visited))
            {
                return true;
            }
        }


        return false;
    }


    /* =========================================================
       WORKFLOW AUTHORIZATION
       ========================================================= */

    private async Task EnsureWorkspaceOwnerCannotManageTasksAsync(
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
                "Workspace owners cannot manage tasks.");
        }
    }


    private async Task EnsureMemberCannotRestructureTasksAsync(
        int workspaceId)
    {
        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        if (roleName == SystemRoles.Member)
        {
            throw new ForbiddenException(
                "Members cannot create, restructure, or delete tasks.");
        }
    }


    private async Task EnsureProjectVisibleForCurrentUserAsync(
        int workspaceId,
        int projectId)
    {
        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        var userId =
            _currentUserService.UserId;

        if (roleName == "SystemAdmin" ||
            roleName == SystemRoles.WorkspaceOwner ||
            roleName == "Owner")
        {
            return;
        }

        var project =
            await _dbContext
                .Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(current =>
                    current.Id == projectId &&
                    current.WorkspaceId == workspaceId &&
                    !current.IsDeleted);

        if (project is null)
        {
            throw new NotFoundException(
                "Project not found.");
        }

        if (roleName == SystemRoles.ProjectManager)
        {
            if (project.ManagerUserId != userId)
            {
                throw new NotFoundException(
                    "Project not found.");
            }

            return;
        }

        if (roleName == SystemRoles.Member)
        {
            var assigned =
                await _dbContext
                    .TaskAssignees
                    .AsNoTracking()
                    .AnyAsync(assignment =>
                        assignment.UserId == userId &&
                        !assignment.IsDeleted &&
                        !assignment.TaskItem.IsDeleted &&
                        assignment.TaskItem.ProjectId == projectId);

            var isProjectMember =
                await _dbContext
                    .ProjectMembers
                    .AsNoTracking()
                    .AnyAsync(member =>
                        member.ProjectId == projectId &&
                        member.UserId == userId &&
                        !member.IsDeleted);

            if (!assigned &&
                !isProjectMember)
            {
                throw new NotFoundException(
                    "Project not found.");
            }

            return;
        }

        throw new NotFoundException(
            "Project not found.");
    }


    private async Task EnsureTaskVisibleForCurrentUserAsync(
        int workspaceId,
        int taskId)
    {
        var roleName =
            await _permissionService
                .GetActiveRoleNameAsync(
                    workspaceId);

        if (roleName != SystemRoles.Member)
        {
            return;
        }

        var assigned =
            await IsCurrentUserAssignedAsync(
                taskId);

        if (!assigned)
        {
            throw new NotFoundException(
                "Task not found.");
        }
    }


    private async Task EnsureWorkflowChangeAllowedAsync(
        int workspaceId,
        TaskItem task,
        TaskItemStatus requestedStatus,
        bool statusChanged,
        bool positionChanged,
        bool progressChanged,
        string? changeReason)
    {
        var canManageWorkflow =
            await CanManageTaskWorkflowAsync(
                workspaceId);


        if (canManageWorkflow)
        {
            if (
                statusChanged &&
                RequiresChangeReason(
                    task.Status,
                    requestedStatus) &&
                string.IsNullOrWhiteSpace(
                    changeReason))
            {
                throw new BadRequestException(
                    "A reason is required when rejecting, reopening, or moving a task backward.");
            }


            return;
        }


        var currentUserAssigned =
            await IsCurrentUserAssignedAsync(
                task.Id);


        if (!currentUserAssigned)
        {
            throw new ForbiddenException(
                "You can only update the workflow of tasks assigned to you.");
        }


        if (
            task.Status ==
                TaskItemStatus.Done ||

            task.Status ==
                TaskItemStatus.Cancelled)
        {
            throw new ForbiddenException(
                "Completed or cancelled tasks cannot be changed by an assigned member.");
        }


        if (!statusChanged)
        {
            if (
                positionChanged ||
                progressChanged)
            {
                return;
            }


            return;
        }


        if (
            !IsValidMemberStatusTransition(
                task.Status,
                requestedStatus))
        {
            throw new ConflictException(
                $"Invalid task status transition from {GetStatusResponseName(task.Status)} to {GetStatusResponseName(requestedStatus)} for an assigned member.");
        }
    }


    private async Task<bool> CanManageTaskWorkflowAsync(
        int workspaceId)
    {
        try
        {
            await _permissionService
                .EnsurePermissionAsync(
                    workspaceId,
                    SystemPermissions.TaskDetailsUpdate);


            return true;
        }
        catch (ForbiddenException)
        {
            return false;
        }
    }


    private async Task<bool> IsCurrentUserAssignedAsync(
        int taskId)
    {
        var currentUserId =
            _currentUserService.UserId;


        return await _dbContext
            .TaskAssignees
            .AsNoTracking()
            .AnyAsync(assignment =>
                assignment.TaskItemId ==
                    taskId &&
                assignment.UserId ==
                    currentUserId &&
                !assignment.IsDeleted);
    }


    private static bool IsValidMemberStatusTransition(
        TaskItemStatus currentStatus,
        TaskItemStatus newStatus)
    {
        return currentStatus switch
        {
            TaskItemStatus.Todo =>
                newStatus ==
                    TaskItemStatus.InProgress,

            TaskItemStatus.InProgress =>
                newStatus ==
                    TaskItemStatus.PartiallyCompleted ||
                newStatus ==
                    TaskItemStatus.Done,

            TaskItemStatus.PartiallyCompleted =>
                newStatus ==
                    TaskItemStatus.Done,

            TaskItemStatus.Done =>
                false,

            TaskItemStatus.Cancelled =>
                false,

            _ =>
                false
        };
    }


    private static bool RequiresChangeReason(
        TaskItemStatus currentStatus,
        TaskItemStatus newStatus)
    {
        if (
            currentStatus ==
                TaskItemStatus.Done ||

            currentStatus ==
                TaskItemStatus.Cancelled)
        {
            return true;
        }


        if (
            newStatus ==
            TaskItemStatus.Cancelled)
        {
            return false;
        }


        var currentRank =
            GetWorkflowRank(
                currentStatus);


        var newRank =
            GetWorkflowRank(
                newStatus);


        return (
            currentRank.HasValue &&
            newRank.HasValue &&
            newRank.Value <
                currentRank.Value
        );
    }


    private static int? GetWorkflowRank(
        TaskItemStatus status)
    {
        return status switch
        {
            TaskItemStatus.Todo =>
                1,

            TaskItemStatus.InProgress =>
                2,

            TaskItemStatus.PartiallyCompleted =>
                3,

            TaskItemStatus.Done =>
                4,

            TaskItemStatus.Cancelled =>
                null,

            _ =>
                null
        };
    }


    /* =========================================================
       PROGRESS VALIDATION
       ========================================================= */

    private static void ValidateProgressRequest(
        UpdateTaskStatusRequest request,
        string? normalizedProgressNote)
    {
        if (
            request.Status !=
            TaskItemStatus.PartiallyCompleted)
        {
            return;
        }


        if (
            !request.ProgressPercentage
                .HasValue)
        {
            throw new BadRequestException(
                "Progress percentage is required for a partially completed task.");
        }


        if (
            request.ProgressPercentage.Value <
                1 ||

            request.ProgressPercentage.Value >
                99)
        {
            throw new BadRequestException(
                "Progress percentage must be between 1 and 99.");
        }


        if (
            string.IsNullOrWhiteSpace(
                normalizedProgressNote))
        {
            throw new BadRequestException(
                "Progress note is required for a partially completed task.");
        }


        if (
            normalizedProgressNote.Length <
            3)
        {
            throw new BadRequestException(
                "Progress note must contain at least 3 characters.");
        }


        if (
            normalizedProgressNote.Length >
            1000)
        {
            throw new BadRequestException(
                "Progress note cannot exceed 1000 characters.");
        }
    }


    /* =========================================================
       PROJECT / TASK HELPERS
       ========================================================= */

    private async Task EnsureProjectExistsAsync(
        int workspaceId,
        int projectId)
    {
        var exists =
            await _dbContext
                .Projects
                .AnyAsync(project =>
                    project.Id ==
                        projectId &&
                    project.WorkspaceId ==
                        workspaceId &&
                    !project.IsDeleted);


        if (!exists)
        {
            throw new NotFoundException(
                "Project not found.");
        }
    }


    private async Task<Project> GetActiveProjectAsync(
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


    private async Task<TaskItem> GetTaskAsync(
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


    /* =========================================================
       NOTIFICATION RECIPIENTS
       ========================================================= */

    private async Task<HashSet<int>>
        GetTaskNotificationRecipientUserIdsAsync(
            int taskId,
            int? managerUserId)
    {
        /*
         * Single Assignee:
         * نأخذ أحدث إسناد فعال فقط.
         */
        var assigneeUserId =
            await _dbContext
                .TaskAssignees
                .AsNoTracking()
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
                .Select(assignment =>
                    (int?)assignment.UserId)
                .FirstOrDefaultAsync();


        var recipients =
            new HashSet<int>();


        if (
            assigneeUserId.HasValue)
        {
            recipients.Add(
                assigneeUserId.Value);
        }


        if (
            managerUserId.HasValue)
        {
            recipients.Add(
                managerUserId.Value);
        }


        return recipients;
    }


    /* =========================================================
       NOTIFICATION
       ========================================================= */

    private async Task TryNotifyOnTimeCompletionRewardAsync(
        int workspaceId,
        Project project,
        TaskItem task,
        DateTime completedAt)
    {
        if (!project.ManagerUserId.HasValue ||
            task.DueDate is null)
        {
            return;
        }

        var currentUserId =
            _currentUserService.UserId;

        var isWorkspaceMember =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == currentUserId &&
                    member.Status == WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name == SystemRoles.Member);

        if (!isWorkspaceMember)
        {
            return;
        }

        var isAssignee =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .AnyAsync(assignment =>
                    assignment.TaskItemId == task.Id &&
                    assignment.UserId == currentUserId &&
                    !assignment.IsDeleted);

        if (!isAssignee)
        {
            return;
        }

        if (completedAt.Date > task.DueDate.Value.Date)
        {
            return;
        }

        var onTimeCount =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .Where(assignment =>
                    assignment.UserId == currentUserId &&
                    !assignment.IsDeleted &&
                    assignment.TaskItem.ProjectId == project.Id &&
                    !assignment.TaskItem.IsDeleted &&
                    assignment.TaskItem.Status == TaskItemStatus.Done &&
                    assignment.TaskItem.DueDate != null &&
                    (assignment.TaskItem.ProgressUpdatedAt ?? assignment.TaskItem.UpdatedAt) != null &&
                    (assignment.TaskItem.ProgressUpdatedAt ?? assignment.TaskItem.UpdatedAt)!.Value.Date <=
                        assignment.TaskItem.DueDate!.Value.Date)
                .Select(assignment => assignment.TaskItemId)
                .Distinct()
                .CountAsync();

        if (onTimeCount < 3 ||
            onTimeCount % 3 != 0)
        {
            return;
        }

        var expectedRewards =
            onTimeCount / 3;

        var rewardsSent =
            await _dbContext.Notifications
                .AsNoTracking()
                .CountAsync(notification =>
                    notification.WorkspaceId == workspaceId &&
                    notification.UserId == project.ManagerUserId.Value &&
                    notification.Type == "member.ontime_reward" &&
                    notification.EntityName == nameof(User) &&
                    notification.EntityId == currentUserId &&
                    !notification.IsDeleted);

        if (rewardsSent >= expectedRewards)
        {
            return;
        }

        var memberName =
            await _dbContext.Users
                .AsNoTracking()
                .Where(user => user.Id == currentUserId)
                .Select(user => user.FullName)
                .FirstOrDefaultAsync()
            ?? "عضو";

        await _notificationService.CreateAsync(
            project.ManagerUserId.Value,
            workspaceId,
            "مكافأة مالية مقترحة",
            $"يُقترح منح {memberName} مكافأة مالية بعد إنجاز {onTimeCount} مهام موكلة إليه في المشروع \"{project.Name}\" قبل الموعد ودون تأخير.",
            "member.ontime_reward",
            nameof(User),
            currentUserId);
    }

    private static WorkflowNotification BuildWorkflowNotification(
        TaskItem task,
        TaskItemStatus previousStatus,
        bool statusChanged,
        bool progressChanged,
        int? previousProgressPercentage,
        string? previousProgressNote,
        string? changeReason)
    {
        if (
            task.Status ==
            TaskItemStatus.PartiallyCompleted)
        {
            return new WorkflowNotification(
                "إنجاز جزئي لمهمة",
                $"المهمة \"{task.Title}\" أصبحت مكتملة بنسبة {task.ProgressPercentage}%. التقدم: {task.ProgressNote}",
                "task.partially_completed");
        }


        if (
            statusChanged &&
            task.Status ==
                TaskItemStatus.Done)
        {
            return new WorkflowNotification(
                "اكتملت مهمة",
                $"اكتملت المهمة \"{task.Title}\".",
                "task.completed");
        }


        if (
            statusChanged &&
            task.Status ==
                TaskItemStatus.Cancelled)
        {
            return new WorkflowNotification(
                "أُلغيت مهمة",
                $"أُلغيت المهمة \"{task.Title}\".",
                "task.cancelled");
        }


        if (
            statusChanged &&
            RequiresChangeReason(
                previousStatus,
                task.Status))
        {
            var reasonPart =
                string.IsNullOrWhiteSpace(
                    changeReason)
                    ? string.Empty
                    : $" السبب: {changeReason}";


            return new WorkflowNotification(
                "أُعيد فتح مهمة",
                $"تغيّرت المهمة \"{task.Title}\" من {NotificationCopy.Status(GetStatusResponseName(previousStatus))} إلى {NotificationCopy.Status(GetStatusResponseName(task.Status))}.{reasonPart}",
                "task.reopened");
        }


        if (
            progressChanged &&
            previousProgressPercentage.HasValue)
        {
            var previousNotePart =
                string.IsNullOrWhiteSpace(
                    previousProgressNote)
                    ? string.Empty
                    : $" التقدم السابق: {previousProgressNote}.";


            return new WorkflowNotification(
                "تحديث تقدم مهمة",
                $"تغيّر تقدم المهمة \"{task.Title}\" من {previousProgressPercentage}% إلى {task.ProgressPercentage}%.{previousNotePart}",
                "task.progress_updated");
        }


        return new WorkflowNotification(
            "تغيّرت حالة مهمة",
            $"تغيّرت حالة المهمة \"{task.Title}\" من {NotificationCopy.Status(GetStatusResponseName(previousStatus))} إلى {NotificationCopy.Status(GetStatusResponseName(task.Status))}.",
            "task.status_changed");
    }


    private sealed record WorkflowNotification(
        string Title,
        string Message,
        string Type);


    /* =========================================================
       LOG
       ========================================================= */

    private static string BuildStatusLogDescription(
        string taskTitle,
        TaskItemStatus previousStatus,
        TaskItemStatus currentStatus,
        string? changeReason)
    {
        var description =
            $"Changed task status from {GetStatusResponseName(previousStatus)} to {GetStatusResponseName(currentStatus)}: {taskTitle}";


        if (
            !string.IsNullOrWhiteSpace(
                changeReason))
        {
            description +=
                $". Reason: {changeReason}";
        }


        return description;
    }


    private static string BuildProgressLogDescription(
        int? progressPercentage,
        string? progressNote)
    {
        var percentage =
            progressPercentage ?? 0;


        if (
            string.IsNullOrWhiteSpace(
                progressNote))
        {
            return
                $"Recorded task progress at {percentage}%.";
        }


        return
            $"Recorded task progress at {percentage}%. Progress note: {progressNote}";
    }


    /* =========================================================
       DETAILS NOTIFICATION
       ========================================================= */

    private static string GetTaskDetailsNotificationTitle(
        bool priorityChanged,
        bool dueDateChanged)
    {
        if (
            priorityChanged &&
            dueDateChanged)
        {
            return "تغيّرت تفاصيل مهمة";
        }


        return priorityChanged
            ? "تغيّرت أولوية مهمة"
            : "تغيّر موعد مهمة";
    }


    private static string GetTaskDetailsNotificationType(
        bool priorityChanged,
        bool dueDateChanged)
    {
        if (
            priorityChanged &&
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
                $"تغيرت الأولوية من {NotificationCopy.Priority(previousPriority)} إلى {NotificationCopy.Priority(currentPriority)}");
        }


        if (dueDateChanged)
        {
            changes.Add(
                $"تغيّر الموعد من {FormatDueDate(previousDueDate)} إلى {FormatDueDate(currentDueDate)}");
        }


        return
            $"تم تحديث المهمة \"{taskTitle}\": {string.Join("؛ ", changes)}.";
    }


    /* =========================================================
       DATES
       ========================================================= */

    private static string FormatDueDate(
        DateTime? dueDate)
    {
        if (!dueDate.HasValue)
        {
            return "no due date";
        }


        var utcDueDate =
            AsUtc(
                dueDate.Value);


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


    /* =========================================================
       STATUS NAME
       ========================================================= */

    private static string GetStatusResponseName(
        TaskItemStatus status)
    {
        return status switch
        {
            TaskItemStatus.Todo =>
                "Todo",

            TaskItemStatus.InProgress =>
                "InProgress",

            TaskItemStatus.PartiallyCompleted =>
                "PartiallyCompleted",

            TaskItemStatus.Done =>
                "Done",

            TaskItemStatus.Cancelled =>
                "Cancelled",

            _ =>
                status.ToString()
        };
    }


    /* =========================================================
       NORMALIZATION
       ========================================================= */

    private static string? NormalizeOptionalText(
        string? value)
    {
        if (
            string.IsNullOrWhiteSpace(
                value))
        {
            return null;
        }


        return value.Trim();
    }


    /* =========================================================
       RESPONSE
       ========================================================= */

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
                GetStatusResponseName(
                    task.Status),

            Priority =
                task.Priority
                    .ToString(),

            DueDate =
                NormalizeDueDate(
                    task.DueDate),

            Position =
                task.Position,

            CreatedByUserId =
                task.CreatedByUserId,

            ProgressPercentage =
                task.ProgressPercentage,

            ProgressNote =
                task.ProgressNote,

            ProgressUpdatedAt =
                task.ProgressUpdatedAt
                    .HasValue
                    ? AsUtc(
                        task.ProgressUpdatedAt
                            .Value)
                    : null,

            CreatedAt =
                AsUtc(
                    task.CreatedAt),

            UpdatedAt =
                task.UpdatedAt
                    .HasValue
                    ? AsUtc(
                        task.UpdatedAt
                            .Value)
                    : null
        };
    }
}