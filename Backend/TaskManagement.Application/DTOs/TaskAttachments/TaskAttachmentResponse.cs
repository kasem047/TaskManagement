namespace TaskManagement.Application.DTOs.TaskAttachments;

public sealed class TaskAttachmentResponse
{
    public int Id { get; set; }

    public int TaskItemId { get; set; }

    public int UserId { get; set; }

    public string UserFullName { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; }

    public DateTime CreatedAt { get; set; }
}