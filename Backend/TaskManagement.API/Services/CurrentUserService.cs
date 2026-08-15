using System.Security.Claims;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Services;

public sealed class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(
        IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public bool IsAuthenticated =>
        _httpContextAccessor.HttpContext?
            .User?
            .Identity?
            .IsAuthenticated == true;

    public int UserId
    {
        get
        {
            var userIdValue =
                _httpContextAccessor.HttpContext?
                    .User?
                    .FindFirstValue(ClaimTypes.NameIdentifier)
                ??
                _httpContextAccessor.HttpContext?
                    .User?
                    .FindFirstValue("sub");

            if (!int.TryParse(userIdValue, out var userId))
            {
                throw new UnauthorizedException();
            }

            return userId;
        }
    }

    public int? SessionId
    {
        get
        {
            var sessionIdValue =
                _httpContextAccessor.HttpContext?
                    .User?
                    .FindFirstValue("sessionId");

            return int.TryParse(sessionIdValue, out var sessionId)
                ? sessionId
                : null;
        }
    }

    public string? IpAddress =>
        _httpContextAccessor.HttpContext?
            .Connection
            .RemoteIpAddress?
            .ToString();

    public string? UserAgent =>
        _httpContextAccessor.HttpContext?
            .Request
            .Headers
            .UserAgent
            .ToString();
}