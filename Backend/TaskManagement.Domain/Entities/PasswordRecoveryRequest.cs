using TaskManagement.Domain.Common;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Domain.Entities;

public class PasswordRecoveryRequest
    : BaseEntity
{
    public int UserId { get; set; }

    public User User { get; set; } = null!;


    public string AccountEmail { get; set; } =
        string.Empty;

    public string RecoveryEmail { get; set; } =
        string.Empty;

    public string Reason { get; set; } =
        string.Empty;


    public PasswordRecoveryStatus Status { get; set; } =
        PasswordRecoveryStatus.Pending;


    /*
     * Token محفوظ لدى Frontend حتى يتمكن
     * المستخدم من العودة لنفس الطلب
     * دون إدخال البيانات مرة ثانية.
     */
    public string PublicToken { get; set; } =
        string.Empty;


    public DateTime RequestExpiresAt { get; set; }


    /* =========================
       ADMIN REVIEW
       ========================= */

    public int? ReviewedByAdminUserId { get; set; }

    public User? ReviewedByAdminUser { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? AdminDecisionReason { get; set; }


    /* =========================
       SIX DIGIT CODE
       ========================= */

    public int? CodeSentByAdminUserId { get; set; }

    public User? CodeSentByAdminUser { get; set; }

    public string? CodeHash { get; set; }

    public DateTime? CodeSentAt { get; set; }

    public DateTime? CodeExpiresAt { get; set; }

    public int CodeAttemptCount { get; set; }

    public DateTime? CodeVerifiedAt { get; set; }


    /* =========================
       RESET TOKEN
       ========================= */

    public string? ResetTokenHash { get; set; }

    public DateTime? ResetTokenExpiresAt { get; set; }


    /*
     * لا نضيف Completed إلى Status.
     * نجاح إعادة التعيين يتم تمثيله بهذا الحقل.
     */
    public DateTime? PasswordResetAt { get; set; }
}