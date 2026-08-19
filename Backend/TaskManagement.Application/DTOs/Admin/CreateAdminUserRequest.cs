using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Admin;

public sealed class CreateAdminUserRequest
    : IValidatableObject
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


    [Required(
        ErrorMessage = "Email is required.")]
    [EmailAddress(
        ErrorMessage =
            "Email format is invalid.")]
    [StringLength(
        256,
        MinimumLength = 6,
        ErrorMessage =
            "Email must be between 6 and 256 characters.")]
    public string Email { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage = "Password is required.")]
    [StringLength(
        100,
        MinimumLength = 8,
        ErrorMessage =
            "Password must be between 8 and 100 characters.")]
    [RegularExpression(
        @"^(?=.*[a-z])(?=.*\d).+$",
        ErrorMessage =
            "Password must contain at least one lowercase letter and one digit.")]
    public string Password { get; set; } =
        string.Empty;


    [Required(
        ErrorMessage =
            "Password confirmation is required.")]
    public string ConfirmPassword { get; set; } =
        string.Empty;


    public bool IsActive { get; set; } =
        true;


    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (Password != ConfirmPassword)
        {
            yield return new ValidationResult(
                "Password and confirmation do not match.",
                new[]
                {
                    nameof(ConfirmPassword)
                });
        }
    }
}