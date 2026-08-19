namespace TaskManagement.Application.DTOs.ActivityLogs;

public sealed class GlobalActivityLogPagedResponse
{
    public List<GlobalActivityLogItemResponse> Items { get; set; } =
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


public sealed class GlobalActivityLogItemResponse
{
    public int Id { get; set; }

    public int WorkspaceId { get; set; }

    public string WorkspaceName { get; set; } =
        string.Empty;

    public int UserId { get; set; }

    public string UserFullName { get; set; } =
        string.Empty;

    public string Action { get; set; } =
        string.Empty;

    public string EntityName { get; set; } =
        string.Empty;

    public int EntityId { get; set; }

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }
}