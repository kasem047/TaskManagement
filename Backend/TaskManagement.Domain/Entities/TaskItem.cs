using System.ComponentModel.DataAnnotations;
using TaskManagement.Domain.Common;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Domain.Entities;

public class TaskItem : BaseEntity
{
    public int ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public TaskItemStatus Status { get; set; } =
        TaskItemStatus.Todo;

    public TaskPriority Priority { get; set; } =
        TaskPriority.Medium;

    public DateTime? DueDate { get; set; }

    public double Position { get; set; } = 0;

    public int CreatedByUserId { get; set; }

    public User CreatedByUser { get; set; } = null!;


    /* =========================================================
       PROGRESS
       ========================================================= */

    [Range(0, 100)]
    public int? ProgressPercentage { get; set; }

    [MaxLength(1000)]
    public string? ProgressNote { get; set; }

    public DateTime? ProgressUpdatedAt { get; set; }


    /* =========================================================
       RELATIONSHIPS
       ========================================================= */

    public ICollection<TaskAssignee> TaskAssignees { get; set; } =
        new List<TaskAssignee>();

    public ICollection<TaskComment> TaskComments { get; set; } =
        new List<TaskComment>();

    public ICollection<TaskAttachment> TaskAttachments { get; set; } =
        new List<TaskAttachment>();


    /*
     * المهام التي تعتمد عليها هذه المهمة.
     *
     * مثال:
     * B تعتمد على A
     *
     * B.Dependencies يحتوي العلاقة B -> A
     */
    public ICollection<TaskDependency> Dependencies { get; set; } =
        new List<TaskDependency>();


    /*
     * المهام الأخرى التي تعتمد على هذه المهمة.
     *
     * إذا:
     * B تعتمد على A
     *
     * A.DependentTasks يحتوي العلاقة B -> A
     */
    public ICollection<TaskDependency> DependentTasks { get; set; } =
        new List<TaskDependency>();
}