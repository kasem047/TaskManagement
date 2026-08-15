using System.ComponentModel.DataAnnotations;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.DTOs.Tasks;

public sealed class UpdateTaskRequest : IValidatableObject
{
    [Required(ErrorMessage = "Task title is required.")]
    [StringLength(
        200,
        MinimumLength = 2,
        ErrorMessage = "Task title must be between 2 and 200 characters.")]
    public string Title { get; set; } = string.Empty;

    [StringLength(
        1000,
        ErrorMessage = "Task description cannot exceed 1000 characters.")]
    public string? Description { get; set; }

    [EnumDataType(
        typeof(TaskPriority),
        ErrorMessage = "Invalid task priority.")]
    public TaskPriority Priority { get; set; }

    public DateTime? DueDate { get; set; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (IsPlaceholder(Title))
        {
            yield return new ValidationResult(
                "Task title contains a placeholder value. Please enter a real task title.",
                new[] { nameof(Title) });
        }

        if (!string.IsNullOrWhiteSpace(Description) &&
            IsPlaceholder(Description))
        {
            yield return new ValidationResult(
                "Task description contains a placeholder value.",
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