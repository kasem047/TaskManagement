namespace TaskManagement.Application.DTOs.WorkspaceMembers;

public class WorkspaceMemberResponse
{
    public int Id { get; set; }

    public int WorkspaceId { get; set; }

    public int UserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public int RoleId { get; set; }

    public string RoleName { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTime JoinedAt { get; set; }
}