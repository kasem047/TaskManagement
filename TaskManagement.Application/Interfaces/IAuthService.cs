using TaskManagement.Application.DTOs.Auth;

namespace TaskManagement.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    Task<AuthResponse> LoginAsync(LoginRequest request);

    Task<List<UserSessionResponse>> GetSessionsAsync();

    Task LogoutAsync();

    Task LogoutAllAsync();

    Task RevokeSessionAsync(int sessionId);
}