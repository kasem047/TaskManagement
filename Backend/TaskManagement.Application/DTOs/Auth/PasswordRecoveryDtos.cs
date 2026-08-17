using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Auth;


/* =========================================================
   CREATE REQUEST
   ========================================================= */

public sealed class CreatePasswordRecoveryRequest
{
    [Required(
        ErrorMessage =
            "Account email is required.")]
    [EmailAddress(
        ErrorMessage =
            "Account email format is invalid.")]
    [MaxLength(256)]
    public string AccountEmail { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage =
            "Recovery email is required.")]
    [EmailAddress(
        ErrorMessage =
            "Recovery email format is invalid.")]
    [MaxLength(256)]
    public string RecoveryEmail { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage =
            "Recovery reason is required.")]
    [StringLength(
        1000,
        MinimumLength = 5,
        ErrorMessage =
            "Recovery reason must be between 5 and 1000 characters.")]
    public string Reason { get; set; } =
        string.Empty;
}


/* =========================================================
   PUBLIC STATUS
   ========================================================= */

public sealed class PasswordRecoveryPublicStatusResponse
{
    public string PublicToken { get; set; } =
        string.Empty;

    public string Status { get; set; } =
        string.Empty;

    public string Message { get; set; } =
        string.Empty;

    public string RecoveryEmailMasked { get; set; } =
        string.Empty;

    public bool CodeSent { get; set; }

    public bool CodeVerified { get; set; }

    public bool CanEnterCode { get; set; }

    public bool CanCreateNewRequest { get; set; }

    public bool IsResetCompleted { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime? CodeExpiresAt { get; set; }

    public DateTime? PasswordResetAt { get; set; }

    public string? RejectionReason { get; set; }
}


/* =========================================================
   VERIFY SIX DIGIT CODE
   ========================================================= */

public sealed class VerifyPasswordRecoveryCodeRequest
{
    [Required]
    public string PublicToken { get; set; } =
        string.Empty;


    [Required]
    [RegularExpression(
        @"^\d{6}$",
        ErrorMessage =
            "Verification code must contain exactly 6 digits.")]
    public string Code { get; set; } =
        string.Empty;
}


public sealed class VerifyPasswordRecoveryCodeResponse
{
    public string ResetToken { get; set; } =
        string.Empty;

    public DateTime ExpiresAt { get; set; }
}


/* =========================================================
   RESET PASSWORD
   ========================================================= */

public sealed class ResetForgottenPasswordRequest
    : IValidatableObject
{
    [Required]
    public string PublicToken { get; set; } =
        string.Empty;


    [Required]
    public string ResetToken { get; set; } =
        string.Empty;


    [Required]
    [StringLength(
        100,
        MinimumLength = 8,
        ErrorMessage =
            "Password must be between 8 and 100 characters.")]
    [RegularExpression(
        @"^(?=.*[a-z])(?=.*\d).+$",
        ErrorMessage =
            "Password must contain at least one lowercase letter and one digit.")]
    public string NewPassword { get; set; } =
        string.Empty;


    [Required]
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
    }
}