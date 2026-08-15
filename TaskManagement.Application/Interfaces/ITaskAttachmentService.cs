using TaskManagement.Application.DTOs.TaskAttachments;

namespace TaskManagement.Application.Interfaces;

public interface ITaskAttachmentService
{
    Task<List<TaskAttachmentResponse>> GetTaskAttachmentsAsync(
        int workspaceId,
        int projectId,
        int taskId);

    Task<TaskAttachmentResponse> UploadTaskAttachmentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        UploadTaskAttachmentData uploadData);

    Task<DownloadTaskAttachmentResponse> DownloadTaskAttachmentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int attachmentId);

    Task DeleteTaskAttachmentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int attachmentId);
}