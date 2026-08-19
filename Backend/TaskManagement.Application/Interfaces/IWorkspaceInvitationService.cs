using TaskManagement.Application.DTOs.WorkspaceInvitations;

namespace TaskManagement.Application.Interfaces;

public interface IWorkspaceInvitationService
{
    Task<List<WorkspaceInvitationResponse>>
        GetMyInvitationsAsync();


    Task<List<WorkspaceInvitationResponse>>
        GetWorkspaceInvitationsAsync(
            int workspaceId);


    Task<WorkspaceInvitationCreateResult>
        CreateAsync(
            int workspaceId,
            CreateWorkspaceInvitationRequest request);


    Task AcceptAsync(
        int invitationId);


    Task RejectAsync(
        int invitationId);


    Task CancelAsync(
        int workspaceId,
        int invitationId);
}