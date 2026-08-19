namespace TaskManagement.Application.DTOs.WorkspaceMembers;

public sealed class WorkspaceRoleOptionResponse
{
    public int Id { get; set; }

    public string Name { get; set; } =
        string.Empty;
}


public sealed class WorkspaceMemberCandidateResponse
{
    public int UserId { get; set; }

    public string FullName { get; set; } =
        string.Empty;

    public string Email { get; set; } =
        string.Empty;
}