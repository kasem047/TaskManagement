using TaskManagement.Domain.Common;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Domain.Entities;

public class WorkspaceMember : BaseEntity
{
    public int WorkspaceId { get; set; }

    public Workspace Workspace { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public int RoleId { get; set; }

    public Role Role { get; set; } = null!;

    public WorkspaceMemberStatus Status { get; set; } = WorkspaceMemberStatus.Active;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}