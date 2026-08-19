namespace TaskManagement.Application.DTOs.Notifications;

public sealed class NotificationPagedResponse
{
    public List<NotificationResponse> Items { get; set; } =
        new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalCount { get; set; }

    public int TotalPages { get; set; }

    public bool HasPreviousPage =>
        Page > 1;

    public bool HasNextPage =>
        Page < TotalPages;
}