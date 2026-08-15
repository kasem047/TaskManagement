using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Notifications;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class NotificationService
    : INotificationService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly INotificationRealtimeService _notificationRealtimeService;

    public NotificationService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        INotificationRealtimeService notificationRealtimeService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _notificationRealtimeService =
            notificationRealtimeService;
    }

    public async Task<List<NotificationResponse>>
        GetMyNotificationsAsync()
    {
        var currentUserId =
            _currentUserService.UserId;

        var notifications =
            await _dbContext.Notifications
                .AsNoTracking()
                .Include(notification =>
                    notification.ActorUser)
                .Where(notification =>
                    notification.UserId == currentUserId &&
                    !notification.IsDeleted)
                .OrderByDescending(notification =>
                    notification.CreatedAt)
                .ThenByDescending(notification =>
                    notification.Id)
                .ToListAsync();

        return notifications
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<int> GetUnreadCountAsync()
    {
        var currentUserId =
            _currentUserService.UserId;

        return await _dbContext.Notifications
            .CountAsync(notification =>
                notification.UserId == currentUserId &&
                !notification.IsRead &&
                !notification.IsDeleted);
    }

    public async Task MarkAsReadAsync(
        int notificationId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var notification =
            await _dbContext.Notifications
                .FirstOrDefaultAsync(notification =>
                    notification.Id == notificationId &&
                    notification.UserId == currentUserId &&
                    !notification.IsDeleted);

        if (notification is null)
        {
            throw new NotFoundException(
                "Notification not found.");
        }

        if (notification.IsRead)
        {
            return;
        }

        var now = DateTime.UtcNow;

        notification.IsRead = true;
        notification.ReadAt = now;
        notification.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync()
    {
        var currentUserId =
            _currentUserService.UserId;

        var notifications =
            await _dbContext.Notifications
                .Where(notification =>
                    notification.UserId == currentUserId &&
                    !notification.IsRead &&
                    !notification.IsDeleted)
                .ToListAsync();

        if (notifications.Count == 0)
        {
            return;
        }

        var now = DateTime.UtcNow;

        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
            notification.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync();
    }

    public async Task SendManualAsync(
        ManualNotificationRequest request)
    {
        var senderUserId =
            _currentUserService.UserId;

        var sender =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id == senderUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (sender is null)
        {
            throw new UnauthorizedException(
                "Sender account is not available.");
        }

        var recipientUserIds =
            request.RecipientUserIds
                .Where(userId =>
                    userId > 0 &&
                    userId != senderUserId)
                .Distinct()
                .ToList();

        if (recipientUserIds.Count == 0)
        {
            throw new BadRequestException(
                "At least one valid recipient is required.");
        }

        await EnsureRecipientsExistAsync(
            recipientUserIds);

        if (sender.IsSystemAdmin)
        {
            if (request.WorkspaceId.HasValue)
            {
                await EnsureWorkspaceRecipientsAsync(
                    request.WorkspaceId.Value,
                    recipientUserIds);
            }

            await CreateManyAsync(
                recipientUserIds,
                request.WorkspaceId,
                request.Title,
                request.Message,
                "manual.notification");

            return;
        }

        if (!request.WorkspaceId.HasValue)
        {
            throw new BadRequestException(
                "WorkspaceId is required for workspace notifications.");
        }

        var workspaceId =
            request.WorkspaceId.Value;

        var workspaceExists =
            await _dbContext.Workspaces
                .AsNoTracking()
                .AnyAsync(workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var senderMembership =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == senderUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (senderMembership is null)
        {
            throw new ForbiddenException(
                "You do not have access to this workspace.");
        }

        if (senderMembership.Role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            await EnsureOwnerRecipientsAsync(
                workspaceId,
                recipientUserIds);
        }
        else if (senderMembership.Role.Name ==
                 SystemRoles.ProjectManager)
        {
            await EnsureProjectManagerRecipientsAsync(
                workspaceId,
                senderUserId,
                recipientUserIds);
        }
        else
        {
            throw new ForbiddenException(
                "Members cannot send administrative notifications.");
        }

        await CreateManyAsync(
            recipientUserIds,
            workspaceId,
            request.Title,
            request.Message,
            "manual.notification");
    }

    public async Task CreateAsync(
        int userId,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null)
    {
        await CreateManyAsync(
            new[] { userId },
            workspaceId,
            title,
            message,
            type,
            entityName,
            entityId);
    }

    public async Task CreateManyAsync(
        IEnumerable<int> userIds,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null)
    {
        ArgumentNullException.ThrowIfNull(userIds);

        var actorUserId =
            _currentUserService.UserId;

        var recipientUserIds = userIds
            .Where(userId =>
                userId > 0 &&
                userId != actorUserId)
            .Distinct()
            .ToList();

        if (recipientUserIds.Count == 0)
        {
            return;
        }

        var actorUser =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id == actorUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (actorUser is null)
        {
            throw new UnauthorizedException(
                "Notification actor account is not available.");
        }

        if (workspaceId.HasValue)
        {
            var workspaceExists =
                await _dbContext.Workspaces
                    .AnyAsync(workspace =>
                        workspace.Id == workspaceId.Value &&
                        !workspace.IsDeleted);

            if (!workspaceExists)
            {
                throw new NotFoundException(
                    "Workspace not found.");
            }
        }

        var activeRecipientUserIds =
            await _dbContext.Users
                .AsNoTracking()
                .Where(user =>
                    recipientUserIds.Contains(user.Id) &&
                    user.IsActive &&
                    !user.IsDeleted)
                .Select(user =>
                    user.Id)
                .ToListAsync();

        if (activeRecipientUserIds.Count == 0)
        {
            return;
        }

        var normalizedTitle =
            NormalizeRequiredText(
                title,
                "Notification title");

        var normalizedMessage =
            NormalizeRequiredText(
                message,
                "Notification message");

        var normalizedType =
            NormalizeRequiredText(
                type,
                "Notification type");

        var normalizedEntityName =
            string.IsNullOrWhiteSpace(entityName)
                ? null
                : entityName.Trim();

        var now =
            DateTime.UtcNow;

        var notifications =
            activeRecipientUserIds
                .Select(userId =>
                    new Notification
                    {
                        UserId = userId,
                        ActorUserId = actorUserId,
                        WorkspaceId = workspaceId,
                        Title = normalizedTitle,
                        Message = normalizedMessage,
                        Type = normalizedType,
                        EntityName = normalizedEntityName,
                        EntityId = entityId,
                        IsRead = false,
                        CreatedAt = now
                    })
                .ToList();

        _dbContext.Notifications.AddRange(
            notifications);

        await _dbContext.SaveChangesAsync();

        foreach (var notification in notifications)
        {
            var realtimeNotification =
                new NotificationResponse
                {
                    Id = notification.Id,
                    UserId = notification.UserId,
                    ActorUserId =
                        notification.ActorUserId,
                    ActorUserFullName =
                        actorUser.FullName,
                    WorkspaceId =
                        notification.WorkspaceId,
                    Title = notification.Title,
                    Message = notification.Message,
                    Type = notification.Type,
                    EntityName =
                        notification.EntityName,
                    EntityId =
                        notification.EntityId,
                    IsRead =
                        notification.IsRead,
                    ReadAt =
                        notification.ReadAt,
                    CreatedAt =
                        notification.CreatedAt
                };

            await _notificationRealtimeService
                .SendToUserAsync(
                    notification.UserId,
                    realtimeNotification);
        }
    }

    public async Task CreateSystemManyAsync(
        IEnumerable<int> userIds,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null)
    {
        ArgumentNullException.ThrowIfNull(userIds);

        var recipientUserIds =
            userIds
                .Where(userId =>
                    userId > 0)
                .Distinct()
                .ToList();

        if (recipientUserIds.Count == 0)
        {
            return;
        }

        if (workspaceId.HasValue)
        {
            var workspaceExists =
                await _dbContext.Workspaces
                    .AsNoTracking()
                    .AnyAsync(workspace =>
                        workspace.Id ==
                            workspaceId.Value &&
                        !workspace.IsDeleted);

            if (!workspaceExists)
            {
                return;
            }
        }

        var activeRecipientUserIds =
            await _dbContext.Users
                .AsNoTracking()
                .Where(user =>
                    recipientUserIds.Contains(
                        user.Id) &&
                    user.IsActive &&
                    !user.IsDeleted)
                .Select(user =>
                    user.Id)
                .ToListAsync();

        if (activeRecipientUserIds.Count == 0)
        {
            return;
        }

        var normalizedTitle =
            NormalizeRequiredText(
                title,
                "Notification title");

        var normalizedMessage =
            NormalizeRequiredText(
                message,
                "Notification message");

        var normalizedType =
            NormalizeRequiredText(
                type,
                "Notification type");

        var normalizedEntityName =
            string.IsNullOrWhiteSpace(entityName)
                ? null
                : entityName.Trim();

        var now =
            DateTime.UtcNow;

        var notifications =
            activeRecipientUserIds
                .Select(userId =>
                    new Notification
                    {
                        UserId = userId,
                        ActorUserId = null,
                        WorkspaceId = workspaceId,
                        Title = normalizedTitle,
                        Message = normalizedMessage,
                        Type = normalizedType,
                        EntityName = normalizedEntityName,
                        EntityId = entityId,
                        IsRead = false,
                        CreatedAt = now
                    })
                .ToList();

        _dbContext.Notifications.AddRange(
            notifications);

        await _dbContext.SaveChangesAsync();

        foreach (var notification in notifications)
        {
            var realtimeNotification =
                new NotificationResponse
                {
                    Id = notification.Id,
                    UserId = notification.UserId,
                    ActorUserId = null,
                    ActorUserFullName = "System",
                    WorkspaceId =
                        notification.WorkspaceId,
                    Title = notification.Title,
                    Message = notification.Message,
                    Type = notification.Type,
                    EntityName =
                        notification.EntityName,
                    EntityId =
                        notification.EntityId,
                    IsRead = false,
                    ReadAt = null,
                    CreatedAt =
                        notification.CreatedAt
                };

            await _notificationRealtimeService
                .SendToUserAsync(
                    notification.UserId,
                    realtimeNotification);
        }
    }

    private async Task EnsureRecipientsExistAsync(
        IReadOnlyCollection<int> recipientUserIds)
    {
        var existingRecipientCount =
            await _dbContext.Users
                .AsNoTracking()
                .CountAsync(user =>
                    recipientUserIds.Contains(user.Id) &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (existingRecipientCount !=
            recipientUserIds.Count)
        {
            throw new BadRequestException(
                "One or more recipients were not found or are inactive.");
        }
    }

    private async Task EnsureWorkspaceRecipientsAsync(
        int workspaceId,
        IReadOnlyCollection<int> recipientUserIds)
    {
        var workspaceExists =
            await _dbContext.Workspaces
                .AsNoTracking()
                .AnyAsync(workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var workspaceRecipientCount =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .CountAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    recipientUserIds.Contains(
                        member.UserId) &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (workspaceRecipientCount !=
            recipientUserIds.Count)
        {
            throw new ForbiddenException(
                "One or more recipients are not active members of this workspace.");
        }
    }

    private async Task EnsureOwnerRecipientsAsync(
        int workspaceId,
        IReadOnlyCollection<int> recipientUserIds)
    {
        var allowedRecipientCount =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.Role)
                .CountAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    recipientUserIds.Contains(
                        member.UserId) &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    (
                        member.Role.Name ==
                            SystemRoles.ProjectManager ||
                        member.Role.Name ==
                            SystemRoles.Member
                    ));

        if (allowedRecipientCount !=
            recipientUserIds.Count)
        {
            throw new ForbiddenException(
                "Workspace owner can only notify ProjectManagers and Members in this workspace.");
        }
    }

    private async Task EnsureProjectManagerRecipientsAsync(
        int workspaceId,
        int projectManagerUserId,
        IReadOnlyCollection<int> recipientUserIds)
    {
        var allowedRecipientUserIds =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .Where(assignment =>
                    !assignment.IsDeleted &&
                    recipientUserIds.Contains(
                        assignment.UserId) &&
                    !assignment.TaskItem.IsDeleted &&
                    !assignment.TaskItem.Project.IsDeleted &&
                    !assignment.TaskItem.Project.IsArchived &&
                    assignment.TaskItem.Project.WorkspaceId ==
                        workspaceId &&
                    assignment.TaskItem.Project.ManagerUserId ==
                        projectManagerUserId)
                .Select(assignment =>
                    assignment.UserId)
                .Distinct()
                .ToListAsync();

        var memberRecipientUserIds =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.Role)
                .Where(member =>
                    member.WorkspaceId == workspaceId &&
                    recipientUserIds.Contains(
                        member.UserId) &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.Member)
                .Select(member =>
                    member.UserId)
                .ToListAsync();

        var allowedUserIds =
            allowedRecipientUserIds
                .Intersect(memberRecipientUserIds)
                .ToHashSet();

        if (allowedUserIds.Count !=
            recipientUserIds.Count)
        {
            throw new ForbiddenException(
                "ProjectManager can only notify Members assigned to tasks in projects they manage.");
        }
    }

    private static string NormalizeRequiredText(
        string value,
        string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new BadRequestException(
                $"{fieldName} cannot be empty.");
        }

        return value.Trim();
    }

    private static NotificationResponse MapToResponse(
        Notification notification)
    {
        return new NotificationResponse
        {
            Id = notification.Id,
            UserId = notification.UserId,
            ActorUserId = notification.ActorUserId,
            ActorUserFullName =
                notification.ActorUser?.FullName ??
                "System",
            WorkspaceId = notification.WorkspaceId,
            Title = notification.Title,
            Message = notification.Message,
            Type = notification.Type,
            EntityName = notification.EntityName,
            EntityId = notification.EntityId,
            IsRead = notification.IsRead,
            ReadAt = notification.ReadAt,
            CreatedAt = notification.CreatedAt
        };
    }
}