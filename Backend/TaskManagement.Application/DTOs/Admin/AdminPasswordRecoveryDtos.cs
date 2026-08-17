using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Admin;


public sealed class AdminPasswordRecoveryResponse
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string UserFullName { get; set; } =
        string.Empty;

    public string AccountEmail { get; set; } =
        string.Empty;

    public string RecoveryEmail { get; set; } =
        string.Empty;

    public string Reason { get; set; } =
        string.Empty;

    public string Status { get; set; } =
        string.Empty;

    public int? ReviewedByAdminUserId { get; set; }

    public string? ReviewedByAdminFullName { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? AdminDecisionReason { get; set; }

    public bool CodeSent { get; set; }

    public int? CodeSentByAdminUserId { get; set; }

    public DateTime? CodeSentAt { get; set; }

    public DateTime? CodeExpiresAt { get; set; }

    public bool CodeVerified { get; set; }

    public DateTime? PasswordResetAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime RequestExpiresAt { get; set; }
}


public sealed class RejectPasswordRecoveryRequest
{
    [Required(
        ErrorMessage =
            "Rejection reason is required.")]
    [StringLength(
        1000,
        MinimumLength = 3,
        ErrorMessage =
            "Rejection reason must be between 3 and 1000 characters.")]
    public string Reason { get; set; } =
        string.Empty;
}