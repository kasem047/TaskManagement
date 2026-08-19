namespace TaskManagement.Application.DTOs.WorkspaceInvitations;

public sealed class WorkspaceInvitationResponse
{
    public int Id { get; set; }


    public int WorkspaceId { get; set; }

    public string WorkspaceName { get; set; } =
        string.Empty;


    public int InvitedUserId { get; set; }

    public string InvitedUserFullName { get; set; } =
        string.Empty;


    public int InvitedByUserId { get; set; }

    public string InvitedByUserFullName { get; set; } =
        string.Empty;


    public int RoleId { get; set; }

    public string RoleName { get; set; } =
        string.Empty;


    public string Status { get; set; } =
        string.Empty;


    public DateTime CreatedAt { get; set; }

    public DateTime? RespondedAt { get; set; }
}