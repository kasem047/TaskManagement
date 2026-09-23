using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class Project : BaseEntity
{
    public int WorkspaceId { get; set; }

    public Workspace Workspace { get; set; } = null!;

    public int? ManagerUserId { get; set; }

    public User? ManagerUser { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsArchived { get; set; } = false;

    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();

    public ICollection<ProjectMember> Members { get; set; } =
        new List<ProjectMember>();
}