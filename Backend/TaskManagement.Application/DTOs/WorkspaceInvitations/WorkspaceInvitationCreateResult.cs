using TaskManagement.Application.DTOs.WorkspaceMembers;

namespace TaskManagement.Application.DTOs.WorkspaceInvitations;

public sealed class WorkspaceInvitationCreateResult
{
    public bool AddedDirectly { get; set; }

    public string Message { get; set; } =
        string.Empty;

    public WorkspaceMemberResponse? Member { get; set; }

    public WorkspaceInvitationResponse? Invitation { get; set; }
}