using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Notifications;

public sealed class NotificationQueryRequest
{
    public bool? IsRead { get; set; }

    public int? ActorUserId { get; set; }

    public int? WorkspaceId { get; set; }

    [StringLength(150)]
    public string? Source { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 20;
}