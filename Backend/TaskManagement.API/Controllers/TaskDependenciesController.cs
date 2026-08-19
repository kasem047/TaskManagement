using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Tasks;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/projects/{projectId:int}/tasks/{taskId:int}/dependencies")]
public sealed class TaskDependenciesController : ControllerBase
{
    private readonly ITaskService
        _taskService;


    public TaskDependenciesController(
        ITaskService taskService)
    {
        _taskService =
            taskService;
    }


    [HttpGet]
    public async Task<ActionResult<List<TaskDependencyResponse>>>
        GetDependencies(
            int workspaceId,
            int projectId,
            int taskId)
    {
        var result =
            await _taskService
                .GetTaskDependenciesAsync(
                    workspaceId,
                    projectId,
                    taskId);

        return Ok(result);
    }


    [HttpPut]
    public async Task<ActionResult<List<TaskDependencyResponse>>>
        SetDependencies(
            int workspaceId,
            int projectId,
            int taskId,
            [FromBody]
            SetTaskDependenciesRequest request)
    {
        var result =
            await _taskService
                .SetTaskDependenciesAsync(
                    workspaceId,
                    projectId,
                    taskId,
                    request);

        return Ok(result);
    }
}