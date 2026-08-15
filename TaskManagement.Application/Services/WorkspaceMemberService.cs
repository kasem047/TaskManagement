using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.WorkspaceMembers;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class WorkspaceMemberService : IWorkspaceMemberService
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

    public async Task<List<WorkspaceMemberResponse>> GetMembersAsync(
        int workspaceId)
    {
        var currentUserId =
            _currentUserService.UserId;

        await EnsureActiveWorkspaceMemberAsync(
            workspaceId,
            currentUserId);

        var members =
            await _dbContext.WorkspaceMembers
                .Include(member => member.User)
                .Include(member => member.Role)
                .Where(member =>
                    member.WorkspaceId == workspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active)
                .OrderBy(member =>
                    member.User.FullName)
                .ToListAsync();

        return members
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<WorkspaceMemberResponse> AddMemberAsync(
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

        EnsureOwner(
            workspace!,
            currentUserId);

        await _permissionService.EnsurePermissionAsync(
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

        EnsureValidWorkspaceRole(
            role);

        if (role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            await EnsureUserCanOwnWorkspaceAsync(
                request.UserId,
                workspaceId);
        }

        var now =
            DateTime.UtcNow;

        var existingMember =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId ==
                        workspaceId &&
                    member.UserId ==
                        request.UserId);

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
                request.RoleId;

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
                "Workspace membership activated",
                $"Your workspace membership was activated with role {role.Name}.",
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
                    request.RoleId,

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
            "Added to workspace",
            $"You were added to a workspace with role {role.Name}.",
            "workspace.member_added",
            nameof(WorkspaceMember),
            member.Id);

        return await GetMemberResponseAsync(
            workspaceId,
            member.Id);
    }

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

        EnsureOwner(
            workspace!,
            currentUserId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.MemberChangeRole);

        var member =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.Id == memberId &&
                    member.WorkspaceId ==
                        workspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active);

        if (member is null)
        {
            throw new NotFoundException(
                "Workspace member not found.");
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

        EnsureValidWorkspaceRole(
            newRole);

        var memberIsOwner =
            member.Role.Name ==
            SystemRoles.WorkspaceOwner;

        var assigningOwnerRole =
            newRole.Name ==
            SystemRoles.WorkspaceOwner;

        /*
         * A user may own only one active workspace.
         * No check is required when the member is already
         * the owner of this same workspace.
         */
        if (assigningOwnerRole &&
            !memberIsOwner)
        {
            await EnsureUserCanOwnWorkspaceAsync(
                member.UserId,
                workspaceId);
        }

        if (memberIsOwner &&
            !assigningOwnerRole)
        {
            await EnsureNotLastOwnerAsync(
                workspaceId,
                member.Id);
        }

        var previousRoleName =
            member.Role.Name;

        var roleChanged =
            member.RoleId !=
            request.RoleId;

        member.RoleId =
            request.RoleId;

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

        if (roleChanged)
        {
            await _notificationService.CreateAsync(
                member.UserId,
                workspaceId,
                "Workspace role changed",
                $"Your workspace role changed from {previousRoleName} to {newRole.Name}.",
                "workspace.member_role_changed",
                nameof(WorkspaceMember),
                member.Id);
        }

        return await GetMemberResponseAsync(
            workspaceId,
            member.Id);
    }

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

        EnsureOwner(
            workspace!,
            currentUserId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.MemberRemove);

        var member =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.Id == memberId &&
                    member.WorkspaceId ==
                        workspaceId &&
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
            await EnsureNotLastOwnerAsync(
                workspaceId,
                member.Id);
        }

        var removedUserId =
            member.UserId;

        var removedUserFullName =
            member.User.FullName;

        var removedRoleName =
            member.Role.Name;

        var now =
            DateTime.UtcNow;

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
            "Removed from workspace",
            "You were removed from a workspace.",
            "workspace.member_removed",
            nameof(WorkspaceMember),
            member.Id);
    }

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
                workspace.Id ==
                    workspaceId &&
                !workspace.IsDeleted);
    }

    private async Task EnsureActiveWorkspaceMemberAsync(
        int workspaceId,
        int userId)
    {
        var workspaceExists =
            await _dbContext.Workspaces
                .AnyAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var isSystemAdmin =
            await _dbContext.Users
                .AnyAsync(user =>
                    user.Id == userId &&
                    user.IsSystemAdmin &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (isSystemAdmin)
        {
            return;
        }

        var isMember =
            await _dbContext.WorkspaceMembers
                .AnyAsync(member =>
                    member.WorkspaceId ==
                        workspaceId &&
                    member.UserId ==
                        userId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active);

        if (!isMember)
        {
            throw new ForbiddenException(
                "You do not have access to this workspace.");
        }
    }

    private async Task EnsureUserCanOwnWorkspaceAsync(
        int userId,
        int targetWorkspaceId)
    {
        /*
         * First protection:
         * the user must not already own another
         * active workspace through membership.
         */
        var ownsAnotherWorkspace =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.UserId == userId &&
                    member.WorkspaceId !=
                        targetWorkspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.Workspace.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner);

        if (ownsAnotherWorkspace)
        {
            throw new ConflictException(
                "A user cannot own more than one active workspace.");
        }

        /*
         * Second protection:
         * also cover inconsistent legacy data where
         * a workspace was created by the user but its
         * owner membership is missing.
         */
        var createdAnotherWorkspace =
            await _dbContext.Workspaces
                .AsNoTracking()
                .AnyAsync(workspace =>
                    workspace.CreatedByUserId ==
                        userId &&
                    workspace.Id !=
                        targetWorkspaceId &&
                    !workspace.IsDeleted);

        if (createdAnotherWorkspace)
        {
            throw new ConflictException(
                "A user who already has an active workspace cannot become owner of another workspace.");
        }
    }

    private static void EnsureWorkspaceExists(
        Workspace? workspace)
    {
        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }
    }

    private static void EnsureOwner(
        Workspace workspace,
        int userId)
    {
        var member =
            GetCurrentMember(
                workspace,
                userId);

        if (member is null ||
            member.Role.Name !=
                SystemRoles.WorkspaceOwner)
        {
            throw new ForbiddenException(
                "Only workspace owner can manage workspace members.");
        }
    }

    private static void EnsureValidWorkspaceRole(
        Role role)
    {
        var isValid =
            role.Name ==
                SystemRoles.WorkspaceOwner ||
            role.Name ==
                SystemRoles.ProjectManager ||
            role.Name ==
                SystemRoles.Member;

        if (!isValid)
        {
            throw new BadRequestException(
                "The selected role is not a valid workspace role.");
        }
    }

    private static WorkspaceMember?
        GetCurrentMember(
            Workspace workspace,
            int userId)
    {
        return workspace.WorkspaceMembers
            .FirstOrDefault(member =>
                member.UserId ==
                    userId &&
                !member.IsDeleted &&
                member.Status ==
                    WorkspaceMemberStatus.Active);
    }

    private async Task EnsureNotLastOwnerAsync(
        int workspaceId,
        int ownerMemberId)
    {
        var activeOwnersCount =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.Role)
                .CountAsync(member =>
                    member.WorkspaceId ==
                        workspaceId &&
                    member.Id !=
                        ownerMemberId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner);

        if (activeOwnersCount == 0)
        {
            throw new ConflictException(
                "Cannot remove or demote the last workspace owner.");
        }
    }

    private async Task<WorkspaceMemberResponse>
        GetMemberResponseAsync(
            int workspaceId,
            int memberId)
    {
        var member =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.Id ==
                        memberId &&
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

    private static WorkspaceMemberResponse MapToResponse(
        WorkspaceMember member)
    {
        return new WorkspaceMemberResponse
        {
            Id =
                member.Id,

            WorkspaceId =
                member.WorkspaceId,

            UserId =
                member.UserId,

            FullName =
                member.User?.FullName ??
                string.Empty,

            Email =
                member.User?.Email ??
                string.Empty,

            RoleId =
                member.RoleId,

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