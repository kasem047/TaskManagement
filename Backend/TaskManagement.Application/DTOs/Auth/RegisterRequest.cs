using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Auth;

public class RegisterRequest : IValidatableObject
{
    [Required(
        ErrorMessage = "Full name is required.")]
    [StringLength(
        150,
        MinimumLength = 6,
        ErrorMessage =
            "Full name must be between 6 and 150 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(
        ErrorMessage = "Email is required.")]
    [EmailAddress(
        ErrorMessage = "Email format is invalid.")]
    [StringLength(
        256,
        MinimumLength = 6,
        ErrorMessage =
            "Email must be between 6 and 256 characters.")]
    public string Email { get; set; } = string.Empty;

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

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        var fullName =
            FullName?.Trim() ?? string.Empty;

        var email =
            Email?.Trim() ?? string.Empty;

        var deviceId =
            DeviceId?.Trim();

        var deviceName =
            DeviceName?.Trim();

        if (IsPlaceholder(fullName))
        {
            yield return new ValidationResult(
                "Full name contains a placeholder value. Please enter a real name.",
                new[]
                {
                    nameof(FullName)
                });
        }

        if (IsPlaceholderEmail(email))
        {
            yield return new ValidationResult(
                "Email contains a placeholder or reserved example address. Please enter a real email address.",
                new[]
                {
                    nameof(Email)
                });
        }

        if (!string.IsNullOrWhiteSpace(deviceId) &&
            IsPlaceholder(deviceId))
        {
            yield return new ValidationResult(
                "DeviceId contains a placeholder value.",
                new[]
                {
                    nameof(DeviceId)
                });
        }

        if (!string.IsNullOrWhiteSpace(deviceName) &&
            IsPlaceholder(deviceName))
        {
            yield return new ValidationResult(
                "DeviceName contains a placeholder value.",
                new[]
                {
                    nameof(DeviceName)
                });
        }
    }

    private static bool IsPlaceholder(
        string value)
    {
        var normalized =
            value.Trim().ToLowerInvariant();

        return normalized is
            "string" or
            "test" or
            "example" or
            "sample" or
            "null" or
            "undefined";
    }

    private static bool IsPlaceholderEmail(
        string email)
    {
        if (IsPlaceholder(email))
        {
            return true;
        }

        var normalized =
            email.Trim().ToLowerInvariant();

        return normalized.EndsWith(
                   "@example.com",
                   StringComparison.OrdinalIgnoreCase) ||
               normalized.EndsWith(
                   "@example.net",
                   StringComparison.OrdinalIgnoreCase) ||
               normalized.EndsWith(
                   "@example.org",
                   StringComparison.OrdinalIgnoreCase);
    }
}