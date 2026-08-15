using TaskManagement.Application.DTOs.Tasks;

namespace TaskManagement.Application.Interfaces;

public interface ITaskService
{
    Task<List<TaskResponse>> GetTasksAsync(
        int workspaceId,
        int projectId);

    Task<TaskResponse> GetTaskByIdAsync(
        int workspaceId,
        int projectId,
        int taskId);

    Task<TaskResponse> CreateTaskAsync(
        int workspaceId,
        int projectId,
        CreateTaskRequest request);

    Task<TaskResponse> UpdateTaskAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskRequest request);

    Task<TaskResponse> UpdateTaskStatusAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskStatusRequest request);

    Task DeleteTaskAsync(
        int workspaceId,
        int projectId,
        int taskId);
}