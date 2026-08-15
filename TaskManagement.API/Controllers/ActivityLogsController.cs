using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.ActivityLogs;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/workspaces/{workspaceId:int}/activity-logs")]
public sealed class ActivityLogsController : ControllerBase
{
    private readonly IActivityLogService _activityLogService;

    public ActivityLogsController(
        IActivityLogService activityLogService)
    {
        _activityLogService = activityLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ActivityLogResponse>>>
        GetWorkspaceActivityLogs(
            int workspaceId)
    {
        var response =
            await _activityLogService
                .GetWorkspaceActivityLogsAsync(
                    workspaceId);

        return Ok(response);
    }
}