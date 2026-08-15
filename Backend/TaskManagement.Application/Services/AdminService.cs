using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class AdminService : IAdminService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public AdminService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<AdminDashboardResponse> GetDashboardAsync()
    {
        await EnsureSystemAdminAsync();

        var usersQuery =
            _dbContext.Users
                .AsNoTracking()
                .Where(user => !user.IsDeleted);

        var projectsQuery =
            _dbContext.Projects
                .AsNoTracking()
                .Where(project => !project.IsDeleted);

        var tasksQuery =
            _dbContext.TaskItems
                .AsNoTracking()
                .Where(task =>
                    !task.IsDeleted &&
                    !task.Project.IsDeleted);

        var taskStatusCounts =
            await tasksQuery
                .GroupBy(task => task.Status)
                .Select(group => new
                {
                    Status = group.Key,
                    Count = group.Count()
                })
                .ToDictionaryAsync(
                    item => item.Status,
                    item => item.Count);

        var totalUsers =
            await usersQuery.CountAsync();

        var activeUsers =
            await usersQuery.CountAsync(
                user => user.IsActive);

        var totalProjects =
            await projectsQuery.CountAsync();

        var archivedProjects =
            await projectsQuery.CountAsync(
                project => project.IsArchived);

        return new AdminDashboardResponse
        {
            TotalUsers = totalUsers,

            ActiveUsers = activeUsers,

            InactiveUsers =
                totalUsers - activeUsers,

            TotalWorkspaces =
                await _dbContext.Workspaces
                    .AsNoTracking()
                    .CountAsync(
                        workspace => !workspace.IsDeleted),

            TotalProjects = totalProjects,

            ActiveProjects =
                totalProjects - archivedProjects,

            ArchivedProjects =
                archivedProjects,

            TotalTasks =
                taskStatusCounts.Values.Sum(),

            TodoTasks =
                GetTaskStatusCount(
                    taskStatusCounts,
                    TaskItemStatus.Todo),

            InProgressTasks =
                GetTaskStatusCount(
                    taskStatusCounts,
                    TaskItemStatus.InProgress),

            InReviewTasks =
                GetTaskStatusCount(
                    taskStatusCounts,
                    TaskItemStatus.InReview),

            DoneTasks =
                GetTaskStatusCount(
                    taskStatusCounts,
                    TaskItemStatus.Done),

            CancelledTasks =
                GetTaskStatusCount(
                    taskStatusCounts,
                    TaskItemStatus.Cancelled)
        };
    }

    public async Task<List<AdminUserResponse>> GetUsersAsync(
        string? search = null,
        bool? isActive = null)
    {
        await EnsureSystemAdminAsync();

        var query =
            _dbContext.Users
                .AsNoTracking()
                .Where(user => !user.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch =
                search.Trim();

            query =
                query.Where(user =>
                    user.FullName.Contains(normalizedSearch) ||
                    (user.UserName != null &&
                     user.UserName.Contains(normalizedSearch)) ||
                    (user.Email != null &&
                     user.Email.Contains(normalizedSearch)));
        }

        if (isActive.HasValue)
        {
            query =
                query.Where(
                    user =>
                        user.IsActive == isActive.Value);
        }

        return await query
            .OrderByDescending(
                user => user.IsSystemAdmin)
            .ThenBy(user => user.FullName)
            .Select(user =>
                new AdminUserResponse
                {
                    Id = user.Id,

                    UserName =
                        user.UserName ?? string.Empty,

                    FullName =
                        user.FullName,

                    Email =
                        user.Email ?? string.Empty,

                    IsActive =
                        user.IsActive,

                    IsSystemAdmin =
                        user.IsSystemAdmin,

                    CreatedAt =
                        user.CreatedAt,

                    LastLoginAt =
                        user.LastLoginAt
                })
            .ToListAsync();
    }

    public async Task<AdminUserResponse> GetUserByIdAsync(
        int userId)
    {
        await EnsureSystemAdminAsync();

        var user =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    user =>
                        user.Id == userId &&
                        !user.IsDeleted);

        if (user is null)
        {
            throw new NotFoundException(
                "User was not found.");
        }

        return MapUser(user);
    }

    public async Task<AdminUserResponse> SetUserActiveStatusAsync(
        int userId,
        SetUserActiveStatusRequest request)
    {
        await EnsureSystemAdminAsync();

        var user =
            await _dbContext.Users
                .FirstOrDefaultAsync(
                    user =>
                        user.Id == userId &&
                        !user.IsDeleted);

        if (user is null)
        {
            throw new NotFoundException(
                "User was not found.");
        }

        if (!request.IsActive &&
            user.Id == _currentUserService.UserId)
        {
            throw new ConflictException(
                "The system administrator cannot disable their own account.");
        }

        if (!request.IsActive &&
            user.IsSystemAdmin)
        {
            throw new ConflictException(
                "The system administrator account cannot be disabled.");
        }

        if (user.IsActive == request.IsActive)
        {
            return MapUser(user);
        }

        user.IsActive =
            request.IsActive;

        user.UpdatedAt =
            DateTime.UtcNow;

        if (!request.IsActive)
        {
            /*
             * Invalidates all currently issued JWTs for this user.
             * Existing sessions may remain stored for audit/history,
             * but their tokens can no longer pass TokenVersion validation.
             */
            user.TokenVersion++;
        }

        await _dbContext.SaveChangesAsync();

        return MapUser(user);
    }

    private async Task EnsureSystemAdminAsync()
    {
        if (!_currentUserService.IsAuthenticated)
        {
            throw new ForbiddenException(
                "Authentication is required.");
        }

        var currentUser =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    user =>
                        user.Id ==
                            _currentUserService.UserId &&
                        user.IsActive &&
                        !user.IsDeleted);

        if (currentUser is null ||
            !currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException(
                "Only the system administrator can access this resource.");
        }
    }

    private static AdminUserResponse MapUser(
        User user)
    {
        return new AdminUserResponse
        {
            Id = user.Id,

            UserName =
                user.UserName ?? string.Empty,

            FullName =
                user.FullName,

            Email =
                user.Email ?? string.Empty,

            IsActive =
                user.IsActive,

            IsSystemAdmin =
                user.IsSystemAdmin,

            CreatedAt =
                user.CreatedAt,

            LastLoginAt =
                user.LastLoginAt
        };
    }

    private static int GetTaskStatusCount(
        IReadOnlyDictionary<TaskItemStatus, int> counts,
        TaskItemStatus status)
    {
        return counts.TryGetValue(
            status,
            out var count)
                ? count
                : 0;
    }
}