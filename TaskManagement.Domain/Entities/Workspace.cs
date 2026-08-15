using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class Workspace : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int CreatedByUserId { get; set; }

    public User CreatedByUser { get; set; } = null!;

    public ICollection<WorkspaceMember> WorkspaceMembers { get; set; } = new List<WorkspaceMember>();

    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<ActivityLog> ActivityLogs { get; set; } = new List<ActivityLog>();
}