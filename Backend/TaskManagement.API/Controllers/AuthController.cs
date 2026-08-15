using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Auth;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(
        RegisterRequest request)
    {
        var response = await _authService.RegisterAsync(request);

        return Ok(response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginRequest request)
    {
        var response = await _authService.LoginAsync(request);

        return Ok(response);
    }

    [Authorize]
    [HttpGet("sessions")]
    public async Task<ActionResult<List<UserSessionResponse>>> GetSessions()
    {
        var sessions = await _authService.GetSessionsAsync();

        return Ok(sessions);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _authService.LogoutAsync();

        return Ok(new
        {
            message = "Logged out from current device successfully."
        });
    }

    [Authorize]
    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll()
    {
        await _authService.LogoutAllAsync();

        return Ok(new
        {
            message = "Logged out from all devices successfully."
        });
    }

    [Authorize]
    [HttpDelete("sessions/{sessionId:int}")]
    public async Task<IActionResult> RevokeSession(int sessionId)
    {
        await _authService.RevokeSessionAsync(sessionId);

        return Ok(new
        {
            message = "Session revoked successfully.",
            revokedSessionId = sessionId
        });
    }
}