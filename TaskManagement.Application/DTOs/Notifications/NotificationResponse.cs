namespace TaskManagement.Application.DTOs.Notifications;

public sealed class NotificationResponse
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int? ActorUserId { get; set; }

    public string ActorUserFullName { get; set; } = string.Empty;

    public int? WorkspaceId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string? EntityName { get; set; }

    public int? EntityId { get; set; }

    public bool IsRead { get; set; }

    public DateTime? ReadAt { get; set; }

    public DateTime CreatedAt { get; set; }
}