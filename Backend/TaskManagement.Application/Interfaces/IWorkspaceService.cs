using TaskManagement.Application.DTOs.Workspaces;

namespace TaskManagement.Application.Interfaces;

public interface IWorkspaceService
{
    Task<WorkspaceResponse> CreateAsync(CreateWorkspaceRequest request);

    Task<List<WorkspaceResponse>> GetMyWorkspacesAsync();

    Task<WorkspaceResponse> GetByIdAsync(int workspaceId);

    Task<WorkspaceResponse> UpdateAsync(int workspaceId, UpdateWorkspaceRequest request);

    Task DeleteAsync(int workspaceId);
}