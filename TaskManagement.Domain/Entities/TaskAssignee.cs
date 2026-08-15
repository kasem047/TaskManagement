using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class TaskAssignee : BaseEntity
{
    public int TaskItemId { get; set; }

    public TaskItem TaskItem { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;
}