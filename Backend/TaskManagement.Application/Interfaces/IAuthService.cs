using TaskManagement.Application.DTOs.Auth;

namespace TaskManagement.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(
        RegisterRequest request);

    Task<AuthResponse> LoginAsync(
        LoginRequest request);


    Task<AccountProfileResponse>
        GetProfileAsync();

    Task<AccountProfileResponse>
        UpdateProfileAsync(
            UpdateProfileRequest request);

    Task<AccountProfileResponse>
        ChangeEmailAsync(
            ChangeEmailRequest request);

    Task ChangePasswordAsync(
        ChangePasswordRequest request);


    Task<List<UserSessionResponse>>
        GetSessionsAsync();

    Task LogoutAsync();

    Task LogoutAllAsync();

    Task RevokeSessionAsync(
        int sessionId);
}