namespace TaskManagement.Application.DTOs.RolesPermissions;

public sealed class PermissionResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Module { get; set; } = string.Empty;
}