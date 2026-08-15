using TaskManagement.Application.DTOs.TaskComments;

namespace TaskManagement.Application.Interfaces;

public interface ITaskCommentService
{
    Task<List<TaskCommentResponse>> GetTaskCommentsAsync(
        int workspaceId,
        int projectId,
        int taskId);

    Task<TaskCommentResponse> CreateTaskCommentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        CreateTaskCommentRequest request);

    Task<TaskCommentResponse> UpdateTaskCommentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int commentId,
        UpdateTaskCommentRequest request);

    Task DeleteTaskCommentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int commentId);
}