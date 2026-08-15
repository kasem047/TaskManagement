using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class Notification : BaseEntity
{
    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public int? ActorUserId { get; set; }

    public User? ActorUser { get; set; }

    public int? WorkspaceId { get; set; }

    public Workspace? Workspace { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string? EntityName { get; set; }

    public int? EntityId { get; set; }

    public bool IsRead { get; set; }

    public DateTime? ReadAt { get; set; }
}