using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class TaskDependency : BaseEntity
{
    public int TaskItemId { get; set; }

    public TaskItem TaskItem { get; set; } = null!;

    public int DependsOnTaskItemId { get; set; }

    public TaskItem DependsOnTaskItem { get; set; } = null!;
}