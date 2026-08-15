namespace TaskManagement.Application.DTOs.RolesPermissions;

public sealed class RoleResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsSystemRole { get; set; }

    public int PermissionCount { get; set; }
}