namespace TaskManagement.Application.DTOs.Projects;

public sealed class ProjectMemberResponse
{
    public int Id { get; set; }

    public int ProjectId { get; set; }

    public int UserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string RoleName { get; set; } = string.Empty;

    public DateTime JoinedAt { get; set; }
}
