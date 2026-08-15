using TaskManagement.Application.DTOs.UserPermissions;

namespace TaskManagement.Application.Interfaces;

public interface IUserPermissionManagementService
{
    Task<List<UserPermissionResponse>>
        GetUserPermissionsAsync(
            int workspaceId,
            int userId);

    Task<UserPermissionResponse>
        SetUserPermissionOverrideAsync(
            int workspaceId,
            int userId,
            SetUserPermissionOverrideRequest request);

    Task RemoveUserPermissionOverrideAsync(
        int workspaceId,
        int userId,
        int permissionId);
}