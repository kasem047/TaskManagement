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
    private readonly INotificationService
        _notificationService;

    public NotificationsController(
        INotificationService notificationService)
    {
        _notificationService =
            notificationService;
    }

    /* =========================================================
       LEGACY ALL
       ========================================================= */

    [HttpGet]
    public async Task<
        ActionResult<List<NotificationResponse>>>
        GetMyNotifications()
    {
        var notifications =
            await _notificationService
                .GetMyNotificationsAsync();

        return Ok(
            notifications);
    }

    /* =========================================================
       FULL PAGE
       ========================================================= */

    [HttpGet("page")]
    public async Task<
        ActionResult<NotificationPagedResponse>>
        GetMyNotificationsPage(
            [FromQuery]
            NotificationQueryRequest request)
    {
        var response =
            await _notificationService
                .GetMyNotificationsAsync(
                    request);

        return Ok(
            response);
    }

    /* =========================================================
       QUICK BELL
       ========================================================= */

    [HttpGet("unread")]
    public async Task<
        ActionResult<List<NotificationResponse>>>
        GetUnreadNotifications(
            [FromQuery]
            int take = 8)
    {
        var notifications =
            await _notificationService
                .GetMyUnreadNotificationsAsync(
                    take);

        return Ok(
            notifications);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>>
        GetUnreadCount()
    {
        var unreadCount =
            await _notificationService
                .GetUnreadCountAsync();

        return Ok(
            unreadCount);
    }

    /* =========================================================
       HIERARCHICAL RECIPIENTS
       ========================================================= */

    [HttpGet("recipients")]
    public async Task<
        ActionResult<
            List<NotificationRecipientResponse>>>
        GetAllowedRecipients(
            [FromQuery]
            int? workspaceId = null)
    {
        var recipients =
            await _notificationService
                .GetAllowedRecipientsAsync(
                    workspaceId);

        return Ok(
            recipients);
    }

    /* =========================================================
       MANUAL SEND
       ========================================================= */

    [HttpPost("send")]
    public async Task<IActionResult>
        SendManualNotification(
            [FromBody]
            ManualNotificationRequest request)
    {
        await _notificationService
            .SendManualAsync(
                request);

        return NoContent();
    }

    /* =========================================================
       READ
       ========================================================= */

    [HttpPatch("{notificationId:int}/read")]
    public async Task<IActionResult>
        MarkAsRead(
            int notificationId)
    {
        await _notificationService
            .MarkAsReadAsync(
                notificationId);

        return NoContent();
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult>
        MarkAllAsRead()
    {
        await _notificationService
            .MarkAllAsReadAsync();

        return NoContent();
    }
}