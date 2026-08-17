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


    /* =========================================================
       GET TASKS
       ========================================================= */

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

        var tasks =
            await _dbContext.TaskItems
                .AsNoTracking()
                .Where(task =>
                    task.ProjectId == projectId &&
                    !task.IsDeleted)
                .OrderBy(task =>
                    task.Status)
                .ThenBy(task =>
                    task.Position)
                .ThenBy(task =>
                    task.CreatedAt)
                .ToListAsync();

        return tasks
            .Select(MapToResponse)
            .ToList();
    }


    /* =========================================================
       GET TASK BY ID
       ========================================================= */

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

        var task =
            await GetTaskAsync(
                projectId,
                taskId);

        return MapToResponse(
            task);
    }


    /* =========================================================
       CREATE TASK
       ========================================================= */

    public async Task<TaskResponse> CreateTaskAsync(
        int workspaceId,
        int projectId,
        CreateTaskRequest request)
    {
        var project =
            await GetActiveProjectAsync(
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
            await _dbContext.TaskItems
                .AnyAsync(task =>
                    task.ProjectId == projectId &&
                    !task.IsDeleted &&
                    task.Title == normalizedTitle);

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
            await _dbContext.TaskItems
                .Where(task =>
                    task.ProjectId == projectId &&
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

                /*
                 * المهمة الجديدة لا تحتوي
                 * على Progress بعد.
                 */
                ProgressPercentage =
                    null,

                ProgressNote =
                    null,

                ProgressUpdatedAt =
                    null,

                CreatedAt =
                    now
            };

        _dbContext.TaskItems.Add(
            task);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.created",
            nameof(TaskItem),
            task.Id,
            $"Created task: {task.Title}");

        return MapToResponse(
            task);
    }


    /* =========================================================
       UPDATE TASK DETAILS
       ========================================================= */

    public async Task<TaskResponse> UpdateTaskAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskRequest request)
    {
        var project =
            await GetActiveProjectAsync(
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

        var task =
            await GetTaskAsync(
                projectId,
                taskId);

        var normalizedTitle =
            request.Title.Trim();

        var duplicateTitleExists =
            await _dbContext.TaskItems
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

        /*
         * مهمة قديمة ومتأخرة يمكن تعديلها،
         * لكن لا يمكن تغيير موعدها إلى
         * تاريخ جديد موجود أصلًا في الماضي.
         */
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

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "task.updated",
            nameof(TaskItem),
            task.Id,
            $"Updated task details: {task.Title}");

        if (
            priorityChanged ||
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

        return MapToResponse(
            task);
    }


    /* =========================================================
       UPDATE STATUS / PROGRESS / POSITION
       ========================================================= */

    public async Task<TaskResponse> UpdateTaskStatusAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskStatusRequest request)
    {
        var project =
            await GetActiveProjectAsync(
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

        /*
         * التحقق من بيانات الإنجاز الجزئي
         * على مستوى Service أيضًا.
         *
         * هذا مهم حتى لو تم استدعاء Service
         * من Test أو Service آخر بدون المرور
         * عبر Model Validation في Controller.
         */
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

        /*
         * إذا لم يتغير شيء نهائيًا
         * لا يوجد داعي للـSave.
         */
        if (
            !statusChanged &&
            !positionChanged &&
            !progressChanged)
        {
            return MapToResponse(
                task);
        }

        /*
         * التحقق من Workflow:
         *
         * - المدير/المالك أو صاحب صلاحية
         *   إدارة تفاصيل المهمة يستطيع التحكم
         *   الكامل بالـWorkflow.
         *
         * - العضو العادي يجب أن يكون
         *   مسندًا للمهمة.
         *
         * - العضو يتحرك للأمام فقط.
         */
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

        /*
         * ===========================
         * PARTIALLY COMPLETED
         * ===========================
         */
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

        /*
         * ===========================
         * DONE
         * ===========================
         *
         * عند اكتمال المهمة يصبح
         * Progress = 100 حقيقيًا.
         */
        else if (
            request.Status ==
            TaskItemStatus.Done)
        {
            task.ProgressPercentage =
                100;

            /*
             * إذا كان هناك ProgressNote سابق
             * نحتفظ به لأنه يوثق ما تم إنجازه.
             */

            task.ProgressUpdatedAt =
                now;
        }

        /*
         * ===========================
         * BACK TO ACTIVE WORK
         * ===========================
         *
         * إذا أعاد المدير المهمة من:
         *
         * PartiallyCompleted / Done
         *
         * إلى:
         *
         * Todo / InProgress
         *
         * نمسح الـProgress الحالي.
         *
         * التاريخ السابق لا يضيع لأنه
         * محفوظ في ActivityLog.
         */
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

        /*
         * في Cancelled:
         *
         * لا نمسح نسبة الإنجاز السابقة
         * إن كانت موجودة، لأنها قد تكون
         * معلومة تاريخية مفيدة.
         */

        task.Status =
            request.Status;

        task.Position =
            request.Position;

        task.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();


        /* =====================================================
           STATUS LOG
           ===================================================== */

        if (statusChanged)
        {
            var statusLogDescription =
                BuildStatusLogDescription(
                    task.Title,
                    previousStatus,
                    task.Status,
                    normalizedChangeReason);

            await _activityLogService.LogAsync(
                workspaceId,
                "task.status_changed",
                nameof(TaskItem),
                task.Id,
                statusLogDescription);
        }


        /* =====================================================
           PROGRESS LOG
           ===================================================== */

        if (
            request.Status ==
                TaskItemStatus.PartiallyCompleted &&
            (
                statusChanged ||
                progressChanged
            ))
        {
            await _activityLogService.LogAsync(
                workspaceId,
                "task.progress_updated",
                nameof(TaskItem),
                task.Id,
                BuildProgressLogDescription(
                    task.ProgressPercentage,
                    task.ProgressNote));
        }


        /* =====================================================
           POSITION LOG
           ===================================================== */

        if (
            positionChanged &&
            !statusChanged)
        {
            await _activityLogService.LogAsync(
                workspaceId,
                "task.position_changed",
                nameof(TaskItem),
                task.Id,
                $"Changed task position from {previousPosition} to {task.Position}: {task.Title}");
        }


        /* =====================================================
           NOTIFICATIONS
           ===================================================== */

        if (
            statusChanged ||
            progressChanged)
        {
            var notificationRecipientUserIds =
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

            await _notificationService.CreateManyAsync(
                notificationRecipientUserIds,
                workspaceId,
                notification.Title,
                notification.Message,
                notification.Type,
                nameof(TaskItem),
                task.Id);
        }

        return MapToResponse(
            task);
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

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskDelete);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Tasks in archived projects cannot be deleted.");
        }

        var task =
            await GetTaskAsync(
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


    /* =========================================================
       WORKFLOW AUTHORIZATION
       ========================================================= */

    private async Task EnsureWorkflowChangeAllowedAsync(
        int workspaceId,
        TaskItem task,
        TaskItemStatus requestedStatus,
        bool statusChanged,
        bool positionChanged,
        bool progressChanged,
        string? changeReason)
    {
        /*
         * نعتمد الصلاحيات الفعلية بدل الاعتماد
         * على اسم Role فقط.
         *
         * من يستطيع تعديل تفاصيل المهمة
         * نعتبره صاحب صلاحية إدارة Workflow.
         *
         * هذا يشمل عادة:
         *
         * ProjectManager
         * WorkspaceOwner
         *
         * كما يحترم User Permission Overrides.
         */
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


        /*
         * المستخدم العادي يجب أن يكون
         * مسؤولًا عن المهمة أصلًا.
         */
        var currentUserAssigned =
            await IsCurrentUserAssignedAsync(
                task.Id);

        if (!currentUserAssigned)
        {
            throw new ForbiddenException(
                "You can only update the workflow of tasks assigned to you.");
        }


        /*
         * العضو لا يستطيع تعديل مهمة
         * منتهية أو ملغاة.
         */
        if (
            task.Status ==
                TaskItemStatus.Done ||
            task.Status ==
                TaskItemStatus.Cancelled)
        {
            throw new ForbiddenException(
                "Completed or cancelled tasks cannot be changed by an assigned member.");
        }


        /*
         * تغيير ترتيب أو تحديث Progress
         * داخل نفس الحالة مسموح للمسؤول
         * عن المهمة ما دامت ليست Final.
         */
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


        /*
         * Member Workflow:
         *
         * Todo
         *    -> InProgress
         *
         * InProgress
         *    -> PartiallyCompleted
         *    -> Done
         *
         * PartiallyCompleted
         *    -> Done
         *
         * لا رجوع للخلف.
         * لا إلغاء.
         */
        if (
            !IsValidMemberStatusTransition(
                task.Status,
                requestedStatus))
        {
            throw new ConflictException(
                $"Invalid task status transition from {GetStatusResponseName(task.Status)} to {GetStatusResponseName(requestedStatus)} for an assigned member.");
        }
    }


    /*
     * صاحب صلاحية TaskDetailsUpdate
     * يعتبر قادرًا على إدارة Workflow.
     *
     * استعمال Permission وليس Role Name
     * يجعل User Overrides تعمل أيضًا.
     */
    private async Task<bool> CanManageTaskWorkflowAsync(
        int workspaceId)
    {
        try
        {
            await _permissionService.EnsurePermissionAsync(
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

        return await _dbContext.TaskAssignees
            .AsNoTracking()
            .AnyAsync(assignment =>
                assignment.TaskItemId ==
                    taskId &&
                assignment.UserId ==
                    currentUserId &&
                !assignment.IsDeleted);
    }


    /*
     * Member فقط.
     */
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


    /*
     * مدير المشروع / مالك مساحة العمل
     * يستطيع الرجوع بالحالات.
     *
     * لكن يجب كتابة سبب في الحالات التالية:
     *
     * PartiallyCompleted -> InProgress
     * Done               -> InProgress
     * Done               -> Todo
     * Cancelled          -> Active
     * وغيرها من عمليات الرجوع.
     */
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

        if (
            currentRank.HasValue &&
            newRank.HasValue &&
            newRank.Value <
                currentRank.Value)
        {
            return true;
        }

        return false;
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
            !request.ProgressPercentage.HasValue)
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
    }


    private async Task<Project> GetActiveProjectAsync(
        int workspaceId,
        int projectId)
    {
        var project =
            await _dbContext.Projects
                .FirstOrDefaultAsync(project =>
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
            await _dbContext.TaskItems
                .FirstOrDefaultAsync(task =>
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
        var assigneeUserIds =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .Where(assignment =>
                    assignment.TaskItemId ==
                        taskId &&
                    !assignment.IsDeleted)
                .Select(assignment =>
                    assignment.UserId)
                .ToListAsync();

        var recipientUserIds =
            assigneeUserIds
                .ToHashSet();

        if (managerUserId.HasValue)
        {
            recipientUserIds.Add(
                managerUserId.Value);
        }

        return recipientUserIds;
    }


    /* =========================================================
       WORKFLOW NOTIFICATION
       ========================================================= */

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
                "Task partially completed",
                $"Task \"{task.Title}\" is now {task.ProgressPercentage}% complete. Progress: {task.ProgressNote}",
                "task.partially_completed");
        }

        if (
            statusChanged &&
            task.Status ==
            TaskItemStatus.Done)
        {
            return new WorkflowNotification(
                "Task completed",
                $"Task \"{task.Title}\" was completed.",
                "task.completed");
        }

        if (
            statusChanged &&
            task.Status ==
            TaskItemStatus.Cancelled)
        {
            return new WorkflowNotification(
                "Task cancelled",
                $"Task \"{task.Title}\" was cancelled.",
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
                    : $" Reason: {changeReason}";

            return new WorkflowNotification(
                "Task reopened or returned",
                $"Task \"{task.Title}\" changed from {GetStatusResponseName(previousStatus)} to {GetStatusResponseName(task.Status)}.{reasonPart}",
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
                    : $" Previous progress: {previousProgressNote}.";

            return new WorkflowNotification(
                "Task progress updated",
                $"Task \"{task.Title}\" progress changed from {previousProgressPercentage}% to {task.ProgressPercentage}%.{previousNotePart}",
                "task.progress_updated");
        }

        return new WorkflowNotification(
            "Task status changed",
            $"Task \"{task.Title}\" status changed from {GetStatusResponseName(previousStatus)} to {GetStatusResponseName(task.Status)}.",
            "task.status_changed");
    }


    private sealed record WorkflowNotification(
        string Title,
        string Message,
        string Type);


    /* =========================================================
       ACTIVITY LOG DESCRIPTIONS
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
       DETAILS NOTIFICATIONS
       ========================================================= */

    private static string GetTaskDetailsNotificationTitle(
        bool priorityChanged,
        bool dueDateChanged)
    {
        if (
            priorityChanged &&
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
       STATUS OUTPUT
       ========================================================= */

    /*
     * لا نعتمد على Enum.ToString()
     * للقيمة 3 لأن عندنا حاليًا:
     *
     * PartiallyCompleted = 3
     * InReview = 3
     *
     * فنفرض الاسم الجديد بشكل صريح.
     */
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
       RESPONSE MAPPING
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
                task.Priority.ToString(),

            DueDate =
                NormalizeDueDate(
                    task.DueDate),

            Position =
                task.Position,

            CreatedByUserId =
                task.CreatedByUserId,


            /* =====================
               REAL PROGRESS
               ===================== */

            ProgressPercentage =
                task.ProgressPercentage,

            ProgressNote =
                task.ProgressNote,

            ProgressUpdatedAt =
                task.ProgressUpdatedAt.HasValue
                    ? AsUtc(
                        task.ProgressUpdatedAt.Value)
                    : null,


            /* =====================
               AUDIT
               ===================== */

            CreatedAt =
                AsUtc(
                    task.CreatedAt),

            UpdatedAt =
                task.UpdatedAt.HasValue
                    ? AsUtc(
                        task.UpdatedAt.Value)
                    : null
        };
    }
}