using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TaskManagement.API.Hubs;

[Authorize]
public sealed class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userIdValue =
            Context.User?.FindFirstValue(
                ClaimTypes.NameIdentifier) ??
            Context.User?.FindFirstValue("sub");

        if (!int.TryParse(
                userIdValue,
                out var userId))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            GetUserGroupName(userId));

        await base.OnConnectedAsync();
    }

    public static string GetUserGroupName(
        int userId)
    {
        return $"notification-user-{userId}";
    }
}