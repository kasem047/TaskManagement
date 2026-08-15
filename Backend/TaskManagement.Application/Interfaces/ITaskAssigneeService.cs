using TaskManagement.Application.DTOs.TaskAssignees;

namespace TaskManagement.Application.Interfaces;

public interface ITaskAssigneeService
{
    Task<List<TaskAssigneeResponse>> GetTaskAssigneesAsync(
        int workspaceId,
        int projectId,
        int taskId);

    Task<TaskAssigneeResponse> AssignUserAsync(
        int workspaceId,
        int projectId,
        int taskId,
        AssignTaskRequest request);

    Task RemoveAssigneeAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int userId);
}