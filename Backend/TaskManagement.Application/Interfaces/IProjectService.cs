using TaskManagement.Application.DTOs.Projects;

namespace TaskManagement.Application.Interfaces;

public interface IProjectService
{
    Task<List<ProjectResponse>> GetProjectsAsync(
        int workspaceId);

    Task<ProjectResponse> GetProjectByIdAsync(
        int workspaceId,
        int projectId);

    Task<ProjectResponse> CreateProjectAsync(
        int workspaceId,
        CreateProjectRequest request);

    Task<ProjectResponse> UpdateProjectAsync(
        int workspaceId,
        int projectId,
        UpdateProjectRequest request);

    Task ArchiveProjectAsync(
        int workspaceId,
        int projectId);

    Task DeleteProjectAsync(
        int workspaceId,
        int projectId);
}