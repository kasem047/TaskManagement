using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.TaskAttachments;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/projects/{projectId:int}/tasks/{taskId:int}/attachments")]
public sealed class TaskAttachmentsController : ControllerBase
{
    private readonly ITaskAttachmentService _taskAttachmentService;

    public TaskAttachmentsController(
        ITaskAttachmentService taskAttachmentService)
    {
        _taskAttachmentService = taskAttachmentService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TaskAttachmentResponse>>>
        GetTaskAttachments(
            int workspaceId,
            int projectId,
            int taskId)
    {
        var response =
            await _taskAttachmentService.GetTaskAttachmentsAsync(
                workspaceId,
                projectId,
                taskId);

        return Ok(response);
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<TaskAttachmentResponse>>
        UploadTaskAttachment(
            int workspaceId,
            int projectId,
            int taskId,
            IFormFile file)
    {
        var uploadData =
            new UploadTaskAttachmentData
            {
                Content = file.OpenReadStream(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSize = file.Length
            };

        var response =
            await _taskAttachmentService.UploadTaskAttachmentAsync(
                workspaceId,
                projectId,
                taskId,
                uploadData);

        return Ok(response);
    }

    [HttpGet("{attachmentId:int}/download")]
    public async Task<IActionResult> DownloadTaskAttachment(
        int workspaceId,
        int projectId,
        int taskId,
        int attachmentId)
    {
        var response =
            await _taskAttachmentService.DownloadTaskAttachmentAsync(
                workspaceId,
                projectId,
                taskId,
                attachmentId);

        return File(
            response.FileContent,
            response.ContentType,
            response.FileName);
    }

    [HttpDelete("{attachmentId:int}")]
    public async Task<IActionResult> DeleteTaskAttachment(
        int workspaceId,
        int projectId,
        int taskId,
        int attachmentId)
    {
        await _taskAttachmentService.DeleteTaskAttachmentAsync(
            workspaceId,
            projectId,
            taskId,
            attachmentId);

        return Ok(new
        {
            message = "Task attachment deleted successfully.",
            workspaceId,
            projectId,
            taskId,
            attachmentId
        });
    }
}