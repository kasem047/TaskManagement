using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Workspaces;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class WorkspacesController : ControllerBase
{
    private readonly IWorkspaceService
        _workspaceService;


    public WorkspacesController(
        IWorkspaceService workspaceService)
    {
        _workspaceService =
            workspaceService;
    }


    [HttpPost]
    public async Task<ActionResult<WorkspaceResponse>>
        Create(
            CreateWorkspaceRequest request)
    {
        var response =
            await _workspaceService
                .CreateAsync(
                    request);

        return Ok(
            response);
    }


    [HttpGet]
    public async Task<ActionResult<List<WorkspaceResponse>>>
        GetMyWorkspaces()
    {
        var response =
            await _workspaceService
                .GetMyWorkspacesAsync();

        return Ok(
            response);
    }


    [HttpGet("{workspaceId:int}")]
    public async Task<ActionResult<WorkspaceResponse>>
        GetById(
            int workspaceId)
    {
        var response =
            await _workspaceService
                .GetByIdAsync(
                    workspaceId);

        return Ok(
            response);
    }


    [HttpPut("{workspaceId:int}")]
    public async Task<ActionResult<WorkspaceResponse>>
        Update(
            int workspaceId,
            UpdateWorkspaceRequest request)
    {
        var response =
            await _workspaceService
                .UpdateAsync(
                    workspaceId,
                    request);

        return Ok(
            response);
    }


    /*
     * Ownership transfer is intentionally
     * separated from normal member-role updates.
     *
     * A workspace must always have one owner only.
     */
    [HttpPost(
        "{workspaceId:int}/transfer-ownership")]
    public async Task<IActionResult>
        TransferOwnership(
            int workspaceId,
            [FromBody]
            TransferWorkspaceOwnershipRequest request)
    {
        await _workspaceService
            .TransferOwnershipAsync(
                workspaceId,
                request);

        return Ok(
            new
            {
                message =
                    "Workspace ownership transferred successfully.",

                workspaceId,

                newOwnerUserId =
                    request.NewOwnerUserId
            });
    }


    /* =========================================================
       LEAVE WORKSPACE
       ========================================================= */

    [HttpPost("{workspaceId:int}/leave")]
    public async Task<IActionResult>
        Leave(
            int workspaceId)
    {
        await _workspaceService
            .LeaveAsync(
                workspaceId);

        return Ok(
            new
            {
                message =
                    "You left the workspace successfully.",

                workspaceId
            });
    }


    [HttpDelete("{workspaceId:int}")]
    public async Task<IActionResult>
        Delete(
            int workspaceId)
    {
        await _workspaceService
            .DeleteAsync(
                workspaceId);

        return Ok(
            new
            {
                message =
                    "Workspace deleted successfully.",

                workspaceId
            });
    }
}