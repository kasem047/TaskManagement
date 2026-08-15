using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.TaskAssignees;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/projects/{projectId:int}/tasks/{taskId:int}/assignees")]
public sealed class TaskAssigneesController : ControllerBase
{
    private readonly ITaskAssigneeService _taskAssigneeService;

    public TaskAssigneesController(
        ITaskAssigneeService taskAssigneeService)
    {
        _taskAssigneeService = taskAssigneeService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TaskAssigneeResponse>>>
        GetTaskAssignees(
            int workspaceId,
            int projectId,
            int taskId)
    {
        var response =
            await _taskAssigneeService
                .GetTaskAssigneesAsync(
                    workspaceId,
                    projectId,
                    taskId);

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<TaskAssigneeResponse>>
        AssignUser(
            int workspaceId,
            int projectId,
            int taskId,
            AssignTaskRequest request)
    {
        var response =
            await _taskAssigneeService
                .AssignUserAsync(
                    workspaceId,
                    projectId,
                    taskId,
                    request);

        return Ok(response);
    }

    [HttpDelete("{userId:int}")]
    public async Task<IActionResult> RemoveAssignee(
        int workspaceId,
        int projectId,
        int taskId,
        int userId)
    {
        await _taskAssigneeService
            .RemoveAssigneeAsync(
                workspaceId,
                projectId,
                taskId,
                userId);

        return Ok(new
        {
            message =
                "Task assignee removed successfully.",
            workspaceId,
            projectId,
            taskId,
            userId
        });
    }
}