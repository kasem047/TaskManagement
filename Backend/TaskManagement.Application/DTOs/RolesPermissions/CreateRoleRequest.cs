using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.RolesPermissions;

public sealed class CreateRoleRequest
    : IValidatableObject
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

    [Required(
        ErrorMessage = "PermissionIds is required.")]
    public List<int> PermissionIds { get; set; } =
        new();

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (PermissionIds.Any(
                permissionId =>
                    permissionId <= 0))
        {
            yield return new ValidationResult(
                "All permission IDs must be greater than zero.",
                new[]
                {
                    nameof(PermissionIds)
                });
        }

        if (PermissionIds.Distinct().Count() !=
            PermissionIds.Count)
        {
            yield return new ValidationResult(
                "Permission IDs must not contain duplicates.",
                new[]
                {
                    nameof(PermissionIds)
                });
        }
    }
}