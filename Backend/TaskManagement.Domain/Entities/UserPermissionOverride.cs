using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class UserPermissionOverride : BaseEntity
{
    public int WorkspaceId { get; set; }

    public Workspace Workspace { get; set; } = null!;

    public int UserId { get; set; }

    public int PermissionId { get; set; }

    public Permission Permission { get; set; } = null!;

    public bool IsGranted { get; set; }

    public string? Reason { get; set; }
}