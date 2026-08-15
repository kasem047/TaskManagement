namespace TaskManagement.Application.DTOs.TaskComments;

public sealed class TaskCommentResponse
{
    public int Id { get; set; }

    public int TaskItemId { get; set; }

    public int UserId { get; set; }

    public string UserFullName { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}