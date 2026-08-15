using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class UserSession : BaseEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string SessionToken { get; set; } = string.Empty;

    public string DeviceId { get; set; } = string.Empty;

    public string? DeviceName { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public bool IsRevoked => RevokedAt.HasValue;
}