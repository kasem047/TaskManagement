using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Auth;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Identity;

public sealed class AuthService : IAuthService
{
    private readonly UserManager<User> _userManager;
    private readonly IApplicationDbContext _dbContext;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IConfiguration _configuration;
    private readonly ICurrentUserService _currentUserService;

    public AuthService(
        UserManager<User> userManager,
        IApplicationDbContext dbContext,
        IJwtTokenService jwtTokenService,
        IConfiguration configuration,
        ICurrentUserService currentUserService)
    {
        _userManager = userManager;
        _dbContext = dbContext;
        _jwtTokenService = jwtTokenService;
        _configuration = configuration;
        _currentUserService = currentUserService;
    }

    public async Task<AuthResponse> RegisterAsync(
        RegisterRequest request)
    {
        var existingUser =
            await _userManager.FindByEmailAsync(request.Email);

        if (existingUser is not null)
        {
            throw new ConflictException(
                "Email is already registered.");
        }

        var user = new User
        {
            FullName = request.FullName,
            Email = request.Email,
            UserName = request.Email,
            IsActive = true,
            TokenVersion = 1,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(
            user,
            request.Password);

        if (!result.Succeeded)
        {
            var errors = string.Join(
                " | ",
                result.Errors.Select(e => e.Description));

            throw new BadRequestException(errors);
        }

        return await CreateAuthResponseAsync(
            user,
            request.DeviceId,
            request.DeviceName);
    }

    public async Task<AuthResponse> LoginAsync(
        LoginRequest request)
    {
        var user =
            await _userManager.FindByEmailAsync(request.Email);

        if (user is null)
        {
            throw new UnauthorizedException(
                "Invalid email or password.");
        }

        if (!user.IsActive || user.IsDeleted)
        {
            throw new ForbiddenException(
                "User account is disabled.");
        }

        var passwordValid =
            await _userManager.CheckPasswordAsync(
                user,
                request.Password);

        if (!passwordValid)
        {
            throw new UnauthorizedException(
                "Invalid email or password.");
        }

        user.LastLoginAt = DateTime.UtcNow;

        await _userManager.UpdateAsync(user);

        return await CreateAuthResponseAsync(
            user,
            request.DeviceId,
            request.DeviceName);
    }

    public async Task<List<UserSessionResponse>>
        GetSessionsAsync()
    {
        var userId = _currentUserService.UserId;

        var currentSessionId =
            _currentUserService.SessionId ?? 0;

        var now = DateTime.UtcNow;

        return await _dbContext.UserSessions
            .Where(s =>
                s.UserId == userId &&
                s.RevokedAt == null &&
                !s.IsDeleted &&
                s.ExpiresAt > now)
            .OrderByDescending(
                s => s.LastUsedAt ?? s.CreatedAt)
            .Select(s => new UserSessionResponse
            {
                Id = s.Id,
                DeviceId = s.DeviceId,
                DeviceName = s.DeviceName,
                IpAddress = s.IpAddress,
                UserAgent = s.UserAgent,
                ExpiresAt = s.ExpiresAt,
                LastUsedAt = s.LastUsedAt,
                CreatedAt = s.CreatedAt,
                IsCurrentSession =
                    s.Id == currentSessionId
            })
            .ToListAsync();
    }

    public async Task LogoutAsync()
    {
        var userId = _currentUserService.UserId;
        var sessionId = _currentUserService.SessionId;

        if (sessionId is null)
        {
            throw new UnauthorizedException();
        }

        var session = await _dbContext.UserSessions
            .FirstOrDefaultAsync(s =>
                s.Id == sessionId.Value &&
                s.UserId == userId &&
                s.RevokedAt == null &&
                !s.IsDeleted);

        if (session is null)
        {
            return;
        }

        var now = DateTime.UtcNow;

        session.RevokedAt = now;
        session.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();
    }

    public async Task LogoutAllAsync()
    {
        var userId = _currentUserService.UserId;

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
        {
            throw new UnauthorizedException();
        }

        var now = DateTime.UtcNow;

        var activeSessions =
            await _dbContext.UserSessions
                .Where(s =>
                    s.UserId == userId &&
                    s.RevokedAt == null &&
                    !s.IsDeleted &&
                    s.ExpiresAt > now)
                .ToListAsync();

        foreach (var session in activeSessions)
        {
            session.RevokedAt = now;
            session.UpdatedAt = now;
        }

        user.TokenVersion++;
        user.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();
    }

    public async Task RevokeSessionAsync(int sessionId)
    {
        var userId = _currentUserService.UserId;

        var session = await _dbContext.UserSessions
            .FirstOrDefaultAsync(s =>
                s.Id == sessionId &&
                s.UserId == userId &&
                s.RevokedAt == null &&
                !s.IsDeleted &&
                s.ExpiresAt > DateTime.UtcNow);

        if (session is null)
        {
            throw new NotFoundException(
                "Active session not found.");
        }

        var now = DateTime.UtcNow;

        session.RevokedAt = now;
        session.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();
    }

    private async Task<AuthResponse> CreateAuthResponseAsync(
        User user,
        string? deviceId,
        string? deviceName)
    {
        var expiresInMinutes =
            _configuration.GetValue<int>(
                "Jwt:ExpiresInMinutes");

        var now = DateTime.UtcNow;

        var expiresAt =
            now.AddMinutes(expiresInMinutes);

        var normalizedDeviceId =
            string.IsNullOrWhiteSpace(deviceId)
                ? Guid.NewGuid().ToString("N")
                : deviceId.Trim();

        var normalizedDeviceName =
            string.IsNullOrWhiteSpace(deviceName)
                ? "Unknown Device"
                : deviceName.Trim();

        var oldSessionsFromSameDevice =
            await _dbContext.UserSessions
                .Where(s =>
                    s.UserId == user.Id &&
                    s.DeviceId == normalizedDeviceId &&
                    s.RevokedAt == null &&
                    !s.IsDeleted &&
                    s.ExpiresAt > now)
                .ToListAsync();

        foreach (var oldSession
                 in oldSessionsFromSameDevice)
        {
            oldSession.RevokedAt = now;
            oldSession.UpdatedAt = now;
        }

        var session = new UserSession
        {
            UserId = user.Id,
            SessionToken =
                Guid.NewGuid().ToString("N"),
            DeviceId = normalizedDeviceId,
            DeviceName = normalizedDeviceName,
            IpAddress = _currentUserService.IpAddress,
            UserAgent = _currentUserService.UserAgent,
            ExpiresAt = expiresAt,
            LastUsedAt = now,
            CreatedAt = now
        };

        _dbContext.UserSessions.Add(session);

        await _dbContext.SaveChangesAsync();

        var token =
            _jwtTokenService.GenerateToken(
                user,
                session);

        return new AuthResponse
        {
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            Token = token,
            ExpiresAt = expiresAt,
            SessionId = session.Id
        };
    }
}