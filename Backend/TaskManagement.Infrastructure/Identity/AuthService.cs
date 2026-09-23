using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Auth;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Identity;

public sealed class AuthService
    : IAuthService
{
    private readonly UserManager<User>
        _userManager;

    private readonly IApplicationDbContext
        _dbContext;

    private readonly IJwtTokenService
        _jwtTokenService;

    private readonly IConfiguration
        _configuration;

    private readonly ICurrentUserService
        _currentUserService;

    private readonly INotificationService
        _notificationService;


    public AuthService(
        UserManager<User> userManager,
        IApplicationDbContext dbContext,
        IJwtTokenService jwtTokenService,
        IConfiguration configuration,
        ICurrentUserService currentUserService,
        INotificationService notificationService)
    {
        _userManager =
            userManager;

        _dbContext =
            dbContext;

        _jwtTokenService =
            jwtTokenService;

        _configuration =
            configuration;

        _currentUserService =
            currentUserService;

        _notificationService =
            notificationService;
    }


    /* =========================================================
       REGISTER
       ========================================================= */

    public async Task<AuthResponse> RegisterAsync(
        RegisterRequest request)
    {
        var email =
            request.Email.Trim();


        var existingUser =
            await _userManager
                .FindByEmailAsync(
                    email);


        if (existingUser is not null)
        {
            throw new ConflictException(
                "Email is already registered.");
        }


        var user =
            new User
            {
                FullName =
                    request.FullName.Trim(),

                Email =
                    email,

                UserName =
                    email,

                IsActive =
                    true,

                TokenVersion =
                    1,

                CreatedAt =
                    DateTime.UtcNow
            };


        var result =
            await _userManager.CreateAsync(
                user,
                request.Password);


        EnsureIdentitySucceeded(
            result);


        return await CreateAuthResponseAsync(
            user,
            request.DeviceId,
            request.DeviceName);
    }


    /* =========================================================
       LOGIN
       ========================================================= */

    public async Task<AuthResponse> LoginAsync(
        LoginRequest request)
    {
        var email =
            request.Email.Trim();


        var user =
            await _userManager
                .FindByEmailAsync(
                    email);


        if (user is null)
        {
            throw new UnauthorizedException(
                "Invalid email or password.");
        }


        if (!user.IsActive ||
            user.IsDeleted)
        {
            throw new ForbiddenException(
                "User account is disabled.");
        }


        var passwordValid =
            await _userManager
                .CheckPasswordAsync(
                    user,
                    request.Password);


        if (!passwordValid)
        {
            throw new UnauthorizedException(
                "Invalid email or password.");
        }


        user.LastLoginAt =
            DateTime.UtcNow;


        await _userManager
            .UpdateAsync(
                user);


        return await CreateAuthResponseAsync(
            user,
            request.DeviceId,
            request.DeviceName);
    }


    /* =========================================================
       PROFILE
       ========================================================= */

    public async Task<AccountProfileResponse>
        GetProfileAsync()
    {
        var user =
            await GetCurrentUserAsync();


        return MapProfile(
            user);
    }


    public async Task<AccountProfileResponse>
        UpdateProfileAsync(
            UpdateProfileRequest request)
    {
        var user =
            await GetCurrentUserAsync();


        var normalizedFullName =
            request.FullName.Trim();


        if (user.FullName ==
            normalizedFullName)
        {
            return MapProfile(
                user);
        }


        user.FullName =
            normalizedFullName;

        user.UpdatedAt =
            DateTime.UtcNow;


        var result =
            await _userManager
                .UpdateAsync(
                    user);


        EnsureIdentitySucceeded(
            result);


        await _notificationService
            .CreateSystemManyAsync(
                new[]
                {
                    user.Id
                },
                null,
                "تم تحديث الملف الشخصي",
                "تم تحديث بيانات ملفك الشخصي.",
                "account.profile_updated",
                nameof(User),
                user.Id);


        return MapProfile(
            user);
    }


    /* =========================================================
       EMAIL
       ========================================================= */

    public async Task<AccountProfileResponse>
        ChangeEmailAsync(
            ChangeEmailRequest request)
    {
        var user =
            await GetCurrentUserAsync();

        if (!user.IsSystemAdmin)
        {
            throw new ForbiddenException(
                "Email cannot be changed from the account page.");
        }


        var passwordValid =
            await _userManager
                .CheckPasswordAsync(
                    user,
                    request.CurrentPassword);


        if (!passwordValid)
        {
            throw new UnauthorizedException(
                "Current password is incorrect.");
        }


        var newEmail =
            request.NewEmail
                .Trim();


        if (string.Equals(
                user.Email,
                newEmail,
                StringComparison.OrdinalIgnoreCase))
        {
            return MapProfile(
                user);
        }


        var existingUser =
            await _userManager
                .FindByEmailAsync(
                    newEmail);


        if (existingUser is not null &&
            existingUser.Id != user.Id)
        {
            throw new ConflictException(
                "Email is already registered.");
        }


        var previousEmail =
            user.Email ?? string.Empty;


        user.Email =
            newEmail;

        user.NormalizedEmail =
            _userManager
                .NormalizeEmail(
                    newEmail);

        user.UserName =
            newEmail;

        user.NormalizedUserName =
            _userManager
                .NormalizeName(
                    newEmail);

        user.UpdatedAt =
            DateTime.UtcNow;


        var result =
            await _userManager
                .UpdateAsync(
                    user);


        EnsureIdentitySucceeded(
            result);


        await NotifySecurityEventAsync(
            user.Id,
            "تم تغيير البريد الإلكتروني",
            $"تم تغيير البريد الإلكتروني من \"{previousEmail}\" إلى \"{newEmail}\".",
            "account.email_changed");


        return MapProfile(
            user);
    }


    /* =========================================================
       CHANGE PASSWORD
       ========================================================= */

    public async Task ChangePasswordAsync(
        ChangePasswordRequest request)
    {
        var user =
            await GetCurrentUserAsync();


        var result =
            await _userManager
                .ChangePasswordAsync(
                    user,
                    request.CurrentPassword,
                    request.NewPassword);


        EnsureIdentitySucceeded(
            result);


        var now =
            DateTime.UtcNow;


        var currentSessionId =
            _currentUserService.SessionId;


        /*
         * تغيير كلمة المرور من داخل الحساب:
         * نبقي الجهاز الحالي ونلغي الجلسات الأخرى.
         */
        var otherSessions =
            await _dbContext
                .UserSessions
                .Where(session =>
                    session.UserId ==
                        user.Id &&
                    session.RevokedAt ==
                        null &&
                    !session.IsDeleted &&
                    session.ExpiresAt >
                        now &&
                    (
                        !currentSessionId.HasValue ||
                        session.Id !=
                            currentSessionId.Value
                    ))
                .ToListAsync();


        foreach (
            var session
            in otherSessions)
        {
            session.RevokedAt =
                now;

            session.UpdatedAt =
                now;
        }


        user.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();


        await NotifySecurityEventAsync(
            user.Id,
            "تم تغيير كلمة المرور",
            "تم تغيير كلمة مرور حسابك، وأُلغيت الجلسات النشطة الأخرى.",
            "account.password_changed");
    }


    /* =========================================================
       SESSIONS
       ========================================================= */

    public async Task<List<UserSessionResponse>>
        GetSessionsAsync()
    {
        var userId =
            _currentUserService.UserId;


        var currentSessionId =
            _currentUserService.SessionId
            ?? 0;


        var now =
            DateTime.UtcNow;


        return await _dbContext
            .UserSessions
            .Where(session =>
                session.UserId ==
                    userId &&
                session.RevokedAt ==
                    null &&
                !session.IsDeleted &&
                session.ExpiresAt >
                    now)
            .OrderByDescending(
                session =>
                    session.LastUsedAt
                    ??
                    session.CreatedAt)
            .Select(
                session =>
                    new UserSessionResponse
                    {
                        Id =
                            session.Id,

                        DeviceId =
                            session.DeviceId,

                        DeviceName =
                            session.DeviceName,

                        IpAddress =
                            session.IpAddress,

                        UserAgent =
                            session.UserAgent,

                        ExpiresAt =
                            session.ExpiresAt,

                        LastUsedAt =
                            session.LastUsedAt,

                        CreatedAt =
                            session.CreatedAt,

                        IsCurrentSession =
                            session.Id ==
                            currentSessionId
                    })
            .ToListAsync();
    }


    public async Task LogoutAsync()
    {
        var userId =
            _currentUserService.UserId;

        var sessionId =
            _currentUserService.SessionId;


        if (sessionId is null)
        {
            throw new UnauthorizedException();
        }


        var session =
            await _dbContext
                .UserSessions
                .FirstOrDefaultAsync(
                    session =>
                        session.Id ==
                            sessionId.Value &&
                        session.UserId ==
                            userId &&
                        session.RevokedAt ==
                            null &&
                        !session.IsDeleted);


        if (session is null)
        {
            return;
        }


        var now =
            DateTime.UtcNow;


        session.RevokedAt =
            now;

        session.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();
    }


    public async Task LogoutAllAsync()
    {
        var userId =
            _currentUserService.UserId;


        var user =
            await _dbContext
                .Users
                .FirstOrDefaultAsync(
                    user =>
                        user.Id ==
                        userId);


        if (user is null)
        {
            throw new UnauthorizedException();
        }


        var now =
            DateTime.UtcNow;


        var activeSessions =
            await _dbContext
                .UserSessions
                .Where(session =>
                    session.UserId ==
                        userId &&
                    session.RevokedAt ==
                        null &&
                    !session.IsDeleted &&
                    session.ExpiresAt >
                        now)
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


        await _dbContext
            .SaveChangesAsync();
    }


    public async Task RevokeSessionAsync(
        int sessionId)
    {
        var userId =
            _currentUserService.UserId;


        var session =
            await _dbContext
                .UserSessions
                .FirstOrDefaultAsync(
                    session =>
                        session.Id ==
                            sessionId &&
                        session.UserId ==
                            userId &&
                        session.RevokedAt ==
                            null &&
                        !session.IsDeleted &&
                        session.ExpiresAt >
                            DateTime.UtcNow);


        if (session is null)
        {
            throw new NotFoundException(
                "Active session not found.");
        }


        var now =
            DateTime.UtcNow;


        session.RevokedAt =
            now;

        session.UpdatedAt =
            now;


        await _dbContext
            .SaveChangesAsync();
    }


    /* =========================================================
       HELPERS
       ========================================================= */

    private async Task<User>
        GetCurrentUserAsync()
    {
        var userId =
            _currentUserService.UserId;


        var user =
            await _dbContext
                .Users
                .FirstOrDefaultAsync(
                    user =>
                        user.Id ==
                            userId &&
                        user.IsActive &&
                        !user.IsDeleted);


        if (user is null)
        {
            throw new UnauthorizedException(
                "User account is not available.");
        }


        return user;
    }


    private async Task
        NotifySecurityEventAsync(
            int userId,
            string title,
            string message,
            string type)
    {
        var adminUserIds =
            await _dbContext
                .Users
                .AsNoTracking()
                .Where(user =>
                    user.IsSystemAdmin &&
                    user.IsActive &&
                    !user.IsDeleted)
                .Select(user =>
                    user.Id)
                .ToListAsync();


        adminUserIds.Add(
            userId);


        await _notificationService
            .CreateSystemManyAsync(
                adminUserIds
                    .Distinct(),
                null,
                title,
                message,
                type,
                nameof(User),
                userId);
    }


    private static AccountProfileResponse
        MapProfile(
            User user)
    {
        return new AccountProfileResponse
        {
            UserId =
                user.Id,

            FullName =
                user.FullName,

            Email =
                user.Email
                ?? string.Empty,

            IsSystemAdmin =
                user.IsSystemAdmin,

            IsActive =
                user.IsActive,

            CreatedAt =
                user.CreatedAt,

            LastLoginAt =
                user.LastLoginAt
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


    private async Task<AuthResponse>
        CreateAuthResponseAsync(
            User user,
            string? deviceId,
            string? deviceName)
    {
        var expiresInMinutes =
            _configuration
                .GetValue<int>(
                    "Jwt:ExpiresInMinutes");


        var now =
            DateTime.UtcNow;


        var expiresAt =
            now.AddMinutes(
                expiresInMinutes);


        var normalizedDeviceId =
            string.IsNullOrWhiteSpace(
                deviceId)
                ? Guid.NewGuid()
                    .ToString("N")
                : deviceId.Trim();


        var normalizedDeviceName =
            string.IsNullOrWhiteSpace(
                deviceName)
                ? "Unknown Device"
                : deviceName.Trim();


        var oldSessionsFromSameDevice =
            await _dbContext
                .UserSessions
                .Where(session =>
                    session.UserId ==
                        user.Id &&
                    session.DeviceId ==
                        normalizedDeviceId &&
                    session.RevokedAt ==
                        null &&
                    !session.IsDeleted &&
                    session.ExpiresAt >
                        now)
                .ToListAsync();


        foreach (
            var oldSession
            in oldSessionsFromSameDevice)
        {
            oldSession.RevokedAt =
                now;

            oldSession.UpdatedAt =
                now;
        }


        var session =
            new UserSession
            {
                UserId =
                    user.Id,

                SessionToken =
                    Guid.NewGuid()
                        .ToString("N"),

                DeviceId =
                    normalizedDeviceId,

                DeviceName =
                    normalizedDeviceName,

                IpAddress =
                    _currentUserService
                        .IpAddress,

                UserAgent =
                    _currentUserService
                        .UserAgent,

                ExpiresAt =
                    expiresAt,

                LastUsedAt =
                    now,

                CreatedAt =
                    now
            };


        _dbContext
            .UserSessions
            .Add(
                session);


        await _dbContext
            .SaveChangesAsync();


        var token =
            _jwtTokenService
                .GenerateToken(
                    user,
                    session);


        return new AuthResponse
        {
            UserId =
                user.Id,

            FullName =
                user.FullName,

            Email =
                user.Email
                ?? string.Empty,

            Token =
                token,

            ExpiresAt =
                expiresAt,

            SessionId =
                session.Id
        };
    }
}