namespace TaskManagement.Application.DTOs.RolesPermissions;

public sealed class RolePermissionsResponse
{
    public int RoleId { get; set; }

    public string RoleName { get; set; } = string.Empty;

    public List<PermissionResponse> Permissions { get; set; } =
        new();
}