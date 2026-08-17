using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Auth;

public sealed class ChangePasswordRequest
    : IValidatableObject
{
    [Required(
        ErrorMessage =
            "Current password is required.")]
    public string CurrentPassword { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage =
            "New password is required.")]
    [StringLength(
        100,
        MinimumLength = 8,
        ErrorMessage =
            "New password must be between 8 and 100 characters.")]
    [RegularExpression(
        @"^(?=.*[a-z])(?=.*\d).+$",
        ErrorMessage =
            "New password must contain at least one lowercase letter and one digit.")]
    public string NewPassword { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage =
            "Password confirmation is required.")]
    public string ConfirmNewPassword { get; set; } =
        string.Empty;


    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (NewPassword !=
            ConfirmNewPassword)
        {
            yield return new ValidationResult(
                "New password and confirmation do not match.",
                new[]
                {
                    nameof(ConfirmNewPassword)
                });
        }


        if (CurrentPassword ==
            NewPassword)
        {
            yield return new ValidationResult(
                "New password must be different from the current password.",
                new[]
                {
                    nameof(NewPassword)
                });
        }
    }
}