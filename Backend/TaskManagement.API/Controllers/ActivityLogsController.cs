using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.ActivityLogs;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/activity-logs")]
public sealed class ActivityLogsController
    : ControllerBase
{
    private readonly IActivityLogService
        _activityLogService;


    public ActivityLogsController(
        IActivityLogService activityLogService)
    {
        _activityLogService =
            activityLogService;
    }


    /* =========================================================
       WORKSPACE LOG
       ========================================================= */

    [HttpGet]
    public async
        Task<ActionResult<List<ActivityLogResponse>>>
        GetWorkspaceActivityLogs(
            int workspaceId)
    {
        var response =
            await _activityLogService
                .GetWorkspaceActivityLogsAsync(
                    workspaceId);


        return Ok(
            response);
    }


    /* =========================================================
       TASK LIFE / HISTORY
       ========================================================= */

    [HttpGet(
        "~/api/workspaces/{workspaceId:int}/projects/{projectId:int}/tasks/{taskId:int}/activity-logs")]
    public async
        Task<ActionResult<List<ActivityLogResponse>>>
        GetTaskActivityLogs(
            int workspaceId,
            int projectId,
            int taskId)
    {
        var response =
            await _activityLogService
                .GetTaskActivityLogsAsync(
                    workspaceId,
                    projectId,
                    taskId);


        return Ok(
            response);
    }
}