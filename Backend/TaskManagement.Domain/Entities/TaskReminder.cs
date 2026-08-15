using TaskManagement.Domain.Common;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Domain.Entities;

public class TaskReminder : BaseEntity
{
    public int TaskItemId { get; set; }

    public TaskItem TaskItem { get; set; } = null!;

    public TaskReminderType Type { get; set; }

    public DateTime DueDateSnapshot { get; set; }

    public DateTime SentAt { get; set; }
}