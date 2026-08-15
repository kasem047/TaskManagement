using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Notifications;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public sealed class NotificationsController
    : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(
        INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<List<NotificationResponse>>>
        GetMyNotifications()
    {
        var notifications =
            await _notificationService
                .GetMyNotificationsAsync();

        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>>
        GetUnreadCount()
    {
        var unreadCount =
            await _notificationService
                .GetUnreadCountAsync();

        return Ok(unreadCount);
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendManualNotification(
        [FromBody] ManualNotificationRequest request)
    {
        await _notificationService
            .SendManualAsync(request);

        return NoContent();
    }

    [HttpPatch("{notificationId:int}/read")]
    public async Task<IActionResult> MarkAsRead(
        int notificationId)
    {
        await _notificationService
            .MarkAsReadAsync(notificationId);

        return NoContent();
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        await _notificationService
            .MarkAllAsReadAsync();

        return NoContent();
    }
}