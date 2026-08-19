using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.ActivityLogs;

public sealed class GlobalActivityLogQueryRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    public int? WorkspaceId { get; set; }

    public int? UserId { get; set; }

    [StringLength(150)]
    public string? Action { get; set; }

    [StringLength(150)]
    public string? EntityName { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 25;
}