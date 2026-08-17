using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Auth;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController
    : ControllerBase
{
    private readonly IAuthService
        _authService;

    private readonly IPasswordRecoveryService
        _passwordRecoveryService;


    public AuthController(
        IAuthService authService,
        IPasswordRecoveryService passwordRecoveryService)
    {
        _authService =
            authService;

        _passwordRecoveryService =
            passwordRecoveryService;
    }


    /* =========================================================
       PUBLIC AUTH
       ========================================================= */

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>>
        Register(
            RegisterRequest request)
    {
        var response =
            await _authService
                .RegisterAsync(
                    request);


        return Ok(
            response);
    }


    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>>
        Login(
            LoginRequest request)
    {
        var response =
            await _authService
                .LoginAsync(
                    request);


        return Ok(
            response);
    }


    /* =========================================================
       PASSWORD RECOVERY - PUBLIC
       ========================================================= */

    [HttpPost("password-recovery/request")]
    public async Task<
        ActionResult<PasswordRecoveryPublicStatusResponse>>
        CreatePasswordRecoveryRequest(
            [FromBody]
            CreatePasswordRecoveryRequest request)
    {
        var response =
            await _passwordRecoveryService
                .CreateRequestAsync(
                    request);


        return Ok(
            response);
    }


    [HttpGet(
        "password-recovery/{publicToken}/status")]
    public async Task<
        ActionResult<PasswordRecoveryPublicStatusResponse>>
        GetPasswordRecoveryStatus(
            string publicToken)
    {
        var response =
            await _passwordRecoveryService
                .GetPublicStatusAsync(
                    publicToken);


        return Ok(
            response);
    }


    [HttpPost(
        "password-recovery/verify-code")]
    public async Task<
        ActionResult<VerifyPasswordRecoveryCodeResponse>>
        VerifyPasswordRecoveryCode(
            [FromBody]
            VerifyPasswordRecoveryCodeRequest request)
    {
        var response =
            await _passwordRecoveryService
                .VerifyCodeAsync(
                    request);


        return Ok(
            response);
    }


    [HttpPost(
        "password-recovery/reset")]
    public async Task<IActionResult>
        ResetForgottenPassword(
            [FromBody]
            ResetForgottenPasswordRequest request)
    {
        await _passwordRecoveryService
            .ResetPasswordAsync(
                request);


        return Ok(
            new
            {
                message =
                    "Password reset successfully. Please sign in using the new password."
            });
    }


    /* =========================================================
       ACCOUNT
       ========================================================= */

    [Authorize]
    [HttpGet("profile")]
    public async Task<
        ActionResult<AccountProfileResponse>>
        GetProfile()
    {
        var response =
            await _authService
                .GetProfileAsync();


        return Ok(
            response);
    }


    [Authorize]
    [HttpPut("profile")]
    public async Task<
        ActionResult<AccountProfileResponse>>
        UpdateProfile(
            [FromBody]
            UpdateProfileRequest request)
    {
        var response =
            await _authService
                .UpdateProfileAsync(
                    request);


        return Ok(
            response);
    }


    [Authorize]
    [HttpPut("email")]
    public async Task<
        ActionResult<AccountProfileResponse>>
        ChangeEmail(
            [FromBody]
            ChangeEmailRequest request)
    {
        var response =
            await _authService
                .ChangeEmailAsync(
                    request);


        return Ok(
            response);
    }


    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult>
        ChangePassword(
            [FromBody]
            ChangePasswordRequest request)
    {
        await _authService
            .ChangePasswordAsync(
                request);


        return Ok(
            new
            {
                message =
                    "Password changed successfully. Other active sessions were revoked."
            });
    }


    /* =========================================================
       SESSIONS
       ========================================================= */

    [Authorize]
    [HttpGet("sessions")]
    public async Task<
        ActionResult<List<UserSessionResponse>>>
        GetSessions()
    {
        var sessions =
            await _authService
                .GetSessionsAsync();


        return Ok(
            sessions);
    }


    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult>
        Logout()
    {
        await _authService
            .LogoutAsync();


        return Ok(
            new
            {
                message =
                    "Logged out from current device successfully."
            });
    }


    [Authorize]
    [HttpPost("logout-all")]
    public async Task<IActionResult>
        LogoutAll()
    {
        await _authService
            .LogoutAllAsync();


        return Ok(
            new
            {
                message =
                    "Logged out from all devices successfully."
            });
    }


    [Authorize]
    [HttpDelete(
        "sessions/{sessionId:int}")]
    public async Task<IActionResult>
        RevokeSession(
            int sessionId)
    {
        await _authService
            .RevokeSessionAsync(
                sessionId);


        return Ok(
            new
            {
                message =
                    "Session revoked successfully.",

                revokedSessionId =
                    sessionId
            });
    }
}