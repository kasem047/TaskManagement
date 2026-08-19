using TaskManagement.Application.DTOs.Notifications;

namespace TaskManagement.Application.Interfaces;

public interface INotificationService
{
    Task<List<NotificationResponse>>
        GetMyNotificationsAsync();

    Task<NotificationPagedResponse>
        GetMyNotificationsAsync(
            NotificationQueryRequest request);

    Task<List<NotificationResponse>>
        GetMyUnreadNotificationsAsync(
            int take = 8);

    Task<int>
        GetUnreadCountAsync();

    Task<List<NotificationRecipientResponse>>
        GetAllowedRecipientsAsync(
            int? workspaceId);

    Task MarkAsReadAsync(
        int notificationId);

    Task MarkAllAsReadAsync();

    Task SendManualAsync(
        ManualNotificationRequest request);

    Task CreateAsync(
        int userId,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null);

    Task CreateManyAsync(
        IEnumerable<int> userIds,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null);

    Task CreateSystemManyAsync(
        IEnumerable<int> userIds,
        int? workspaceId,
        string title,
        string message,
        string type,
        string? entityName = null,
        int? entityId = null);
}