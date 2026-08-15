using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.UserPermissions;

public sealed class SetUserPermissionOverrideRequest
{
    [Range(
        1,
        int.MaxValue,
        ErrorMessage =
            "PermissionId must be greater than zero.")]
    public int PermissionId { get; set; }

    public bool IsGranted { get; set; }

    [StringLength(
        500,
        ErrorMessage =
            "Reason cannot exceed 500 characters.")]
    public string? Reason { get; set; }
}