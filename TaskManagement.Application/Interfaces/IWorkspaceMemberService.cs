using TaskManagement.Application.DTOs.WorkspaceMembers;

namespace TaskManagement.Application.Interfaces;

public interface IWorkspaceMemberService
{
    Task<List<WorkspaceMemberResponse>> GetMembersAsync(int workspaceId);

    Task<WorkspaceMemberResponse> AddMemberAsync(
        int workspaceId,
        AddWorkspaceMemberRequest request);

    Task<WorkspaceMemberResponse> UpdateMemberRoleAsync(
        int workspaceId,
        int memberId,
        UpdateWorkspaceMemberRoleRequest request);

    Task RemoveMemberAsync(int workspaceId, int memberId);
}