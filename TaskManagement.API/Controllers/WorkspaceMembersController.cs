using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.WorkspaceMembers;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/workspaces/{workspaceId:int}/members")]
public class WorkspaceMembersController : ControllerBase
{
    private readonly IWorkspaceMemberService _workspaceMemberService;

    public WorkspaceMembersController(
        IWorkspaceMemberService workspaceMemberService)
    {
        _workspaceMemberService = workspaceMemberService;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkspaceMemberResponse>>> GetMembers(
        int workspaceId)
    {
        var response =
            await _workspaceMemberService.GetMembersAsync(workspaceId);

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<WorkspaceMemberResponse>> AddMember(
        int workspaceId,
        AddWorkspaceMemberRequest request)
    {
        var response =
            await _workspaceMemberService.AddMemberAsync(
                workspaceId,
                request);

        return Ok(response);
    }

    [HttpPut("{memberId:int}/role")]
    public async Task<ActionResult<WorkspaceMemberResponse>> UpdateMemberRole(
        int workspaceId,
        int memberId,
        UpdateWorkspaceMemberRoleRequest request)
    {
        var response =
            await _workspaceMemberService.UpdateMemberRoleAsync(
                workspaceId,
                memberId,
                request);

        return Ok(response);
    }

    [HttpDelete("{memberId:int}")]
    public async Task<IActionResult> RemoveMember(
        int workspaceId,
        int memberId)
    {
        await _workspaceMemberService.RemoveMemberAsync(
            workspaceId,
            memberId);

        return Ok(new
        {
            message = "Workspace member removed successfully.",
            workspaceId,
            memberId
        });
    }
}