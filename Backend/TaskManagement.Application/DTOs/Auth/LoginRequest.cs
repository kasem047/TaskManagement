using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Auth;

public class LoginRequest
{
    [Required(
        ErrorMessage = "Email is required.")]
    [EmailAddress(
        ErrorMessage = "Email format is invalid.")]
    [MaxLength(
        256,
        ErrorMessage =
            "Email must not exceed 256 characters.")]
    public string Email { get; set; } = string.Empty;

    [Required(
        ErrorMessage = "Password is required.")]
    [MaxLength(
        100,
        ErrorMessage =
            "Password must not exceed 100 characters.")]
    public string Password { get; set; } = string.Empty;

    [MaxLength(
        200,
        ErrorMessage =
            "DeviceId must not exceed 200 characters.")]
    public string? DeviceId { get; set; }

    [MaxLength(
        200,
        ErrorMessage =
            "DeviceName must not exceed 200 characters.")]
    public string? DeviceName { get; set; }
}