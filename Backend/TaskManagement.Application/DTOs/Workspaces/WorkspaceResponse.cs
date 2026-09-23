namespace TaskManagement.Application.DTOs.Workspaces;

public class WorkspaceResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int CreatedByUserId { get; set; }

    public string CreatedByUserName { get; set; } = string.Empty;

    public string CurrentUserRole { get; set; } = string.Empty;

    public int OwnerUserId { get; set; }

    public string OwnerUserName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}