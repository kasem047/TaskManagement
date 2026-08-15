using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.TaskAssignees;

public sealed class AssignTaskRequest
{
    [Range(1, int.MaxValue,
        ErrorMessage = "User id must be greater than zero.")]
    public int UserId { get; set; }
}