using TaskManagement.Application.DTOs.ActivityLogs;

namespace TaskManagement.Application.Interfaces;

public interface IActivityLogService
{
    Task<List<ActivityLogResponse>>
        GetWorkspaceActivityLogsAsync(
            int workspaceId);

    Task<List<ActivityLogResponse>>
        GetTaskActivityLogsAsync(
            int workspaceId,
            int projectId,
            int taskId);

    Task LogAsync(
        int workspaceId,
        string action,
        string entityName,
        int entityId,
        string? description = null);
}