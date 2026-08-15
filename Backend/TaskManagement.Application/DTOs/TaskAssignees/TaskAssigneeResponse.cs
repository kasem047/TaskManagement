namespace TaskManagement.Application.DTOs.TaskAssignees;

public sealed class TaskAssigneeResponse
{
    public int Id { get; set; }

    public int TaskItemId { get; set; }

    public int UserId { get; set; }

    public string UserFullName { get; set; } = string.Empty;

    public DateTime AssignedAt { get; set; }
}