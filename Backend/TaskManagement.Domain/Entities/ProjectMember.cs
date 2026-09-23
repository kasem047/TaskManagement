using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class ProjectMember : BaseEntity
{
    public int ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;
}
