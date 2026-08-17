using System.ComponentModel.DataAnnotations;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.DTOs.Tasks;

public sealed class UpdateTaskStatusRequest
    : IValidatableObject
{
    [EnumDataType(
        typeof(TaskItemStatus),
        ErrorMessage =
            "Invalid task status.")]
    public TaskItemStatus Status { get; set; }


    [Range(
        0,
        double.MaxValue,
        ErrorMessage =
            "Position must be zero or greater.")]
    public double Position { get; set; }


    /* =========================================================
       PARTIAL PROGRESS
       ========================================================= */

    [Range(
        1,
        99,
        ErrorMessage =
            "Progress percentage must be between 1 and 99.")]
    public int? ProgressPercentage { get; set; }


    [StringLength(
        1000,
        ErrorMessage =
            "Progress note cannot exceed 1000 characters.")]
    public string? ProgressNote { get; set; }


    /* =========================================================
       REJECT / REOPEN REASON
       ========================================================= */

    /*
     * هذا الحقل سنستخدمه عند:
     *
     * - إعادة المهمة للخلف
     * - رفض الإنجاز
     * - إعادة فتح مهمة مكتملة
     *
     * خصوصًا للـProjectManager / WorkspaceOwner.
     */
    [StringLength(
        1000,
        ErrorMessage =
            "Status change reason cannot exceed 1000 characters.")]
    public string? ChangeReason { get; set; }


    /* =========================================================
       VALIDATION
       ========================================================= */

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        /*
         * PartiallyCompleted = القيمة 3.
         *
         * بما أن InReview حاليًا Alias
         * لنفس القيمة، فهذا الشرط يغطي الاثنين.
         */
        if (
            Status ==
            TaskItemStatus.PartiallyCompleted)
        {
            if (
                !ProgressPercentage.HasValue)
            {
                yield return new ValidationResult(
                    "Progress percentage is required for a partially completed task.",
                    new[]
                    {
                        nameof(ProgressPercentage)
                    });
            }


            if (
                string.IsNullOrWhiteSpace(
                    ProgressNote))
            {
                yield return new ValidationResult(
                    "Progress note is required for a partially completed task.",
                    new[]
                    {
                        nameof(ProgressNote)
                    });
            }
            else
            {
                var normalizedNote =
                    ProgressNote.Trim();


                if (
                    normalizedNote.Length < 3)
                {
                    yield return new ValidationResult(
                        "Progress note must contain at least 3 characters.",
                        new[]
                        {
                            nameof(ProgressNote)
                        });
                }


                if (
                    IsPlaceholder(
                        normalizedNote))
                {
                    yield return new ValidationResult(
                        "Progress note contains a placeholder value.",
                        new[]
                        {
                            nameof(ProgressNote)
                        });
                }
            }
        }


        if (
            !string.IsNullOrWhiteSpace(
                ChangeReason) &&
            IsPlaceholder(
                ChangeReason))
        {
            yield return new ValidationResult(
                "Status change reason contains a placeholder value.",
                new[]
                {
                    nameof(ChangeReason)
                });
        }
    }


    private static bool IsPlaceholder(
        string? value)
    {
        if (
            string.IsNullOrWhiteSpace(
                value))
        {
            return false;
        }


        return value
            .Trim()
            .ToLowerInvariant() is
                "string" or
                "example" or
                "sample" or
                "null" or
                "undefined";
    }
}