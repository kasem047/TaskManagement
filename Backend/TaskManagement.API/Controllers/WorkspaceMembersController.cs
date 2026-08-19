using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.WorkspaceMembers;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/workspaces/{workspaceId:int}/members")]
public sealed class WorkspaceMembersController
    : ControllerBase
{
    private readonly IWorkspaceMemberService
        _workspaceMemberService;


    public WorkspaceMembersController(
        IWorkspaceMemberService workspaceMemberService)
    {
        _workspaceMemberService =
            workspaceMemberService;
    }


    /* =========================================================
       MEMBERS
       ========================================================= */

    [HttpGet]
    public async Task<
        ActionResult<List<WorkspaceMemberResponse>>>
        GetMembers(
            int workspaceId)
    {
        var response =
            await _workspaceMemberService
                .GetMembersAsync(
                    workspaceId);

        return Ok(
            response);
    }


    /* =========================================================
       MANAGEMENT OPTIONS
       ========================================================= */

    [HttpGet("roles")]
    public async Task<
        ActionResult<List<WorkspaceRoleOptionResponse>>>
        GetAvailableRoles(
            int workspaceId)
    {
        var response =
            await _workspaceMemberService
                .GetAvailableRolesAsync(
                    workspaceId);

        return Ok(
            response);
    }


    [HttpGet("candidates")]
    public async Task<
        ActionResult<List<WorkspaceMemberCandidateResponse>>>
        SearchCandidates(
            int workspaceId,
            [FromQuery]
            string? search = null)
    {
        var response =
            await _workspaceMemberService
                .SearchCandidatesAsync(
                    workspaceId,
                    search);

        return Ok(
            response);
    }


    /* =========================================================
       ADD MEMBER
       ========================================================= */

    [HttpPost]
    public async Task<
        ActionResult<WorkspaceMemberResponse>>
        AddMember(
            int workspaceId,
            [FromBody]
            AddWorkspaceMemberRequest request)
    {
        var response =
            await _workspaceMemberService
                .AddMemberAsync(
                    workspaceId,
                    request);

        return Ok(
            response);
    }


    /* =========================================================
       ROLE
       ========================================================= */

    [HttpPut("{memberId:int}/role")]
    public async Task<
        ActionResult<WorkspaceMemberResponse>>
        UpdateMemberRole(
            int workspaceId,
            int memberId,
            [FromBody]
            UpdateWorkspaceMemberRoleRequest request)
    {
        var response =
            await _workspaceMemberService
                .UpdateMemberRoleAsync(
                    workspaceId,
                    memberId,
                    request);

        return Ok(
            response);
    }


    /* =========================================================
       REMOVE MEMBER
       ========================================================= */

    [HttpDelete("{memberId:int}")]
    public async Task<IActionResult>
        RemoveMember(
            int workspaceId,
            int memberId)
    {
        await _workspaceMemberService
            .RemoveMemberAsync(
                workspaceId,
                memberId);


        return Ok(
            new
            {
                message =
                    "Workspace member removed successfully.",

                workspaceId,

                memberId
            });
    }
}