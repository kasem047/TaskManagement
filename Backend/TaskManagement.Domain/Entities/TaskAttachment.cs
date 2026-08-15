using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class TaskAttachment : BaseEntity
{
    public int TaskItemId { get; set; }

    public TaskItem TaskItem { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public string FileName { get; set; } = string.Empty;

    public string FilePath { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; }
}