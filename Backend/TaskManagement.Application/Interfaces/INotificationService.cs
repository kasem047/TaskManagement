using TaskManagement.Application.DTOs.Notifications;

namespace TaskManagement.Application.Interfaces;

public interface INotificationService
{
    Task<List<NotificationResponse>> GetMyNotificationsAsync();

    Task<int> GetUnreadCountAsync();

    Task MarkAsReadAsync(int notificationId);

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