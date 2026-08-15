using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class ActivityLog : BaseEntity
{
    public int WorkspaceId { get; set; }

    public Workspace Workspace { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public string Action { get; set; } = string.Empty;

    public string EntityName { get; set; } = string.Empty;

    public int EntityId { get; set; }

    public string? Description { get; set; }
}