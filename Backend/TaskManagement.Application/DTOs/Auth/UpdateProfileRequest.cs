using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Auth;

public sealed class UpdateProfileRequest
{
    [Required(
        ErrorMessage = "Full name is required.")]
    [StringLength(
        150,
        MinimumLength = 2,
        ErrorMessage =
            "Full name must be between 2 and 150 characters.")]
    public string FullName { get; set; } =
        string.Empty;
}