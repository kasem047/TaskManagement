namespace TaskManagement.Application.DTOs.Auth;

public class UserSessionResponse
{
    public int Id { get; set; }

    public string DeviceId { get; set; } = string.Empty;

    public string? DeviceName { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public bool IsCurrentSession { get; set; }
}