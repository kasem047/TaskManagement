using TaskManagement.Application.DTOs.RolesPermissions;

namespace TaskManagement.Application.Interfaces;

public interface IRolePermissionManagementService
{
    Task<List<RoleResponse>> GetRolesAsync();

    Task<List<PermissionResponse>> GetPermissionsAsync();

    Task<RolePermissionsResponse> GetRolePermissionsAsync(
        int roleId);

    Task<RolePermissionsResponse> UpdateRolePermissionsAsync(
        int roleId,
        UpdateRolePermissionsRequest request);
}