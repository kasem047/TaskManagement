using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Tasks;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/projects/{projectId:int}/tasks")]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;

    public TasksController(
        ITaskService taskService)
    {
        _taskService = taskService;
    }

    [HttpGet]
    public async Task<ActionResult<List<TaskResponse>>> GetTasks(
        int workspaceId,
        int projectId)
    {
        var response =
            await _taskService.GetTasksAsync(
                workspaceId,
                projectId);

        return Ok(response);
    }

    [HttpGet("{taskId:int}")]
    public async Task<ActionResult<TaskResponse>> GetTaskById(
        int workspaceId,
        int projectId,
        int taskId)
    {
        var response =
            await _taskService.GetTaskByIdAsync(
                workspaceId,
                projectId,
                taskId);

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<TaskResponse>> CreateTask(
        int workspaceId,
        int projectId,
        CreateTaskRequest request)
    {
        var response =
            await _taskService.CreateTaskAsync(
                workspaceId,
                projectId,
                request);

        return Ok(response);
    }

    [HttpPut("{taskId:int}")]
    public async Task<ActionResult<TaskResponse>> UpdateTask(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskRequest request)
    {
        var response =
            await _taskService.UpdateTaskAsync(
                workspaceId,
                projectId,
                taskId,
                request);

        return Ok(response);
    }

    [HttpPut("{taskId:int}/status")]
    public async Task<ActionResult<TaskResponse>> UpdateTaskStatus(
        int workspaceId,
        int projectId,
        int taskId,
        UpdateTaskStatusRequest request)
    {
        var response =
            await _taskService.UpdateTaskStatusAsync(
                workspaceId,
                projectId,
                taskId,
                request);

        return Ok(response);
    }

    [HttpDelete("{taskId:int}")]
    public async Task<IActionResult> DeleteTask(
        int workspaceId,
        int projectId,
        int taskId)
    {
        await _taskService.DeleteTaskAsync(
            workspaceId,
            projectId,
            taskId);

        return Ok(new
        {
            message = "Task deleted successfully.",
            workspaceId,
            projectId,
            taskId
        });
    }
}