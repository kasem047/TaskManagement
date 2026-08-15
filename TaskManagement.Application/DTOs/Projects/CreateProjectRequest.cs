using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Projects;

public sealed class CreateProjectRequest : IValidatableObject
{
    [Required(ErrorMessage = "Project name is required.")]
    [StringLength(
        150,
        MinimumLength = 2,
        ErrorMessage = "Project name must be between 2 and 150 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(
        1000,
        ErrorMessage = "Project description cannot exceed 1000 characters.")]
    public string? Description { get; set; }

    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "Project manager user ID must be greater than zero.")]
    public int? ManagerUserId { get; set; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (IsPlaceholder(Name))
        {
            yield return new ValidationResult(
                "Project name contains a placeholder value. Please enter a real project name.",
                new[] { nameof(Name) });
        }

        if (!string.IsNullOrWhiteSpace(Description) &&
            IsPlaceholder(Description))
        {
            yield return new ValidationResult(
                "Project description contains a placeholder value.",
                new[] { nameof(Description) });
        }
    }

    private static bool IsPlaceholder(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return value.Trim().ToLowerInvariant() is
            "string" or
            "example" or
            "sample" or
            "null" or
            "undefined";
    }
}