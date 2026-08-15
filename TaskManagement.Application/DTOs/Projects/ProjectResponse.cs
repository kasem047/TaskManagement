namespace TaskManagement.Application.DTOs.Projects;

public sealed class ProjectResponse
{
    public int Id { get; set; }

    public int WorkspaceId { get; set; }

    public int? ManagerUserId { get; set; }

    public string? ManagerUserFullName { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsArchived { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}