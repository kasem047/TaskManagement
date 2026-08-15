using Microsoft.AspNetCore.SignalR;
using TaskManagement.API.Hubs;
using TaskManagement.Application.DTOs.Notifications;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Services;

public sealed class SignalRNotificationRealtimeService
    : INotificationRealtimeService
{
    private readonly IHubContext<NotificationHub>
        _hubContext;

    public SignalRNotificationRealtimeService(
        IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendToUserAsync(
        int userId,
        NotificationResponse notification)
    {
        await _hubContext.Clients
            .Group(
                NotificationHub.GetUserGroupName(
                    userId))
            .SendAsync(
                "notificationReceived",
                notification);
    }
}