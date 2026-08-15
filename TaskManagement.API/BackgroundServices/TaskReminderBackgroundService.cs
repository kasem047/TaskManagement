using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.API.BackgroundServices;

public sealed class TaskReminderBackgroundService
    : BackgroundService
{
    private readonly IServiceScopeFactory
        _serviceScopeFactory;

    private readonly ILogger<TaskReminderBackgroundService>
        _logger;

    public TaskReminderBackgroundService(
        IServiceScopeFactory serviceScopeFactory,
        ILogger<TaskReminderBackgroundService> logger)
    {
        _serviceScopeFactory =
            serviceScopeFactory;

        _logger =
            logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        try
        {
            await ProcessRemindersAsync(
                stoppingToken);
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "An error occurred while processing task reminders.");
        }

        using var timer =
            new PeriodicTimer(
                TimeSpan.FromMinutes(1));

        while (await timer.WaitForNextTickAsync(
                   stoppingToken))
        {
            try
            {
                await ProcessRemindersAsync(
                    stoppingToken);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "An error occurred while processing task reminders.");
            }
        }
    }

    private async Task ProcessRemindersAsync(
        CancellationToken cancellationToken)
    {
        using var scope =
            _serviceScopeFactory.CreateScope();

        var dbContext =
            scope.ServiceProvider
                .GetRequiredService<
                    IApplicationDbContext>();

        var notificationService =
            scope.ServiceProvider
                .GetRequiredService<
                    INotificationService>();

        var now =
            DateTime.UtcNow;

        var tasks =
            await dbContext.TaskItems
                .AsNoTracking()
                .Include(task =>
                    task.Project)
                .Include(task =>
                    task.TaskAssignees)
                .Where(task =>
                    !task.IsDeleted &&
                    task.DueDate.HasValue &&
                    task.Status !=
                        TaskItemStatus.Done &&
                    task.Status !=
                        TaskItemStatus.Cancelled &&
                    !task.Project.IsDeleted &&
                    !task.Project.IsArchived)
                .ToListAsync(
                    cancellationToken);

        foreach (var task in tasks)
        {
            var dueDate =
                AsUtc(
                    task.DueDate!.Value);

            var createdAt =
                AsUtc(
                    task.CreatedAt);

            if (dueDate <= createdAt)
            {
                continue;
            }

            var reminderType =
                GetCurrentReminderType(
                    createdAt,
                    dueDate,
                    now);

            if (!reminderType.HasValue)
            {
                continue;
            }

            var reminderAlreadyProcessed =
                await dbContext.TaskReminders
                    .AsNoTracking()
                    .AnyAsync(reminder =>
                        reminder.TaskItemId ==
                            task.Id &&
                        reminder.Type ==
                            reminderType.Value &&
                        reminder.DueDateSnapshot ==
                            dueDate &&
                        !reminder.IsDeleted,
                        cancellationToken);

            if (reminderAlreadyProcessed)
            {
                continue;
            }

            var recipientUserIds =
                task.TaskAssignees
                    .Where(assignment =>
                        !assignment.IsDeleted)
                    .Select(assignment =>
                        assignment.UserId)
                    .ToHashSet();

            if (task.Project.ManagerUserId.HasValue)
            {
                recipientUserIds.Add(
                    task.Project.ManagerUserId.Value);
            }

            if (recipientUserIds.Count == 0)
            {
                continue;
            }

            var notificationData =
                BuildNotification(
                    task,
                    reminderType.Value,
                    dueDate);

            await notificationService
                .CreateSystemManyAsync(
                    recipientUserIds,
                    task.Project.WorkspaceId,
                    notificationData.Title,
                    notificationData.Message,
                    notificationData.Type,
                    nameof(TaskItem),
                    task.Id);

            var processedReminder =
                new TaskReminder
                {
                    TaskItemId = task.Id,
                    Type = reminderType.Value,
                    DueDateSnapshot = dueDate,
                    SentAt = now,
                    CreatedAt = now
                };

            dbContext.TaskReminders.Add(
                processedReminder);

            await dbContext.SaveChangesAsync(
                cancellationToken);
        }
    }

    private static TaskReminderType?
        GetCurrentReminderType(
            DateTime createdAt,
            DateTime dueDate,
            DateTime now)
    {
        if (now >= dueDate)
        {
            return TaskReminderType.Overdue;
        }

        var oneHourBefore =
            dueDate.AddHours(-1);

        if (oneHourBefore > createdAt &&
            now >= oneHourBefore)
        {
            return TaskReminderType.OneHourBefore;
        }

        var oneDayBefore =
            dueDate.AddDays(-1);

        if (oneDayBefore > createdAt &&
            now >= oneDayBefore)
        {
            return TaskReminderType.OneDayBefore;
        }

        var totalDuration =
            dueDate - createdAt;

        var halfway =
            createdAt.AddTicks(
                totalDuration.Ticks / 2);

        if (now >= halfway)
        {
            return TaskReminderType.Halfway;
        }

        return null;
    }

    private static (
        string Title,
        string Message,
        string Type)
        BuildNotification(
            TaskItem task,
            TaskReminderType reminderType,
            DateTime dueDate)
    {
        var formattedDueDate =
            dueDate.ToString(
                "yyyy-MM-dd HH:mm 'UTC'",
                System.Globalization.CultureInfo.InvariantCulture);

        return reminderType switch
        {
            TaskReminderType.Halfway =>
                (
                    "Task halfway reminder",
                    $"Half of the available time for task \"{task.Title}\" has passed. Due: {formattedDueDate}.",
                    "task.reminder.halfway"
                ),

            TaskReminderType.OneDayBefore =>
                (
                    "Task due tomorrow",
                    $"Task \"{task.Title}\" is due within 24 hours. Due: {formattedDueDate}.",
                    "task.reminder.one_day"
                ),

            TaskReminderType.OneHourBefore =>
                (
                    "Task due soon",
                    $"Task \"{task.Title}\" is due within one hour. Due: {formattedDueDate}.",
                    "task.reminder.one_hour"
                ),

            TaskReminderType.Overdue =>
                (
                    "Task overdue",
                    $"Task \"{task.Title}\" is overdue. Due date was {formattedDueDate}.",
                    "task.reminder.overdue"
                ),

            _ =>
                throw new ArgumentOutOfRangeException(
                    nameof(reminderType))
        };
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
}