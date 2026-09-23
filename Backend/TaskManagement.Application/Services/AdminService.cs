using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
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

        var users =
            await query
                .OrderByDescending(
                    user => user.IsSystemAdmin)
                .ThenBy(user => user.FullName)
                .ToListAsync();

        var assignments =
            await LoadUserAssignmentsAsync(
                users.Select(user => user.Id)
                    .ToList());

        return users
            .Select(user =>
                MapUser(
                    user,
                    assignments.GetValueOrDefault(
                        user.Id)))
            .ToList();
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

        return MapUser(
            user,
            await LoadUserAssignmentAsync(
                user.Id));
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
            return MapUser(
                user,
                await LoadUserAssignmentAsync(
                    user.Id));
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

        return MapUser(
            user,
            await LoadUserAssignmentAsync(
                user.Id));
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
        User user,
        UserAssignment? assignment = null)
    {
        var workspaceRole =
            ResolveWorkspaceRole(
                user,
                assignment);

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

            OwnsWorkspace =
                assignment?.OwnedWorkspaces.Count > 0,

            WorkspaceRole =
                workspaceRole,

            RoleDescription =
                BuildRoleDescription(
                    workspaceRole,
                    assignment),

            CreatedAt =
                user.CreatedAt,

            LastLoginAt =
                user.LastLoginAt
        };
    }

    private static string ResolveWorkspaceRole(
        User user,
        UserAssignment? assignment)
    {
        if (user.IsSystemAdmin)
        {
            return "SystemAdmin";
        }

        if (assignment is null)
        {
            return "None";
        }

        if (assignment.OwnedWorkspaces.Count > 0)
        {
            return "WorkspaceOwner";
        }

        if (assignment.ManagedProjects.Count > 0 ||
            assignment.Roles.Any(IsProjectManagerRole))
        {
            return "ProjectManager";
        }

        if (assignment.MemberWorkspaces.Count > 0 ||
            assignment.MemberProjects.Count > 0 ||
            assignment.Roles.Any(IsMemberRole))
        {
            return "Member";
        }

        return "None";
    }

    private static string BuildRoleDescription(
        string workspaceRole,
        UserAssignment? assignment)
    {
        if (workspaceRole == "SystemAdmin")
        {
            return "حساب إدارة النظام";
        }

        if (assignment is null)
        {
            return "لا ينتمي إلى مساحة عمل";
        }

        if (workspaceRole == "WorkspaceOwner")
        {
            return string.Join(
                " · ",
                assignment.OwnedWorkspaces);
        }

        if (workspaceRole == "ProjectManager")
        {
            if (assignment.ManagedProjects.Count > 0)
            {
                return string.Join(
                    " · ",
                    assignment.ManagedProjects.Select(item =>
                        $"{item.ProjectName} ضمن مساحة {item.WorkspaceName}"));
            }

            return string.Join(
                " · ",
                assignment.MemberWorkspaces);
        }

        if (workspaceRole == "Member")
        {
            if (assignment.MemberProjects.Count > 0)
            {
                return string.Join(
                    " · ",
                    assignment.MemberProjects
                        .Distinct()
                        .Select(item =>
                            $"مشروع {item.ProjectName} ضمن مساحة {item.WorkspaceName}"));
            }

            if (assignment.MemberWorkspaces.Count > 0)
            {
                return string.Join(
                    " · ",
                    assignment.MemberWorkspaces.Distinct());
            }
        }

        return "لا ينتمي إلى مساحة عمل";
    }

    private async Task<UserAssignment>
        LoadUserAssignmentAsync(
            int userId)
    {
        var assignments =
            await LoadUserAssignmentsAsync(
                [userId]);

        return assignments.GetValueOrDefault(userId)
            ?? new UserAssignment();
    }

    private async Task<Dictionary<int, UserAssignment>>
        LoadUserAssignmentsAsync(
            List<int> userIds)
    {
        var result =
            new Dictionary<int, UserAssignment>();

        if (userIds.Count == 0)
        {
            return result;
        }

        var memberships =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Where(member =>
                    userIds.Contains(member.UserId) &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.Workspace.IsDeleted)
                .Select(member => new
                {
                    member.UserId,
                    RoleName = member.Role.Name,
                    WorkspaceName = member.Workspace.Name
                })
                .ToListAsync();

        var managedProjects =
            await _dbContext.Projects
                .AsNoTracking()
                .Where(project =>
                    project.ManagerUserId.HasValue &&
                    userIds.Contains(project.ManagerUserId.Value) &&
                    !project.IsDeleted &&
                    !project.Workspace.IsDeleted)
                .Select(project => new
                {
                    UserId = project.ManagerUserId!.Value,
                    ProjectName = project.Name,
                    WorkspaceName = project.Workspace.Name
                })
                .ToListAsync();

        var projectMemberships =
            await _dbContext.ProjectMembers
                .AsNoTracking()
                .Where(member =>
                    userIds.Contains(member.UserId) &&
                    !member.IsDeleted &&
                    !member.Project.IsDeleted &&
                    !member.Project.Workspace.IsDeleted)
                .Select(member => new
                {
                    member.UserId,
                    ProjectName = member.Project.Name,
                    WorkspaceName = member.Project.Workspace.Name
                })
                .ToListAsync();

        foreach (var userId in userIds)
        {
            result[userId] = new UserAssignment();
        }

        foreach (var membership in memberships)
        {
            var assignment = result[membership.UserId];
            assignment.Roles.Add(membership.RoleName);

            if (IsOwnerRole(membership.RoleName))
            {
                if (!assignment.OwnedWorkspaces.Contains(membership.WorkspaceName))
                {
                    assignment.OwnedWorkspaces.Add(membership.WorkspaceName);
                }
            }
            else if (!assignment.MemberWorkspaces.Contains(membership.WorkspaceName))
            {
                assignment.MemberWorkspaces.Add(membership.WorkspaceName);
            }
        }

        foreach (var project in managedProjects)
        {
            result[project.UserId].ManagedProjects.Add(
                (project.ProjectName, project.WorkspaceName));
        }

        foreach (var membership in projectMemberships)
        {
            result[membership.UserId].MemberProjects.Add(
                (membership.ProjectName, membership.WorkspaceName));
        }

        return result;
    }

    private static bool IsOwnerRole(
        string? roleName)
    {
        return MatchesRole(
                roleName,
                SystemRoles.WorkspaceOwner)
            || MatchesRole(
                roleName,
                "Owner");
    }

    private static bool IsProjectManagerRole(
        string? roleName)
    {
        return MatchesRole(
                roleName,
                SystemRoles.ProjectManager)
            || MatchesRole(
                roleName,
                "Manager");
    }

    private static bool IsMemberRole(
        string? roleName)
    {
        return MatchesRole(
            roleName,
            SystemRoles.Member);
    }

    private static bool MatchesRole(
        string? roleName,
        string expected)
    {
        return !string.IsNullOrWhiteSpace(roleName) &&
            string.Equals(
                roleName.Trim(),
                expected,
                StringComparison.OrdinalIgnoreCase);
    }

    private sealed class UserAssignment
    {
        public HashSet<string> Roles { get; } = [];

        public List<string> OwnedWorkspaces { get; } = [];

        public List<(string ProjectName, string WorkspaceName)> ManagedProjects { get; } = [];

        public List<string> MemberWorkspaces { get; } = [];

        public List<(string ProjectName, string WorkspaceName)> MemberProjects { get; } = [];
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