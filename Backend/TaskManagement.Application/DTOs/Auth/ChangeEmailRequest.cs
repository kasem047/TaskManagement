using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Auth;

public sealed class ChangeEmailRequest
{
    [Required(
        ErrorMessage =
            "Current password is required.")]
    public string CurrentPassword { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage =
            "New email is required.")]
    [EmailAddress(
        ErrorMessage =
            "New email format is invalid.")]
    [MaxLength(
        256,
        ErrorMessage =
            "Email must not exceed 256 characters.")]
    public string NewEmail { get; set; } =
        string.Empty;
}