using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.RolesPermissions;

public sealed class UpdateRoleRequest
{
    [Required]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage =
            "Role name must be between 2 and 100 characters.")]
    public string Name { get; set; } =
        string.Empty;

    [StringLength(
        500,
        ErrorMessage =
            "Description cannot exceed 500 characters.")]
    public string? Description { get; set; }
}