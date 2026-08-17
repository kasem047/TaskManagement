namespace TaskManagement.Application.DTOs.Auth;

public sealed class AccountProfileResponse
{
    public int UserId { get; set; }

    public string FullName { get; set; } =
        string.Empty;

    public string Email { get; set; } =
        string.Empty;

    public bool IsSystemAdmin { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }
}