using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.DTOs.Auth;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Infrastructure.Identity;

public sealed class PasswordRecoveryService
    : IPasswordRecoveryService
{
    private const int MaxCodeAttempts =
        5;

    private static readonly TimeSpan
        PendingRequestLifetime =
            TimeSpan.FromHours(72);

    private static readonly TimeSpan
        ApprovedRequestLifetime =
            TimeSpan.FromHours(48);

    private static readonly TimeSpan
        VerificationCodeLifetime =
            TimeSpan.FromMinutes(15);

    private static readonly TimeSpan
        ResetTokenLifetime =
            TimeSpan.FromMinutes(15);


    private readonly UserManager<User>
        _userManager;

    private readonly IApplicationDbContext
        _dbContext;

    private readonly ICurrentUserService
        _currentUserService;

    private readonly INotificationService
        _notificationService;

    private readonly IEmailService
        _emailService;

    private readonly byte[]
        _hashKey;


    public PasswordRecoveryService(
        UserManager<User> userManager,
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        INotificationService notificationService,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _userManager =
            userManager;

        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;

        _notificationService =
            notificationService;

        _emailService =
            emailService;


        var hashKey =
            configuration[
                "PasswordRecovery:HashKey"]
            ??
            configuration[
                "Jwt:Key"];


        if (string.IsNullOrWhiteSpace(
                hashKey))
        {
            throw new InvalidOperationException(
                "Password recovery hash key is not configured.");
        }


        _hashKey =
            Encoding.UTF8
                .GetBytes(
                    hashKey);
    }


    /* =========================================================
       PUBLIC - CREATE
       ========================================================= */

    public async Task<PasswordRecoveryPublicStatusResponse>
        CreateRequestAsync(
            CreatePasswordRecoveryRequest request)
    {
        var accountEmail =
            request.AccountEmail
                .Trim();


        var recoveryEmail =
            request.RecoveryEmail
                .Trim();


        var reason =
            request.Reason
                .Trim();


        var user =
            await _userManager
                .FindByEmailAsync(
                    accountEmail);


        if (user is null ||
            !user.IsActive ||
            user.IsDeleted)
        {
            throw new NotFoundException(
                "Account not found or unavailable.");
        }


        var existingRequest =
            await _dbContext
                .PasswordRecoveryRequests
                .Where(item =>
                    item.UserId ==
                        user.Id &&
                    !item.IsDeleted &&
                    item.PasswordResetAt ==
                        null &&
                    (
                        item.Status ==
                            PasswordRecoveryStatus.Pending ||
                        item.Status ==
                            PasswordRecoveryStatus.Approved
                    ))
                .OrderByDescending(item =>
                    item.CreatedAt)
                .FirstOrDefaultAsync();


        if (existingRequest is not null)
        {
            await ExpireIfNeededAsync(
                existingRequest);


            if (
                existingRequest.Status ==
                    PasswordRecoveryStatus.Pending ||
                existingRequest.Status ==
                    PasswordRecoveryStatus.Approved)
            {
                return BuildPublicStatus(
                    existingRequest);
            }
        }


        var now =
            DateTime.UtcNow;


        var recoveryRequest =
            new PasswordRecoveryRequest
            {
                UserId =
                    user.Id,

                AccountEmail =
                    user.Email
                    ?? accountEmail,

                RecoveryEmail =
                    recoveryEmail,

                Reason =
                    reason,

                Status =
                    PasswordRecoveryStatus.Pending,

                PublicToken =
                    GenerateSecureToken(),

                RequestExpiresAt =
                    now.Add(
                        PendingRequestLifetime),

                CreatedAt =
                    now
            };


        _dbContext
            .PasswordRecoveryRequests
            .Add(
                recoveryRequest);


        await _dbContext
            .SaveChangesAsync();


        var adminUserIds =
            await GetSystemAdminUserIdsAsync();


        if (adminUserIds.Count > 0)
        {
            await _notificationService
                .CreateSystemManyAsync(
                    adminUserIds,
                    null,
                    "Password recovery request",
                    $"{user.FullName} submitted a password recovery request.",
                    "account.password_recovery.requested",
                    nameof(PasswordRecoveryRequest),
                    recoveryRequest.Id);
        }


        return BuildPublicStatus(
            recoveryRequest);
    }


    /* =========================================================
       PUBLIC - STATUS
       ========================================================= */

    public async Task<PasswordRecoveryPublicStatusResponse>
        GetPublicStatusAsync(
            string publicToken)
    {
        var recoveryRequest =
            await GetByPublicTokenAsync(
                publicToken);


        await ExpireIfNeededAsync(
            recoveryRequest);


        return BuildPublicStatus(
            recoveryRequest);
    }


    /* =========================================================
       PUBLIC - VERIFY CODE
       ========================================================= */

    public async Task<VerifyPasswordRecoveryCodeResponse>
        VerifyCodeAsync(
            VerifyPasswordRecoveryCodeRequest request)
    {
        var recoveryRequest =
            await GetByPublicTokenAsync(
                request.PublicToken);


        await ExpireIfNeededAsync(
            recoveryRequest);


        if (recoveryRequest.Status !=
            PasswordRecoveryStatus.Approved)
        {
            throw new ConflictException(
                "Password recovery request is not approved.");
        }


        if (recoveryRequest.PasswordResetAt.HasValue)
        {
            throw new ConflictException(
                "Password has already been reset using this request.");
        }


        if (string.IsNullOrWhiteSpace(
                recoveryRequest.CodeHash) ||
            !recoveryRequest.CodeExpiresAt.HasValue)
        {
            throw new ConflictException(
                "Verification code has not been sent yet.");
        }


        var now =
            DateTime.UtcNow;


        if (recoveryRequest.CodeExpiresAt.Value <=
            now)
        {
            recoveryRequest.Status =
                PasswordRecoveryStatus.Expired;

            recoveryRequest.UpdatedAt =
                now;


            await _dbContext
                .SaveChangesAsync();


            throw new ConflictException(
                "Verification code has expired.");
        }


        var suppliedHash =
            HashValue(
                recoveryRequest.PublicToken +
                ":" +
                request.Code.Trim());


        if (!FixedTimeEquals(
                recoveryRequest.CodeHash,
                suppliedHash))
        {
            recoveryRequest.CodeAttemptCount++;


            if (recoveryRequest.CodeAttemptCount >=
                MaxCodeAttempts)
            {
                recoveryRequest.Status =
                    PasswordRecoveryStatus.Expired;
            }


            recoveryRequest.UpdatedAt =
                now;


            await _dbContext
                .SaveChangesAsync();


            if (recoveryRequest.Status ==
                PasswordRecoveryStatus.Expired)
            {
                throw new ConflictException(
                    "Verification code is no longer valid because the maximum number of attempts was exceeded.");
            }


            throw new BadRequestException(
                "Verification code is incorrect.");
        }


        var resetToken =
            GenerateSecureToken();


        var resetExpiresAt =
            now.Add(
                ResetTokenLifetime);


        recoveryRequest.CodeVerifiedAt =
            now;

        recoveryRequest.ResetTokenHash =
            HashValue(
                recoveryRequest.PublicToken +
                ":" +
                resetToken);

        recoveryRequest.ResetTokenExpiresAt =
            resetExpiresAt;

        recoveryRequest.RequestExpiresAt =
            resetExpiresAt;

        recoveryRequest.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        return new VerifyPasswordRecoveryCodeResponse
        {
            ResetToken =
                resetToken,

            ExpiresAt =
                resetExpiresAt
        };
    }


    /* =========================================================
       PUBLIC - RESET PASSWORD
       ========================================================= */

    public async Task ResetPasswordAsync(
        ResetForgottenPasswordRequest request)
    {
        var recoveryRequest =
            await GetByPublicTokenAsync(
                request.PublicToken);


        await ExpireIfNeededAsync(
            recoveryRequest);


        if (recoveryRequest.Status !=
            PasswordRecoveryStatus.Approved)
        {
            throw new ConflictException(
                "Password recovery request is not approved.");
        }


        if (recoveryRequest.PasswordResetAt.HasValue)
        {
            throw new ConflictException(
                "Password has already been reset using this request.");
        }


        if (string.IsNullOrWhiteSpace(
                recoveryRequest.ResetTokenHash) ||
            !recoveryRequest.ResetTokenExpiresAt.HasValue)
        {
            throw new ConflictException(
                "Verification code must be confirmed first.");
        }


        var now =
            DateTime.UtcNow;


        if (recoveryRequest.ResetTokenExpiresAt.Value <=
            now)
        {
            recoveryRequest.Status =
                PasswordRecoveryStatus.Expired;

            recoveryRequest.UpdatedAt =
                now;


            await _dbContext
                .SaveChangesAsync();


            throw new ConflictException(
                "Password reset authorization has expired.");
        }


        var suppliedResetHash =
            HashValue(
                recoveryRequest.PublicToken +
                ":" +
                request.ResetToken.Trim());


        if (!FixedTimeEquals(
                recoveryRequest.ResetTokenHash,
                suppliedResetHash))
        {
            throw new UnauthorizedException(
                "Invalid password reset authorization.");
        }


        var user =
            await _dbContext
                .Users
                .FirstOrDefaultAsync(
                    user =>
                        user.Id ==
                            recoveryRequest.UserId &&
                        user.IsActive &&
                        !user.IsDeleted);


        if (user is null)
        {
            throw new NotFoundException(
                "User account is not available.");
        }


        /*
         * نستخدم Token Provider الرسمي لـ Identity،
         * ولكن فقط بعد نجاح تدفق الموافقة والكود الخاص بنا.
         */
        var identityResetToken =
            await _userManager
                .GeneratePasswordResetTokenAsync(
                    user);


        var resetResult =
            await _userManager
                .ResetPasswordAsync(
                    user,
                    identityResetToken,
                    request.NewPassword);


        EnsureIdentitySucceeded(
            resetResult);


        /*
         * Recovery = حالة أمنية قوية.
         * لذلك نلغي جميع الجلسات.
         */
        var activeSessions =
            await _dbContext
                .UserSessions
                .Where(session =>
                    session.UserId ==
                        user.Id &&
                    session.RevokedAt ==
                        null &&
                    !session.IsDeleted)
                .ToListAsync();


        foreach (
            var session
            in activeSessions)
        {
            session.RevokedAt =
                now;

            session.UpdatedAt =
                now;
        }


        user.TokenVersion++;

        user.UpdatedAt =
            now;


        recoveryRequest.PasswordResetAt =
            now;

        recoveryRequest.CodeHash =
            null;

        recoveryRequest.ResetTokenHash =
            null;

        recoveryRequest.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        var recipients =
            await GetSystemAdminUserIdsAsync();


        recipients.Add(
            user.Id);


        await _notificationService
            .CreateSystemManyAsync(
                recipients.Distinct(),
                null,
                "Password reset completed",
                $"Password recovery was completed for account {user.Email}. All previous sessions were revoked.",
                "account.password_recovery.completed",
                nameof(PasswordRecoveryRequest),
                recoveryRequest.Id);
    }


    /* =========================================================
       ADMIN - LIST
       ========================================================= */

    public async Task<List<AdminPasswordRecoveryResponse>>
        GetAdminRequestsAsync(
            PasswordRecoveryStatus? status)
    {
        await EnsureSystemAdminAsync();


        await ExpireOldRequestsAsync();


        var query =
            _dbContext
                .PasswordRecoveryRequests
                .AsNoTracking()
                .Include(item =>
                    item.User)
                .Include(item =>
                    item.ReviewedByAdminUser)
                .Where(item =>
                    !item.IsDeleted);


        if (status.HasValue)
        {
            query =
                query.Where(item =>
                    item.Status ==
                    status.Value);
        }


        var requests =
            await query
                .OrderByDescending(item =>
                    item.CreatedAt)
                .ToListAsync();


        return requests
            .Select(
                MapAdminResponse)
            .ToList();
    }


    public async Task<AdminPasswordRecoveryResponse>
        GetAdminRequestByIdAsync(
            int requestId)
    {
        await EnsureSystemAdminAsync();


        var recoveryRequest =
            await GetAdminRequestAsync(
                requestId);


        await ExpireIfNeededAsync(
            recoveryRequest);


        return MapAdminResponse(
            recoveryRequest);
    }


    /* =========================================================
       ADMIN - APPROVE
       ========================================================= */

    public async Task<AdminPasswordRecoveryResponse>
        ApproveAsync(
            int requestId)
    {
        var admin =
            await EnsureSystemAdminAsync();


        var recoveryRequest =
            await GetAdminRequestAsync(
                requestId);


        await ExpireIfNeededAsync(
            recoveryRequest);


        if (recoveryRequest.Status !=
            PasswordRecoveryStatus.Pending)
        {
            throw new ConflictException(
                "Only pending password recovery requests can be approved.");
        }


        var now =
            DateTime.UtcNow;


        recoveryRequest.Status =
            PasswordRecoveryStatus.Approved;

        recoveryRequest.ReviewedByAdminUserId =
            admin.Id;

        recoveryRequest.ReviewedByAdminUser =
            admin;

        recoveryRequest.ReviewedAt =
            now;

        recoveryRequest.AdminDecisionReason =
            null;

        recoveryRequest.RequestExpiresAt =
            now.Add(
                ApprovedRequestLifetime);

        recoveryRequest.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        await _notificationService
            .CreateManyAsync(
                new[]
                {
                    recoveryRequest.UserId
                },
                null,
                "Password recovery approved",
                "Your password recovery request was approved. Waiting for the administrator to send the verification code.",
                "account.password_recovery.approved",
                nameof(PasswordRecoveryRequest),
                recoveryRequest.Id);


        return MapAdminResponse(
            recoveryRequest);
    }


    /* =========================================================
       ADMIN - REJECT
       ========================================================= */

    public async Task<AdminPasswordRecoveryResponse>
        RejectAsync(
            int requestId,
            RejectPasswordRecoveryRequest request)
    {
        var admin =
            await EnsureSystemAdminAsync();


        var recoveryRequest =
            await GetAdminRequestAsync(
                requestId);


        await ExpireIfNeededAsync(
            recoveryRequest);


        if (
            recoveryRequest.Status !=
                PasswordRecoveryStatus.Pending &&
            recoveryRequest.Status !=
                PasswordRecoveryStatus.Approved)
        {
            throw new ConflictException(
                "This password recovery request cannot be rejected.");
        }


        if (recoveryRequest.CodeSentAt.HasValue)
        {
            throw new ConflictException(
                "A request cannot be rejected after the verification code has been sent.");
        }


        var rejectionReason =
            request.Reason.Trim();


        var now =
            DateTime.UtcNow;


        recoveryRequest.Status =
            PasswordRecoveryStatus.Rejected;

        recoveryRequest.ReviewedByAdminUserId =
            admin.Id;

        recoveryRequest.ReviewedByAdminUser =
            admin;

        recoveryRequest.ReviewedAt =
            now;

        recoveryRequest.AdminDecisionReason =
            rejectionReason;

        recoveryRequest.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        await _notificationService
            .CreateManyAsync(
                new[]
                {
                    recoveryRequest.UserId
                },
                null,
                "Password recovery rejected",
                $"Your password recovery request was rejected. Reason: {rejectionReason}",
                "account.password_recovery.rejected",
                nameof(PasswordRecoveryRequest),
                recoveryRequest.Id);


        return MapAdminResponse(
            recoveryRequest);
    }


    /* =========================================================
       ADMIN - SEND SIX DIGIT CODE
       ========================================================= */

    public async Task<AdminPasswordRecoveryResponse>
        SendCodeAsync(
            int requestId)
    {
        var admin =
            await EnsureSystemAdminAsync();


        var recoveryRequest =
            await GetAdminRequestAsync(
                requestId);


        await ExpireIfNeededAsync(
            recoveryRequest);


        if (recoveryRequest.Status !=
            PasswordRecoveryStatus.Approved)
        {
            throw new ConflictException(
                "Password recovery request must be approved before sending a verification code.");
        }


        if (recoveryRequest.PasswordResetAt.HasValue)
        {
            throw new ConflictException(
                "Password has already been reset using this request.");
        }


        if (recoveryRequest.CodeSentAt.HasValue)
        {
            throw new ConflictException(
                "Verification code has already been sent for this request.");
        }


        var code =
            RandomNumberGenerator
                .GetInt32(
                    0,
                    1_000_000)
                .ToString("D6");


        var now =
            DateTime.UtcNow;


        var expiresAt =
            now.Add(
                VerificationCodeLifetime);


        /*
         * أولًا نرسل البريد.
         * إذا فشل SMTP لا نسجل أن الكود تم إرساله.
         */
        await _emailService
            .SendAsync(
                recoveryRequest.RecoveryEmail,
                "TaskManagement - Password Reset Code",
                BuildResetCodeEmail(
                    recoveryRequest.User.FullName,
                    code,
                    expiresAt));


        recoveryRequest.CodeHash =
            HashValue(
                recoveryRequest.PublicToken +
                ":" +
                code);

        recoveryRequest.CodeSentAt =
            now;

        recoveryRequest.CodeExpiresAt =
            expiresAt;

        recoveryRequest.CodeSentByAdminUserId =
            admin.Id;

        recoveryRequest.CodeSentByAdminUser =
            admin;

        recoveryRequest.CodeAttemptCount =
            0;

        recoveryRequest.RequestExpiresAt =
            expiresAt;

        recoveryRequest.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        await _notificationService
            .CreateManyAsync(
                new[]
                {
                    recoveryRequest.UserId
                },
                null,
                "Password recovery code sent",
                $"A 6-digit password recovery code was sent to {MaskEmail(recoveryRequest.RecoveryEmail)}.",
                "account.password_recovery.code_sent",
                nameof(PasswordRecoveryRequest),
                recoveryRequest.Id);


        return MapAdminResponse(
            recoveryRequest);
    }


    /* =========================================================
       HELPERS
       ========================================================= */

    private async Task<User>
        EnsureSystemAdminAsync()
    {
        var currentUserId =
            _currentUserService.UserId;


        var admin =
            await _dbContext
                .Users
                .FirstOrDefaultAsync(
                    user =>
                        user.Id ==
                            currentUserId &&
                        user.IsSystemAdmin &&
                        user.IsActive &&
                        !user.IsDeleted);


        if (admin is null)
        {
            throw new ForbiddenException(
                "System Administrator access is required.");
        }


        return admin;
    }


    private async Task<PasswordRecoveryRequest>
        GetByPublicTokenAsync(
            string publicToken)
    {
        var normalizedToken =
            publicToken.Trim();


        var recoveryRequest =
            await _dbContext
                .PasswordRecoveryRequests
                .Include(item =>
                    item.User)
                .FirstOrDefaultAsync(
                    item =>
                        item.PublicToken ==
                            normalizedToken &&
                        !item.IsDeleted);


        if (recoveryRequest is null)
        {
            throw new NotFoundException(
                "Password recovery request not found.");
        }


        return recoveryRequest;
    }


    private async Task<PasswordRecoveryRequest>
        GetAdminRequestAsync(
            int requestId)
    {
        var recoveryRequest =
            await _dbContext
                .PasswordRecoveryRequests
                .Include(item =>
                    item.User)
                .Include(item =>
                    item.ReviewedByAdminUser)
                .FirstOrDefaultAsync(
                    item =>
                        item.Id ==
                            requestId &&
                        !item.IsDeleted);


        if (recoveryRequest is null)
        {
            throw new NotFoundException(
                "Password recovery request not found.");
        }


        return recoveryRequest;
    }


    private async Task
        ExpireIfNeededAsync(
            PasswordRecoveryRequest request)
    {
        if (
            request.PasswordResetAt.HasValue ||
            request.Status ==
                PasswordRecoveryStatus.Rejected ||
            request.Status ==
                PasswordRecoveryStatus.Expired)
        {
            return;
        }


        if (request.RequestExpiresAt >
            DateTime.UtcNow)
        {
            return;
        }


        request.Status =
            PasswordRecoveryStatus.Expired;

        request.UpdatedAt =
            DateTime.UtcNow;


        await _dbContext
            .SaveChangesAsync();
    }


    private async Task
        ExpireOldRequestsAsync()
    {
        var now =
            DateTime.UtcNow;


        var expiredRequests =
            await _dbContext
                .PasswordRecoveryRequests
                .Where(item =>
                    !item.IsDeleted &&
                    item.PasswordResetAt ==
                        null &&
                    (
                        item.Status ==
                            PasswordRecoveryStatus.Pending ||
                        item.Status ==
                            PasswordRecoveryStatus.Approved
                    ) &&
                    item.RequestExpiresAt <=
                        now)
                .ToListAsync();


        if (expiredRequests.Count ==
            0)
        {
            return;
        }


        foreach (
            var recoveryRequest
            in expiredRequests)
        {
            recoveryRequest.Status =
                PasswordRecoveryStatus.Expired;

            recoveryRequest.UpdatedAt =
                now;
        }


        await _dbContext
            .SaveChangesAsync();
    }


    private async Task<List<int>>
        GetSystemAdminUserIdsAsync()
    {
        return await _dbContext
            .Users
            .AsNoTracking()
            .Where(user =>
                user.IsSystemAdmin &&
                user.IsActive &&
                !user.IsDeleted)
            .Select(user =>
                user.Id)
            .ToListAsync();
    }


    private string HashValue(
        string value)
    {
        using var hmac =
            new HMACSHA256(
                _hashKey);


        return Convert.ToHexString(
            hmac.ComputeHash(
                Encoding.UTF8
                    .GetBytes(
                        value)));
    }


    private static bool FixedTimeEquals(
        string expectedHash,
        string suppliedHash)
    {
        try
        {
            var expected =
                Convert.FromHexString(
                    expectedHash);

            var supplied =
                Convert.FromHexString(
                    suppliedHash);


            return CryptographicOperations
                .FixedTimeEquals(
                    expected,
                    supplied);
        }
        catch
        {
            return false;
        }
    }


    private static string
        GenerateSecureToken()
    {
        return Convert
            .ToHexString(
                RandomNumberGenerator
                    .GetBytes(32))
            .ToLowerInvariant();
    }


    private static string
        MaskEmail(
            string email)
    {
        var atIndex =
            email.IndexOf('@');


        if (atIndex <= 1)
        {
            return "***";
        }


        var prefix =
            email[..atIndex];


        var domain =
            email[atIndex..];


        return
            prefix[0] +
            new string(
                '*',
                Math.Min(
                    prefix.Length - 1,
                    6)) +
            domain;
    }


    private static string
        BuildResetCodeEmail(
            string fullName,
            string code,
            DateTime expiresAt)
    {
        var safeName =
            WebUtility.HtmlEncode(
                fullName);


        var safeCode =
            WebUtility.HtmlEncode(
                code);


        return $"""
                <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;max-width:560px;margin:auto">
                    <h2>TaskManagement</h2>

                    <p>مرحبًا {safeName}،</p>

                    <p>
                        تمت الموافقة على طلب إعادة تعيين كلمة المرور.
                        رمز التحقق الخاص بك هو:
                    </p>

                    <div style="
                        font-size:32px;
                        font-weight:800;
                        letter-spacing:8px;
                        padding:18px;
                        margin:20px 0;
                        text-align:center;
                        border-radius:12px;
                        background:#f3f4f8;">
                        {safeCode}
                    </div>

                    <p>
                        الرمز صالح لمدة 15 دقيقة فقط.
                    </p>

                    <p>
                        لا تشارك هذا الرمز مع أي شخص.
                    </p>

                    <small>
                        انتهاء الصلاحية:
                        {expiresAt:yyyy-MM-dd HH:mm} UTC
                    </small>
                </div>
                """;
    }


    private static PasswordRecoveryPublicStatusResponse
        BuildPublicStatus(
            PasswordRecoveryRequest request)
    {
        var status =
            request.Status.ToString();


        string message;


        if (request.PasswordResetAt.HasValue)
        {
            message =
                "تمت إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.";
        }
        else
        {
            message =
                request.Status switch
                {
                    PasswordRecoveryStatus.Pending =>
                        "تم استلام طلبك بنجاح، وهو الآن بانتظار مراجعة مدير النظام.",

                    PasswordRecoveryStatus.Rejected =>
                        "تعذر اعتماد طلب إعادة تعيين كلمة المرور.",

                    PasswordRecoveryStatus.Expired =>
                        "انتهت صلاحية طلب الاستعادة أو رمز التحقق. يمكنك إنشاء طلب جديد.",

                    PasswordRecoveryStatus.Approved
                        when !request.CodeSentAt.HasValue =>
                            "تمت الموافقة على طلبك. بانتظار إرسال رمز الاستعادة من مدير النظام.",

                    PasswordRecoveryStatus.Approved
                        when request.CodeVerifiedAt.HasValue =>
                            "تم التحقق من رمز الاستعادة. يمكنك الآن تعيين كلمة مرور جديدة.",

                    PasswordRecoveryStatus.Approved =>
                        "تم إرسال رمز تحقق مكوّن من 6 أرقام إلى بريد الاستعادة. أدخل الرمز للمتابعة.",

                    _ =>
                        "حالة طلب الاستعادة غير معروفة."
                };
        }


        return new PasswordRecoveryPublicStatusResponse
        {
            PublicToken =
                request.PublicToken,

            Status =
                status,

            Message =
                message,

            RecoveryEmailMasked =
                MaskEmail(
                    request.RecoveryEmail),

            CodeSent =
                request.CodeSentAt.HasValue,

            CodeVerified =
                request.CodeVerifiedAt.HasValue,

            CanEnterCode =
                request.Status ==
                    PasswordRecoveryStatus.Approved &&
                request.CodeSentAt.HasValue &&
                !request.PasswordResetAt.HasValue,

            CanCreateNewRequest =
                request.Status ==
                    PasswordRecoveryStatus.Rejected ||
                request.Status ==
                    PasswordRecoveryStatus.Expired,

            IsResetCompleted =
                request.PasswordResetAt.HasValue,

            CreatedAt =
                request.CreatedAt,

            ReviewedAt =
                request.ReviewedAt,

            CodeExpiresAt =
                request.CodeExpiresAt,

            PasswordResetAt =
                request.PasswordResetAt,

            RejectionReason =
                request.Status ==
                    PasswordRecoveryStatus.Rejected
                    ? request.AdminDecisionReason
                    : null
        };
    }


    private static AdminPasswordRecoveryResponse
        MapAdminResponse(
            PasswordRecoveryRequest request)
    {
        return new AdminPasswordRecoveryResponse
        {
            Id =
                request.Id,

            UserId =
                request.UserId,

            UserFullName =
                request.User.FullName,

            AccountEmail =
                request.AccountEmail,

            RecoveryEmail =
                request.RecoveryEmail,

            Reason =
                request.Reason,

            Status =
                request.Status.ToString(),

            ReviewedByAdminUserId =
                request.ReviewedByAdminUserId,

            ReviewedByAdminFullName =
                request.ReviewedByAdminUser
                    ?.FullName,

            ReviewedAt =
                request.ReviewedAt,

            AdminDecisionReason =
                request.AdminDecisionReason,

            CodeSent =
                request.CodeSentAt.HasValue,

            CodeSentByAdminUserId =
                request.CodeSentByAdminUserId,

            CodeSentAt =
                request.CodeSentAt,

            CodeExpiresAt =
                request.CodeExpiresAt,

            CodeVerified =
                request.CodeVerifiedAt.HasValue,

            PasswordResetAt =
                request.PasswordResetAt,

            CreatedAt =
                request.CreatedAt,

            RequestExpiresAt =
                request.RequestExpiresAt
        };
    }


    private static void
        EnsureIdentitySucceeded(
            IdentityResult result)
    {
        if (result.Succeeded)
        {
            return;
        }


        var errors =
            string.Join(
                " | ",
                result.Errors
                    .Select(error =>
                        error.Description));


        throw new BadRequestException(
            errors);
    }
}