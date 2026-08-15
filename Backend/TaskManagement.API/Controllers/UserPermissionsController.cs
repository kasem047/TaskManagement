using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.UserPermissions;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/workspaces/{workspaceId:int}/members/{userId:int}/permissions")]
public sealed class UserPermissionsController
    : ControllerBase
{
    private readonly IUserPermissionManagementService
        _userPermissionManagementService;

    public UserPermissionsController(
        IUserPermissionManagementService
            userPermissionManagementService)
    {
        _userPermissionManagementService =
            userPermissionManagementService;
    }

    [HttpGet]
    public async Task<
        ActionResult<List<UserPermissionResponse>>>
        GetUserPermissions(
            int workspaceId,
            int userId)
    {
        var permissions =
            await _userPermissionManagementService
                .GetUserPermissionsAsync(
                    workspaceId,
                    userId);

        return Ok(
            permissions);
    }

    [HttpPut]
    public async Task<
        ActionResult<UserPermissionResponse>>
        SetPermissionOverride(
            int workspaceId,
            int userId,
            [FromBody]
            SetUserPermissionOverrideRequest request)
    {
        var result =
            await _userPermissionManagementService
                .SetUserPermissionOverrideAsync(
                    workspaceId,
                    userId,
                    request);

        return Ok(
            result);
    }

    [HttpDelete("{permissionId:int}")]
    public async Task<IActionResult>
        RemovePermissionOverride(
            int workspaceId,
            int userId,
            int permissionId)
    {
        await _userPermissionManagementService
            .RemoveUserPermissionOverrideAsync(
                workspaceId,
                userId,
                permissionId);

        return NoContent();
    }
}