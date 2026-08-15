using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Workspaces;

public class UpdateWorkspaceRequest : IValidatableObject
{
    [Required(
        ErrorMessage = "Workspace name is required.")]
    [StringLength(
        150,
        MinimumLength = 2,
        ErrorMessage =
            "Workspace name must be between 2 and 150 characters.")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(
        500,
        ErrorMessage =
            "Workspace description must not exceed 500 characters.")]
    public string? Description { get; set; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        var name =
            Name?.Trim() ?? string.Empty;

        var description =
            Description?.Trim();

        if (IsPlaceholder(name))
        {
            yield return new ValidationResult(
                "Workspace name contains a placeholder value. Please enter a real workspace name.",
                new[]
                {
                    nameof(Name)
                });
        }

        if (!string.IsNullOrWhiteSpace(description) &&
            IsPlaceholder(description))
        {
            yield return new ValidationResult(
                "Workspace description contains a placeholder value.",
                new[]
                {
                    nameof(Description)
                });
        }
    }

    private static bool IsPlaceholder(
        string value)
    {
        var normalized =
            value.Trim().ToLowerInvariant();

        return normalized is
            "string" or
            "test" or
            "example" or
            "sample" or
            "null" or
            "undefined";
    }
}