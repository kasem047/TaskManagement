using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.TaskComments;

public sealed class CreateTaskCommentRequest : IValidatableObject
{
    [Required(ErrorMessage = "Comment content is required.")]
    [StringLength(
        1000,
        MinimumLength = 1,
        ErrorMessage =
            "Comment content must be between 1 and 1000 characters.")]
    public string Content { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        var content =
            Content?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(content))
        {
            yield return new ValidationResult(
                "Comment content cannot contain only whitespace.",
                new[] { nameof(Content) });

            yield break;
        }

        if (IsPlaceholder(content))
        {
            yield return new ValidationResult(
                "Comment content contains a placeholder value.",
                new[] { nameof(Content) });
        }
    }

    private static bool IsPlaceholder(string value)
    {
        return value.Trim().ToLowerInvariant() is
            "string" or
            "example" or
            "sample" or
            "null" or
            "undefined";
    }
}