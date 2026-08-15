using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Notifications;

public sealed class ManualNotificationRequest
    : IValidatableObject
{
    [Range(
        1,
        int.MaxValue,
        ErrorMessage =
            "WorkspaceId must be greater than zero.")]
    public int? WorkspaceId { get; set; }

    [Required(
        ErrorMessage =
            "At least one recipient is required.")]
    [MinLength(
        1,
        ErrorMessage =
            "At least one recipient is required.")]
    public List<int> RecipientUserIds { get; set; } =
        new();

    [Required(
        ErrorMessage =
            "Notification title is required.")]
    [StringLength(
        200,
        MinimumLength = 2,
        ErrorMessage =
            "Notification title must be between 2 and 200 characters.")]
    public string Title { get; set; } =
        string.Empty;

    [Required(
        ErrorMessage =
            "Notification message is required.")]
    [StringLength(
        1000,
        MinimumLength = 2,
        ErrorMessage =
            "Notification message must be between 2 and 1000 characters.")]
    public string Message { get; set; } =
        string.Empty;

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (RecipientUserIds.Any(
                userId => userId <= 0))
        {
            yield return new ValidationResult(
                "All recipient user IDs must be greater than zero.",
                new[]
                {
                    nameof(RecipientUserIds)
                });
        }

        var validRecipientIds =
            RecipientUserIds
                .Where(userId => userId > 0)
                .ToList();

        if (validRecipientIds.Distinct().Count() !=
            validRecipientIds.Count)
        {
            yield return new ValidationResult(
                "Recipient user IDs must not contain duplicates.",
                new[]
                {
                    nameof(RecipientUserIds)
                });
        }

        if (IsPlaceholder(Title))
        {
            yield return new ValidationResult(
                "Notification title contains a placeholder value.",
                new[]
                {
                    nameof(Title)
                });
        }

        if (IsPlaceholder(Message))
        {
            yield return new ValidationResult(
                "Notification message contains a placeholder value.",
                new[]
                {
                    nameof(Message)
                });
        }
    }

    private static bool IsPlaceholder(
        string? value)
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