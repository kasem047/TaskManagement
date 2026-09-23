using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.WorkspaceMembers;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class WorkspaceMemberService
    : IWorkspaceMemberService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public WorkspaceMemberService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _permissionService = permissionService;
        _activityLogService = activityLogService;
        _notificationService = notificationService;
    }

    /* =========================================================
       GET MEMBERS
       ========================================================= */

    public async Task<List<WorkspaceMemberResponse>>
        GetMembersAsync(int workspaceId)
    {
        var currentUserId =
            _currentUserService.UserId;

        await EnsureActiveWorkspaceMemberOrSystemAdminAsync(
            workspaceId,
            currentUserId);

        var members =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member => member.User)
                .Include(member => member.Role)
                .Where(member =>
                    member.WorkspaceId == workspaceId &&
                    !member.IsDeleted &&
                    member.Status == WorkspaceMemberStatus.Active)
                .OrderBy(member => member.User.FullName)
                .ToListAsync();

        return members
            .Select(MapToResponse)
            .ToList();
    }

    /* =========================================================
       AVAILABLE ROLES
       ========================================================= */

    public async Task<List<WorkspaceRoleOptionResponse>>
        GetAvailableRolesAsync(int workspaceId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await GetWorkspaceWithMembersAsync(
                workspaceId);

        EnsureWorkspaceExists(
            workspace);

        await EnsureOwnerOrSystemAdminAsync(
            workspace!,
            currentUserId);

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.MemberChangeRole);

        /*
         * Dynamic role model:
         *
         * Every active role can be assigned to a member
         * except WorkspaceOwner.
         *
         * Ownership is changed only through the dedicated
         * transfer-ownership operation.
         */
        var roles =
            await _dbContext.Roles
                .AsNoTracking()
                .Where(role =>
                    !role.IsDeleted &&
                    (
                        role.Name == SystemRoles.ProjectManager ||
                        role.Name == SystemRoles.Member
                    ))
                .OrderBy(role =>
                    role.Name == SystemRoles.ProjectManager
                        ? 1
                        : role.Name == SystemRoles.Member
                            ? 2
                            : 3)
                .ThenBy(role => role.Name)
                .Select(role =>
                    new WorkspaceRoleOptionResponse
                    {
                        Id = role.Id,
                        Name = role.Name
                    })
                .ToListAsync();

        return roles;
    }

    /* =========================================================
       CANDIDATE USERS
       ========================================================= */

    public async Task<List<WorkspaceMemberCandidateResponse>>
        SearchCandidatesAsync(
            int workspaceId,
            string? search = null)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await GetWorkspaceWithMembersAsync(
                workspaceId);

        EnsureWorkspaceExists(
            workspace);

        await EnsureOwnerOrSystemAdminAsync(
            workspace!,
            currentUserId);

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.MemberInvite);

        var activeWorkspaceUserIds =
            _dbContext.WorkspaceMembers
                .Where(member =>
                    member.WorkspaceId == workspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active)
                .Select(member =>
                    member.UserId);

        var query =
            _dbContext.Users
                .AsNoTracking()
                .Where(user =>
                    user.IsActive &&
                    !user.IsDeleted &&
                    !user.IsSystemAdmin &&
                    !activeWorkspaceUserIds.Contains(
                        user.Id));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch =
                search.Trim();

            query =
                query.Where(user =>
                    user.FullName.Contains(
                        normalizedSearch) ||
                    (
                        user.Email != null &&
                        user.Email.Contains(
                            normalizedSearch)
                    ) ||
                    (
                        user.UserName != null &&
                        user.UserName.Contains(
                            normalizedSearch)
                    ));
        }

        return await query
            .OrderBy(user => user.FullName)
            .Take(30)
            .Select(user =>
                new WorkspaceMemberCandidateResponse
                {
                    UserId = user.Id,
                    FullName = user.FullName,
                    Email =
                        user.Email ??
                        string.Empty
                })
            .ToListAsync();
    }

    /* =========================================================
       LEGACY DIRECT ADD
       ========================================================= */

    public async Task<WorkspaceMemberResponse>
        AddMemberAsync(
            int workspaceId,
            AddWorkspaceMemberRequest request)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await GetWorkspaceWithMembersAsync(
                workspaceId);

        EnsureWorkspaceExists(
            workspace);

        await EnsureOwnerOrSystemAdminAsync(
            workspace!,
            currentUserId);

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.MemberInvite);

        var userToAdd =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id == request.UserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (userToAdd is null)
        {
            throw new NotFoundException(
                "User not found or inactive.");
        }

        if (userToAdd.IsSystemAdmin)
        {
            throw new BadRequestException(
                "The system administrator cannot be added as a workspace member.");
        }

        var role =
            await _dbContext.Roles
                .FirstOrDefaultAsync(role =>
                    role.Id == request.RoleId &&
                    !role.IsDeleted);

        if (role is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        EnsureValidMemberManagementRole(
            role);

        var hasAnotherActiveWorkspace =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.UserId == userToAdd.Id &&
                    member.WorkspaceId != workspaceId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.Workspace.IsDeleted);

        /*
         * This legacy endpoint can still directly add
         * users who are not currently active elsewhere.
         *
         * If the user already belongs to another workspace,
         * the invitation workflow must be used so the user
         * explicitly accepts or rejects.
         */
        if (hasAnotherActiveWorkspace)
        {
            throw new ConflictException(
                "This user belongs to another active workspace. Use the workspace invitation workflow instead.");
        }

        var now =
            DateTime.UtcNow;

        var existingMember =
            await _dbContext.WorkspaceMembers
                .Include(member => member.User)
                .Include(member => member.Role)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == request.UserId);

        if (existingMember is not null)
        {
            if (!existingMember.IsDeleted &&
                existingMember.Status ==
                    WorkspaceMemberStatus.Active)
            {
                throw new ConflictException(
                    "User is already a member of this workspace.");
            }

            existingMember.RoleId =
                role.Id;

            existingMember.Role =
                role;

            existingMember.Status =
                WorkspaceMemberStatus.Active;

            existingMember.IsDeleted =
                false;

            existingMember.DeletedAt =
                null;

            existingMember.JoinedAt =
                now;

            existingMember.UpdatedAt =
                now;

            await _dbContext.SaveChangesAsync();

            await _activityLogService.LogAsync(
                workspaceId,
                "member.added",
                nameof(WorkspaceMember),
                existingMember.Id,
                $"Reactivated member {userToAdd.FullName} with role {role.Name}.");

            await _notificationService.CreateAsync(
                userToAdd.Id,
                workspaceId,
                "تم تفعيل عضويتك في مساحة العمل",
                $"تم تفعيل عضويتك في مساحة العمل بدور {NotificationCopy.Role(role.Name)}.",
                "workspace.member_added",
                nameof(WorkspaceMember),
                existingMember.Id);

            return await GetMemberResponseAsync(
                workspaceId,
                existingMember.Id);
        }

        var member =
            new WorkspaceMember
            {
                WorkspaceId =
                    workspaceId,

                UserId =
                    request.UserId,

                RoleId =
                    role.Id,

                Status =
                    WorkspaceMemberStatus.Active,

                JoinedAt =
                    now,

                CreatedAt =
                    now,

                User =
                    userToAdd,

                Role =
                    role
            };

        _dbContext.WorkspaceMembers.Add(
            member);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "member.added",
            nameof(WorkspaceMember),
            member.Id,
            $"Added member {userToAdd.FullName} with role {role.Name}.");

        await _notificationService.CreateAsync(
            userToAdd.Id,
            workspaceId,
            "تمت إضافتك إلى مساحة عمل",
            $"تمت إضافتك إلى مساحة عمل بدور {NotificationCopy.Role(role.Name)}.",
            "workspace.member_added",
            nameof(WorkspaceMember),
            member.Id);

        return await GetMemberResponseAsync(
            workspaceId,
            member.Id);
    }

    /* =========================================================
       UPDATE ROLE
       ========================================================= */

    public async Task<WorkspaceMemberResponse>
        UpdateMemberRoleAsync(
            int workspaceId,
            int memberId,
            UpdateWorkspaceMemberRoleRequest request)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await GetWorkspaceWithMembersAsync(
                workspaceId);

        EnsureWorkspaceExists(
            workspace);

        await EnsureOwnerOrSystemAdminAsync(
            workspace!,
            currentUserId);

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.MemberChangeRole);

        var member =
            await _dbContext.WorkspaceMembers
                .Include(member => member.User)
                .Include(member => member.Role)
                .FirstOrDefaultAsync(member =>
                    member.Id == memberId &&
                    member.WorkspaceId == workspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active);

        if (member is null)
        {
            throw new NotFoundException(
                "Workspace member not found.");
        }

        if (member.Role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            throw new ConflictException(
                "Workspace owner role cannot be changed through member management. Use ownership transfer instead.");
        }

        var newRole =
            await _dbContext.Roles
                .FirstOrDefaultAsync(role =>
                    role.Id == request.RoleId &&
                    !role.IsDeleted);

        if (newRole is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        EnsureValidMemberManagementRole(
            newRole);

        var previousRoleName =
            member.Role.Name;

        if (member.RoleId ==
            request.RoleId)
        {
            return MapToResponse(
                member);
        }

        member.RoleId =
            newRole.Id;

        member.Role =
            newRole;

        member.UpdatedAt =
            DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "member.role_changed",
            nameof(WorkspaceMember),
            member.Id,
            $"Changed role for {member.User.FullName} from {previousRoleName} to {newRole.Name}.");

        await _notificationService.CreateAsync(
            member.UserId,
            workspaceId,
            "تغيّر دورك في مساحة العمل",
            $"تغيّر دورك في مساحة العمل من {NotificationCopy.Role(previousRoleName)} إلى {NotificationCopy.Role(newRole.Name)}.",
            "workspace.member_role_changed",
            nameof(WorkspaceMember),
            member.Id);

        return await GetMemberResponseAsync(
            workspaceId,
            member.Id);
    }

    /* =========================================================
       REMOVE MEMBER
       ========================================================= */

    public async Task RemoveMemberAsync(
        int workspaceId,
        int memberId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await GetWorkspaceWithMembersAsync(
                workspaceId);

        EnsureWorkspaceExists(
            workspace);

        await EnsureOwnerOrSystemAdminAsync(
            workspace!,
            currentUserId);

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.MemberRemove);

        var member =
            await _dbContext.WorkspaceMembers
                .Include(member => member.User)
                .Include(member => member.Role)
                .FirstOrDefaultAsync(member =>
                    member.Id == memberId &&
                    member.WorkspaceId == workspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active);

        if (member is null)
        {
            throw new NotFoundException(
                "Workspace member not found.");
        }

        if (member.Role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            throw new ConflictException(
                "Workspace owner cannot be removed directly. A system administrator must assign a new owner first.");
        }

        /*
         * Do not allow a member with unfinished assigned
         * tasks to be removed either.
         *
         * Otherwise an active task could retain an assignee
         * who is no longer a workspace member.
         */
        var hasActiveAssignedTasks =
            await _dbContext.TaskAssignees
                .AsNoTracking()
                .AnyAsync(assignment =>
                    assignment.UserId ==
                        member.UserId &&
                    !assignment.IsDeleted &&
                    !assignment.TaskItem.IsDeleted &&
                    !assignment.TaskItem.Project.IsDeleted &&
                    assignment.TaskItem.Project.WorkspaceId ==
                        workspaceId &&
                    assignment.TaskItem.Status !=
                        TaskItemStatus.Done &&
                    assignment.TaskItem.Status !=
                        TaskItemStatus.Cancelled);

        if (hasActiveAssignedTasks)
        {
            throw new ConflictException(
                "This member cannot be removed while they still have unfinished assigned tasks.");
        }

        var managedProjects =
            await _dbContext.Projects
                .Where(project =>
                    project.WorkspaceId ==
                        workspaceId &&
                    project.ManagerUserId ==
                        member.UserId &&
                    !project.IsDeleted)
                .ToListAsync();

        var ownerUserId =
            await GetWorkspaceOwnerUserIdAsync(
                workspaceId);

        var removedUserId =
            member.UserId;

        var removedUserFullName =
            member.User.FullName;

        var removedRoleName =
            member.Role.Name;

        var now =
            DateTime.UtcNow;

        foreach (var project in managedProjects)
        {
            project.ManagerUserId =
                null;

            project.UpdatedAt =
                now;
        }

        member.Status =
            WorkspaceMemberStatus.Removed;

        member.IsDeleted =
            true;

        member.DeletedAt =
            now;

        member.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "member.removed",
            nameof(WorkspaceMember),
            member.Id,
            $"Removed member {removedUserFullName} with role {removedRoleName}.");

        await _notificationService.CreateAsync(
            removedUserId,
            workspaceId,
            "تمت إزالتك من مساحة عمل",
            "تمت إزالتك من مساحة العمل.",
            "workspace.member_removed",
            nameof(WorkspaceMember),
            member.Id);

        foreach (var project in managedProjects)
        {
            await _notificationService.CreateAsync(
                ownerUserId,
                workspaceId,
                "المشروع يحتاج مديرًا جديدًا",
                $"{removedUserFullName} لم يعد يدير المشروع \"{project.Name}\". يرجى تعيين مدير مشروع جديد.",
                "project.manager_required",
                nameof(Project),
                project.Id);
        }
    }

    /* =========================================================
       WORKSPACE
       ========================================================= */

    private async Task<Workspace?>
        GetWorkspaceWithMembersAsync(
            int workspaceId)
    {
        return await _dbContext.Workspaces
            .Include(workspace =>
                workspace.WorkspaceMembers)
            .ThenInclude(member =>
                member.Role)
            .FirstOrDefaultAsync(workspace =>
                workspace.Id == workspaceId &&
                !workspace.IsDeleted);
    }

    private async Task
        EnsureActiveWorkspaceMemberOrSystemAdminAsync(
            int workspaceId,
            int userId)
    {
        var workspaceExists =
            await _dbContext.Workspaces
                .AsNoTracking()
                .AnyAsync(workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        if (await IsSystemAdminAsync(
                userId))
        {
            return;
        }

        var isMember =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == userId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active);

        if (!isMember)
        {
            throw new ForbiddenException(
                "You do not have access to this workspace.");
        }
    }

    /* =========================================================
       OWNER / SYSTEM ADMIN
       ========================================================= */

    private async Task
        EnsureOwnerOrSystemAdminAsync(
            Workspace workspace,
            int userId)
    {
        if (await IsSystemAdminAsync(
                userId))
        {
            return;
        }

        var member =
            GetCurrentMember(
                workspace,
                userId);

        if (member is null ||
            member.Role.Name !=
                SystemRoles.WorkspaceOwner)
        {
            throw new ForbiddenException(
                "Only workspace owner or system administrator can manage workspace members.");
        }
    }

    private async Task<bool>
        IsSystemAdminAsync(
            int userId)
    {
        return await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(user =>
                user.Id == userId &&
                user.IsSystemAdmin &&
                user.IsActive &&
                !user.IsDeleted);
    }

    /* =========================================================
       ROLE RULE
       ========================================================= */

    private static void
        EnsureValidMemberManagementRole(
            Role role)
    {
        if (role.Name !=
                SystemRoles.ProjectManager &&
            role.Name !=
                SystemRoles.Member)
        {
            throw new ConflictException(
                "Only ProjectManager and Member can be assigned through member management. A system administrator assigns the workspace owner.");
        }
    }

    private static void
        EnsureWorkspaceExists(
            Workspace? workspace)
    {
        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }
    }

    private static WorkspaceMember?
        GetCurrentMember(
            Workspace workspace,
            int userId)
    {
        return workspace.WorkspaceMembers
            .FirstOrDefault(member =>
                member.UserId == userId &&
                !member.IsDeleted &&
                member.Status ==
                    WorkspaceMemberStatus.Active);
    }

    /* =========================================================
       OWNER
       ========================================================= */

    private async Task<int>
        GetWorkspaceOwnerUserIdAsync(
            int workspaceId)
    {
        var ownerUserId =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.WorkspaceId ==
                        workspaceId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner)
                .Select(member =>
                    member.UserId)
                .FirstOrDefaultAsync();

        if (ownerUserId <= 0)
        {
            throw new ConflictException(
                "Workspace does not have an active owner.");
        }

        return ownerUserId;
    }

    /* =========================================================
       RESPONSE
       ========================================================= */

    private async Task<WorkspaceMemberResponse>
        GetMemberResponseAsync(
            int workspaceId,
            int memberId)
    {
        var member =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.Id == memberId &&
                    member.WorkspaceId ==
                        workspaceId);

        if (member is null)
        {
            throw new NotFoundException(
                "Workspace member not found.");
        }

        return MapToResponse(
            member);
    }

    private static WorkspaceMemberResponse
        MapToResponse(
            WorkspaceMember member)
    {
        return new WorkspaceMemberResponse
        {
            Id = member.Id,
            WorkspaceId = member.WorkspaceId,
            UserId = member.UserId,
            FullName =
                member.User?.FullName ??
                string.Empty,
            Email =
                member.User?.Email ??
                string.Empty,
            RoleId = member.RoleId,
            RoleName =
                member.Role?.Name ??
                string.Empty,
            Status =
                member.Status.ToString(),
            JoinedAt =
                member.JoinedAt
        };
    }
}