using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Projects;

public sealed class AddProjectMemberRequest
{
    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "UserId must be greater than zero.")]
    public int UserId { get; set; }
}
