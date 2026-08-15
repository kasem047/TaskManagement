namespace TaskManagement.Application.DTOs.UserPermissions;

public sealed class UserPermissionResponse
{
    public int PermissionId { get; set; }

    public string PermissionName { get; set; } =
        string.Empty;

    public string Module { get; set; } =
        string.Empty;

    public string? Description { get; set; }

    public bool GrantedByRole { get; set; }

    public bool? OverrideGranted { get; set; }

    public bool EffectiveGranted { get; set; }

    public string? OverrideReason { get; set; }
}