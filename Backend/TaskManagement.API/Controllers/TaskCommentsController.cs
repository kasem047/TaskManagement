using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.TaskComments;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/projects/{projectId:int}/tasks/{taskId:int}/comments")]
public sealed class TaskCommentsController : ControllerBase
{
    private readonly ITaskCommentService _taskCommentService;

    public TaskCommentsController(
        ITaskCommentService taskCommentService)
    {
        _taskCommentService = taskCommentService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TaskCommentResponse>>>
        GetTaskComments(
            int workspaceId,
            int projectId,
            int taskId)
    {
        var response =
            await _taskCommentService.GetTaskCommentsAsync(
                workspaceId,
                projectId,
                taskId);

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<TaskCommentResponse>>
        CreateTaskComment(
            int workspaceId,
            int projectId,
            int taskId,
            CreateTaskCommentRequest request)
    {
        var response =
            await _taskCommentService.CreateTaskCommentAsync(
                workspaceId,
                projectId,
                taskId,
                request);

        return Ok(response);
    }

    [HttpPut("{commentId:int}")]
    public async Task<ActionResult<TaskCommentResponse>>
        UpdateTaskComment(
            int workspaceId,
            int projectId,
            int taskId,
            int commentId,
            UpdateTaskCommentRequest request)
    {
        var response =
            await _taskCommentService.UpdateTaskCommentAsync(
                workspaceId,
                projectId,
                taskId,
                commentId,
                request);

        return Ok(response);
    }

    [HttpDelete("{commentId:int}")]
    public async Task<IActionResult> DeleteTaskComment(
        int workspaceId,
        int projectId,
        int taskId,
        int commentId)
    {
        await _taskCommentService.DeleteTaskCommentAsync(
            workspaceId,
            projectId,
            taskId,
            commentId);

        return Ok(new
        {
            message = "Task comment deleted successfully.",
            workspaceId,
            projectId,
            taskId,
            commentId
        });
    }
}