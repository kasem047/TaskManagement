using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.ActivityLogs;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Application.Services;

public sealed class ActivityLogService
    : IActivityLogService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;

    public ActivityLogService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _permissionService = permissionService;
    }

    public async Task<List<ActivityLogResponse>>
        GetWorkspaceActivityLogsAsync(
            int workspaceId)
    {
        await EnsureWorkspaceExistsAsync(
            workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.WorkspaceManage);

        var activityLogs =
            await _dbContext.ActivityLogs
                .AsNoTracking()
                .Include(activityLog =>
                    activityLog.User)
                .Where(activityLog =>
                    activityLog.WorkspaceId ==
                        workspaceId &&
                    !activityLog.IsDeleted)
                .OrderByDescending(activityLog =>
                    activityLog.CreatedAt)
                .ToListAsync();

        return activityLogs
            .Select(MapToResponse)
            .ToList();
    }

    public async Task LogAsync(
        int workspaceId,
        string action,
        string entityName,
        int entityId,
        string? description = null)
    {
        await EnsureWorkspaceExistsAsync(
            workspaceId);

        var currentUserId =
            _currentUserService.UserId;

        var currentUser =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id == currentUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (currentUser is null)
        {
            throw new UnauthorizedException(
                "Current user account is not available.");
        }

        var activityLog = new ActivityLog
        {
            WorkspaceId = workspaceId,
            UserId = currentUserId,
            Action = NormalizeRequiredValue(
                action,
                "Activity action",
                150),
            EntityName = NormalizeRequiredValue(
                entityName,
                "Entity name",
                150),
            EntityId = entityId,
            Description = NormalizeDescription(
                description),
            CreatedAt = DateTime.UtcNow,
            User = currentUser
        };

        _dbContext.ActivityLogs.Add(
            activityLog);

        await _dbContext.SaveChangesAsync();
    }

    private async Task EnsureWorkspaceExistsAsync(
        int workspaceId)
    {
        var workspaceExists =
            await _dbContext.Workspaces.AnyAsync(
                workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }
    }

    private static string NormalizeRequiredValue(
        string value,
        string fieldName,
        int maximumLength)
    {
        var normalizedValue =
            value.Trim();

        if (string.IsNullOrWhiteSpace(
                normalizedValue))
        {
            throw new BadRequestException(
                $"{fieldName} is required.");
        }

        if (normalizedValue.Length >
            maximumLength)
        {
            throw new BadRequestException(
                $"{fieldName} cannot exceed {maximumLength} characters.");
        }

        return normalizedValue;
    }

    private static string? NormalizeDescription(
        string? description)
    {
        if (string.IsNullOrWhiteSpace(
                description))
        {
            return null;
        }

        var normalizedDescription =
            description.Trim();

        if (normalizedDescription.Length > 1000)
        {
            throw new BadRequestException(
                "Activity description cannot exceed 1000 characters.");
        }

        return normalizedDescription;
    }

    private static ActivityLogResponse MapToResponse(
        ActivityLog activityLog)
    {
        return new ActivityLogResponse
        {
            Id = activityLog.Id,
            WorkspaceId =
                activityLog.WorkspaceId,
            UserId = activityLog.UserId,
            UserFullName =
                activityLog.User.FullName,
            Action = activityLog.Action,
            EntityName =
                activityLog.EntityName,
            EntityId = activityLog.EntityId,
            Description =
                activityLog.Description,
            CreatedAt = activityLog.CreatedAt
        };
    }
}