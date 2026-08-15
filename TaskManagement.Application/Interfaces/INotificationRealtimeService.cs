using TaskManagement.Application.DTOs.Notifications;

namespace TaskManagement.Application.Interfaces;

public interface INotificationRealtimeService
{
    Task SendToUserAsync(
        int userId,
        NotificationResponse notification);
}