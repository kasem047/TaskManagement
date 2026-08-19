using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.WorkspaceInvitations;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
public sealed class WorkspaceInvitationsController
    : ControllerBase
{
    private readonly IWorkspaceInvitationService
        _workspaceInvitationService;


    public WorkspaceInvitationsController(
        IWorkspaceInvitationService workspaceInvitationService)
    {
        _workspaceInvitationService =
            workspaceInvitationService;
    }


    /* =========================================================
       MY INVITATIONS
       ========================================================= */

    [HttpGet("api/workspace-invitations")]
    public async Task<
        ActionResult<List<WorkspaceInvitationResponse>>>
        GetMyInvitations()
    {
        var response =
            await _workspaceInvitationService
                .GetMyInvitationsAsync();


        return Ok(
            response);
    }


    /* =========================================================
       ACCEPT
       ========================================================= */

    [HttpPost(
        "api/workspace-invitations/{invitationId:int}/accept")]
    public async Task<IActionResult>
        Accept(
            int invitationId)
    {
        await _workspaceInvitationService
            .AcceptAsync(
                invitationId);


        return Ok(
            new
            {
                message =
                    "Workspace invitation accepted successfully."
            });
    }


    /* =========================================================
       REJECT
       ========================================================= */

    [HttpPost(
        "api/workspace-invitations/{invitationId:int}/reject")]
    public async Task<IActionResult>
        Reject(
            int invitationId)
    {
        await _workspaceInvitationService
            .RejectAsync(
                invitationId);


        return Ok(
            new
            {
                message =
                    "Workspace invitation rejected successfully."
            });
    }


    /* =========================================================
       WORKSPACE INVITATIONS
       ========================================================= */

    [HttpGet(
        "api/workspaces/{workspaceId:int}/invitations")]
    public async Task<
        ActionResult<List<WorkspaceInvitationResponse>>>
        GetWorkspaceInvitations(
            int workspaceId)
    {
        var response =
            await _workspaceInvitationService
                .GetWorkspaceInvitationsAsync(
                    workspaceId);


        return Ok(
            response);
    }


    /* =========================================================
       INVITE / DIRECT ADD
       ========================================================= */

    [HttpPost(
        "api/workspaces/{workspaceId:int}/invitations")]
    public async Task<
        ActionResult<WorkspaceInvitationCreateResult>>
        Create(
            int workspaceId,
            [FromBody]
            CreateWorkspaceInvitationRequest request)
    {
        var response =
            await _workspaceInvitationService
                .CreateAsync(
                    workspaceId,
                    request);


        return Ok(
            response);
    }


    /* =========================================================
       CANCEL
       ========================================================= */

    [HttpDelete(
        "api/workspaces/{workspaceId:int}/invitations/{invitationId:int}")]
    public async Task<IActionResult>
        Cancel(
            int workspaceId,
            int invitationId)
    {
        await _workspaceInvitationService
            .CancelAsync(
                workspaceId,
                invitationId);


        return Ok(
            new
            {
                message =
                    "Workspace invitation cancelled successfully."
            });
    }
}