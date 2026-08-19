using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.RolesPermissions;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/admin")]
public sealed class RolesPermissionsController
    : ControllerBase
{
    private readonly IRolePermissionManagementService
        _rolePermissionManagementService;

    public RolesPermissionsController(
        IRolePermissionManagementService
            rolePermissionManagementService)
    {
        _rolePermissionManagementService =
            rolePermissionManagementService;
    }

    [HttpGet("roles")]
    public async Task<ActionResult<List<RoleResponse>>>
        GetRoles()
    {
        var roles =
            await _rolePermissionManagementService
                .GetRolesAsync();

        return Ok(roles);
    }

    [HttpPost("roles")]
    public async Task<ActionResult<RoleResponse>>
        CreateRole(
            [FromBody]
            CreateRoleRequest request)
    {
        var role =
            await _rolePermissionManagementService
                .CreateRoleAsync(
                    request);

        return Ok(role);
    }

    [HttpPut("roles/{roleId:int}")]
    public async Task<ActionResult<RoleResponse>>
        UpdateRole(
            int roleId,
            [FromBody]
            UpdateRoleRequest request)
    {
        var role =
            await _rolePermissionManagementService
                .UpdateRoleAsync(
                    roleId,
                    request);

        return Ok(role);
    }

    [HttpDelete("roles/{roleId:int}")]
    public async Task<IActionResult>
        DeleteRole(
            int roleId)
    {
        await _rolePermissionManagementService
            .DeleteRoleAsync(
                roleId);

        return NoContent();
    }

    [HttpGet("permissions")]
    public async Task<
        ActionResult<List<PermissionResponse>>>
        GetPermissions()
    {
        var permissions =
            await _rolePermissionManagementService
                .GetPermissionsAsync();

        return Ok(permissions);
    }

    [HttpGet("roles/{roleId:int}/permissions")]
    public async Task<ActionResult<RolePermissionsResponse>>
        GetRolePermissions(
            int roleId)
    {
        var result =
            await _rolePermissionManagementService
                .GetRolePermissionsAsync(
                    roleId);

        return Ok(result);
    }

    [HttpPut("roles/{roleId:int}/permissions")]
    public async Task<ActionResult<RolePermissionsResponse>>
        UpdateRolePermissions(
            int roleId,
            [FromBody]
            UpdateRolePermissionsRequest request)
    {
        var result =
            await _rolePermissionManagementService
                .UpdateRolePermissionsAsync(
                    roleId,
                    request);

        return Ok(result);
    }
}