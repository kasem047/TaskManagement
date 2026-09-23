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

    /* =========================================================
       ALL NOTIFICATIONS - LEGACY
       ========================================================= */

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
                    notification.UserId ==
                        currentUserId &&
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

    /* =========================================================
       FULL PAGE - FILTERS + PAGINATION
       ========================================================= */

    public async Task<NotificationPagedResponse>
        GetMyNotificationsAsync(
            NotificationQueryRequest request)
    {
        var currentUserId =
            _currentUserService.UserId;

        if (request.From.HasValue &&
            request.To.HasValue &&
            request.From.Value >
            request.To.Value)
        {
            throw new BadRequestException(
                "From date cannot be later than To date.");
        }

        var query =
            _dbContext.Notifications
                .AsNoTracking()
                .Include(notification =>
                    notification.ActorUser)
                .Where(notification =>
                    notification.UserId ==
                        currentUserId &&
                    !notification.IsDeleted);

        if (request.IsRead.HasValue)
        {
            query =
                query.Where(notification =>
                    notification.IsRead ==
                        request.IsRead.Value);
        }

        if (request.ActorUserId.HasValue)
        {
            query =
                query.Where(notification =>
                    notification.ActorUserId ==
                        request.ActorUserId.Value);
        }

        if (request.WorkspaceId.HasValue)
        {
            query =
                query.Where(notification =>
                    notification.WorkspaceId ==
                        request.WorkspaceId.Value);
        }

        if (!string.IsNullOrWhiteSpace(
                request.Source))
        {
            var source =
                request.Source.Trim();

            query =
                query.Where(notification =>
                    notification.Type.Contains(
                        source));
        }

        if (request.From.HasValue)
        {
            query =
                query.Where(notification =>
                    notification.CreatedAt >=
                        request.From.Value);
        }

        if (request.To.HasValue)
        {
            query =
                query.Where(notification =>
                    notification.CreatedAt <=
                        request.To.Value);
        }

        var totalCount =
            await query.CountAsync();

        var totalPages =
            totalCount == 0
                ? 0
                : (int)Math.Ceiling(
                    totalCount /
                    (double)request.PageSize);

        var notifications =
            await query
                .OrderByDescending(notification =>
                    notification.CreatedAt)
                .ThenByDescending(notification =>
                    notification.Id)
                .Skip(
                    (request.Page - 1) *
                    request.PageSize)
                .Take(
                    request.PageSize)
                .ToListAsync();

        return new NotificationPagedResponse
        {
            Items =
                notifications
                    .Select(MapToResponse)
                    .ToList(),

            Page =
                request.Page,

            PageSize =
                request.PageSize,

            TotalCount =
                totalCount,

            TotalPages =
                totalPages
        };
    }

    /* =========================================================
       QUICK BELL - UNREAD ONLY
       ========================================================= */

    public async Task<List<NotificationResponse>>
        GetMyUnreadNotificationsAsync(
            int take = 8)
    {
        var currentUserId =
            _currentUserService.UserId;

        if (take < 1)
        {
            take = 1;
        }

        if (take > 20)
        {
            take = 20;
        }

        var notifications =
            await _dbContext.Notifications
                .AsNoTracking()
                .Include(notification =>
                    notification.ActorUser)
                .Where(notification =>
                    notification.UserId ==
                        currentUserId &&
                    !notification.IsRead &&
                    !notification.IsDeleted)
                .OrderByDescending(notification =>
                    notification.CreatedAt)
                .ThenByDescending(notification =>
                    notification.Id)
                .Take(take)
                .ToListAsync();

        return notifications
            .Select(MapToResponse)
            .ToList();
    }

    /* =========================================================
       UNREAD COUNT
       ========================================================= */

    public async Task<int>
        GetUnreadCountAsync()
    {
        var currentUserId =
            _currentUserService.UserId;

        return await _dbContext.Notifications
            .CountAsync(notification =>
                notification.UserId ==
                    currentUserId &&
                !notification.IsRead &&
                !notification.IsDeleted);
    }

    /* =========================================================
       ALLOWED RECIPIENTS
       ========================================================= */

    public async Task<List<NotificationRecipientResponse>>
        GetAllowedRecipientsAsync(
            int? workspaceId)
    {
        var senderUserId =
            _currentUserService.UserId;

        var sender =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id ==
                        senderUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (sender is null)
        {
            throw new UnauthorizedException(
                "Sender account is not available.");
        }

        /*
         * SystemAdmin:
         * sees every active normal user.
         *
         * WorkspaceId is not required and does not restrict
         * SystemAdmin because the global administrator may
         * send to anyone.
         */
        if (sender.IsSystemAdmin)
        {
            return await _dbContext.Users
                .AsNoTracking()
                .Where(user =>
                    user.Id != senderUserId &&
                    user.IsActive &&
                    !user.IsDeleted &&
                    !user.IsSystemAdmin)
                .OrderBy(user =>
                    user.FullName)
                .Select(user =>
                    new NotificationRecipientResponse
                    {
                        UserId =
                            user.Id,

                        FullName =
                            user.FullName,

                        Email =
                            user.Email ??
                            string.Empty,

                        WorkspaceId =
                            null,

                        WorkspaceName =
                            null,

                        RoleName =
                            null,

                        Relationship =
                            "SystemAdmin"
                    })
                .ToListAsync();
        }

        if (!workspaceId.HasValue)
        {
            return new List<
                NotificationRecipientResponse>();
        }

        var targetWorkspaceId =
            workspaceId.Value;

        var workspace =
            await _dbContext.Workspaces
                .AsNoTracking()
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id ==
                        targetWorkspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
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
                    member.WorkspaceId ==
                        targetWorkspaceId &&
                    member.UserId ==
                        senderUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (senderMembership is null)
        {
            throw new ForbiddenException(
                "You do not have access to this workspace.");
        }

        /*
         * WorkspaceOwner:
         * everyone active below the owner in this workspace.
         *
         * Custom roles are allowed here because ownership is
         * an actual relationship, not an inferred role rank.
         */
        if (senderMembership.Role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            return await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .Where(member =>
                    member.WorkspaceId ==
                        targetWorkspaceId &&
                    member.UserId !=
                        senderUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.User.IsDeleted &&
                    member.User.IsActive)
                .OrderBy(member =>
                    member.User.FullName)
                .Select(member =>
                    new NotificationRecipientResponse
                    {
                        UserId =
                            member.UserId,

                        FullName =
                            member.User.FullName,

                        Email =
                            member.User.Email ??
                            string.Empty,

                        WorkspaceId =
                            targetWorkspaceId,

                        WorkspaceName =
                            workspace.Name,

                        RoleName =
                            member.Role.Name,

                        Relationship =
                            "WorkspaceOwner"
                    })
                .ToListAsync();
        }

        /*
         * ProjectManager:
         * only users actually assigned to active tasks
         * inside projects managed by this PM.
         *
         * We do NOT infer hierarchy from recipient role name.
         */
        if (senderMembership.Role.Name ==
            SystemRoles.ProjectManager)
        {
            var recipientUserIds =
                await _dbContext.TaskAssignees
                    .AsNoTracking()
                    .Where(assignment =>
                        !assignment.IsDeleted &&
                        assignment.UserId !=
                            senderUserId &&
                        !assignment.TaskItem.IsDeleted &&
                        !assignment.TaskItem.Project.IsDeleted &&
                        !assignment.TaskItem.Project.IsArchived &&
                        assignment.TaskItem.Project.WorkspaceId ==
                            targetWorkspaceId &&
                        assignment.TaskItem.Project.ManagerUserId ==
                            senderUserId)
                    .Select(assignment =>
                        assignment.UserId)
                    .Distinct()
                    .ToListAsync();

            if (recipientUserIds.Count == 0)
            {
                return new List<
                    NotificationRecipientResponse>();
            }

            return await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .Where(member =>
                    member.WorkspaceId ==
                        targetWorkspaceId &&
                    recipientUserIds.Contains(
                        member.UserId) &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.User.IsDeleted &&
                    member.User.IsActive)
                .OrderBy(member =>
                    member.User.FullName)
                .Select(member =>
                    new NotificationRecipientResponse
                    {
                        UserId =
                            member.UserId,

                        FullName =
                            member.User.FullName,

                        Email =
                            member.User.Email ??
                            string.Empty,

                        WorkspaceId =
                            targetWorkspaceId,

                        WorkspaceName =
                            workspace.Name,

                        RoleName =
                            member.Role.Name,

                        Relationship =
                            "ProjectManager"
                    })
                .ToListAsync();
        }

        /*
         * Member / Custom Role:
         *
         * No explicit subordinate relationship currently
         * exists in the domain model, so returning users here
         * would invent a hierarchy.
         */
        return new List<
            NotificationRecipientResponse>();
    }

    /* =========================================================
       MARK READ
       ========================================================= */

    public async Task MarkAsReadAsync(
        int notificationId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var notification =
            await _dbContext.Notifications
                .FirstOrDefaultAsync(notification =>
                    notification.Id ==
                        notificationId &&
                    notification.UserId ==
                        currentUserId &&
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

        var now =
            DateTime.UtcNow;

        notification.IsRead =
            true;

        notification.ReadAt =
            now;

        notification.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync()
    {
        var currentUserId =
            _currentUserService.UserId;

        var notifications =
            await _dbContext.Notifications
                .Where(notification =>
                    notification.UserId ==
                        currentUserId &&
                    !notification.IsRead &&
                    !notification.IsDeleted)
                .ToListAsync();

        if (notifications.Count == 0)
        {
            return;
        }

        var now =
            DateTime.UtcNow;

        foreach (var notification
                 in notifications)
        {
            notification.IsRead =
                true;

            notification.ReadAt =
                now;

            notification.UpdatedAt =
                now;
        }

        await _dbContext.SaveChangesAsync();
    }

    /* =========================================================
       MANUAL SEND
       ========================================================= */

    public async Task SendManualAsync(
        ManualNotificationRequest request)
    {
        var senderUserId =
            _currentUserService.UserId;

        var sender =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id ==
                        senderUserId &&
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

        /*
         * SystemAdmin can send to anyone.
         */
        if (sender.IsSystemAdmin)
        {
            if (request.WorkspaceId.HasValue)
            {
                var workspaceExists =
                    await _dbContext.Workspaces
                        .AsNoTracking()
                        .AnyAsync(workspace =>
                            workspace.Id ==
                                request.WorkspaceId.Value &&
                            !workspace.IsDeleted);

                if (!workspaceExists)
                {
                    throw new NotFoundException(
                        "Workspace not found.");
                }
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

        var allowedRecipients =
            await GetAllowedRecipientsAsync(
                workspaceId);

        var allowedRecipientIds =
            allowedRecipients
                .Select(recipient =>
                    recipient.UserId)
                .ToHashSet();

        var containsForbiddenRecipient =
            recipientUserIds.Any(
                recipientUserId =>
                    !allowedRecipientIds.Contains(
                        recipientUserId));

        if (containsForbiddenRecipient)
        {
            throw new ForbiddenException(
                "One or more recipients are not below you in the current workspace hierarchy.");
        }

        await CreateManyAsync(
            recipientUserIds,
            workspaceId,
            request.Title,
            request.Message,
            "manual.notification");
    }

    /* =========================================================
       CREATE ACTOR NOTIFICATION
       ========================================================= */

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
            new[]
            {
                userId
            },
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
        ArgumentNullException.ThrowIfNull(
            userIds);

        var actorUserId =
            _currentUserService.UserId;

        var recipientUserIds =
            userIds
                .Where(userId =>
                    userId > 0 &&
                    userId != actorUserId)
                .Distinct()
                .ToList();

        if (workspaceId.HasValue &&
            ShouldCopyWorkspaceOwner(
                type))
        {
            var ownerUserId =
                await GetActiveWorkspaceOwnerUserIdAsync(
                    workspaceId.Value);

            if (ownerUserId.HasValue &&
                ownerUserId.Value != actorUserId)
            {
                recipientUserIds.Add(
                    ownerUserId.Value);
            }
        }

        recipientUserIds =
            recipientUserIds
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
                    user.Id ==
                        actorUserId &&
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
                    .AsNoTracking()
                    .AnyAsync(workspace =>
                        workspace.Id ==
                            workspaceId.Value &&
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
            string.IsNullOrWhiteSpace(
                entityName)
                ? null
                : entityName.Trim();

        var now =
            DateTime.UtcNow;

        var notifications =
            activeRecipientUserIds
                .Select(userId =>
                    new Notification
                    {
                        UserId =
                            userId,

                        ActorUserId =
                            actorUserId,

                        WorkspaceId =
                            workspaceId,

                        Title =
                            normalizedTitle,

                        Message =
                            normalizedMessage,

                        Type =
                            normalizedType,

                        EntityName =
                            normalizedEntityName,

                        EntityId =
                            entityId,

                        IsRead =
                            false,

                        CreatedAt =
                            now
                    })
                .ToList();

        _dbContext.Notifications.AddRange(
            notifications);

        await _dbContext.SaveChangesAsync();

        foreach (var notification
                 in notifications)
        {
            var realtimeNotification =
                new NotificationResponse
                {
                    Id =
                        notification.Id,

                    UserId =
                        notification.UserId,

                    ActorUserId =
                        notification.ActorUserId,

                    ActorUserFullName =
                        actorUser.FullName,

                    WorkspaceId =
                        notification.WorkspaceId,

                    Title =
                        notification.Title,

                    Message =
                        notification.Message,

                    Type =
                        notification.Type,

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

    /* =========================================================
       SYSTEM NOTIFICATION
       ========================================================= */

    public async Task CreateSystemManyAsync(
        IEnumerable<int> userIds,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null)
    {
        ArgumentNullException.ThrowIfNull(
            userIds);

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
            string.IsNullOrWhiteSpace(
                entityName)
                ? null
                : entityName.Trim();

        var now =
            DateTime.UtcNow;

        var notifications =
            activeRecipientUserIds
                .Select(userId =>
                    new Notification
                    {
                        UserId =
                            userId,

                        ActorUserId =
                            null,

                        WorkspaceId =
                            workspaceId,

                        Title =
                            normalizedTitle,

                        Message =
                            normalizedMessage,

                        Type =
                            normalizedType,

                        EntityName =
                            normalizedEntityName,

                        EntityId =
                            entityId,

                        IsRead =
                            false,

                        CreatedAt =
                            now
                    })
                .ToList();

        _dbContext.Notifications.AddRange(
            notifications);

        await _dbContext.SaveChangesAsync();

        foreach (var notification
                 in notifications)
        {
            var realtimeNotification =
                new NotificationResponse
                {
                    Id =
                        notification.Id,

                    UserId =
                        notification.UserId,

                    ActorUserId =
                        null,

                    ActorUserFullName =
                        "System",

                    WorkspaceId =
                        notification.WorkspaceId,

                    Title =
                        notification.Title,

                    Message =
                        notification.Message,

                    Type =
                        notification.Type,

                    EntityName =
                        notification.EntityName,

                    EntityId =
                        notification.EntityId,

                    IsRead =
                        false,

                    ReadAt =
                        null,

                    CreatedAt =
                        notification.CreatedAt
                };

            await _notificationRealtimeService
                .SendToUserAsync(
                    notification.UserId,
                    realtimeNotification);
        }
    }

    /* =========================================================
       WORKSPACE OWNER COPY
       ========================================================= */

    private static bool ShouldCopyWorkspaceOwner(
        string type)
    {
        if (string.IsNullOrWhiteSpace(type) ||
            type == "manual.notification")
        {
            return false;
        }

        if (type.StartsWith(
                "task.",
                StringComparison.Ordinal))
        {
            return true;
        }

        return type is
            "project.archived" or
            "project.deleted" or
            "project.manager_required" or
            "project.manager_assigned" or
            "project.manager_removed" or
            "member.ontime_reward" or
            "workspace.invitation_accepted" or
            "workspace.invitation_rejected";
    }

    private async Task<int?> GetActiveWorkspaceOwnerUserIdAsync(
        int workspaceId)
    {
        return await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(member =>
                member.WorkspaceId == workspaceId &&
                member.Status == WorkspaceMemberStatus.Active &&
                !member.IsDeleted &&
                member.Role.Name == SystemRoles.WorkspaceOwner)
            .Select(member => (int?)member.UserId)
            .FirstOrDefaultAsync();
    }

    /* =========================================================
       RECIPIENT VALIDATION
       ========================================================= */

    private async Task EnsureRecipientsExistAsync(
        IReadOnlyCollection<int>
            recipientUserIds)
    {
        var existingRecipientCount =
            await _dbContext.Users
                .AsNoTracking()
                .CountAsync(user =>
                    recipientUserIds.Contains(
                        user.Id) &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (existingRecipientCount !=
            recipientUserIds.Count)
        {
            throw new BadRequestException(
                "One or more recipients were not found or are inactive.");
        }
    }

    /* =========================================================
       NORMALIZATION
       ========================================================= */

    private static string NormalizeRequiredText(
        string value,
        string fieldName)
    {
        if (string.IsNullOrWhiteSpace(
                value))
        {
            throw new BadRequestException(
                $"{fieldName} cannot be empty.");
        }

        return value.Trim();
    }

    /* =========================================================
       MAPPING
       ========================================================= */

    private static NotificationResponse
        MapToResponse(
            Notification notification)
    {
        return new NotificationResponse
        {
            Id =
                notification.Id,

            UserId =
                notification.UserId,

            ActorUserId =
                notification.ActorUserId,

            ActorUserFullName =
                notification.ActorUser?
                    .FullName ??
                "System",

            WorkspaceId =
                notification.WorkspaceId,

            Title =
                notification.Title,

            Message =
                notification.Message,

            Type =
                notification.Type,

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
    }
}