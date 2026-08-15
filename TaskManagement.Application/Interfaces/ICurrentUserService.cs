namespace TaskManagement.Application.Interfaces;

public interface ICurrentUserService
{
    int UserId { get; }

    int? SessionId { get; }

    bool IsAuthenticated { get; }

    string? IpAddress { get; }

    string? UserAgent { get; }
}