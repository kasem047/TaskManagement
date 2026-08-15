using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.UserPermissions;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class UserPermissionManagementService
    : IUserPermissionManagementService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IActivityLogService _activityLogService;

    public UserPermissionManagementService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IActivityLogService activityLogService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _activityLogService = activityLogService;
    }

    public async Task<List<UserPermissionResponse>>
        GetUserPermissionsAsync(
            int workspaceId,
            int userId)
    {
        await EnsureCanManageUserPermissionsAsync(
            workspaceId,
            userId);

        var targetMember =
            await GetTargetMemberAsync(
                workspaceId,
                userId);

        var rolePermissionIds =
            await _dbContext.RolePermissions
                .AsNoTracking()
                .Where(rolePermission =>
                    rolePermission.RoleId ==
                        targetMember.RoleId &&
                    !rolePermission.IsDeleted &&
                    !rolePermission.Permission.IsDeleted)
                .Select(rolePermission =>
                    rolePermission.PermissionId)
                .ToListAsync();

        var rolePermissionIdSet =
            rolePermissionIds.ToHashSet();

        var overrides =
            await _dbContext.UserPermissionOverrides
                .AsNoTracking()
                .Where(permissionOverride =>
                    permissionOverride.WorkspaceId ==
                        workspaceId &&
                    permissionOverride.UserId ==
                        userId &&
                    !permissionOverride.IsDeleted)
                .ToListAsync();

        var overrideMap =
            overrides.ToDictionary(
                permissionOverride =>
                    permissionOverride.PermissionId);

        var permissions =
            await _dbContext.Permissions
                .AsNoTracking()
                .Where(permission =>
                    !permission.IsDeleted)
                .OrderBy(permission =>
                    permission.Module)
                .ThenBy(permission =>
                    permission.Name)
                .ToListAsync();

        return permissions
            .Select(permission =>
            {
                var grantedByRole =
                    rolePermissionIdSet.Contains(
                        permission.Id);

                overrideMap.TryGetValue(
                    permission.Id,
                    out var permissionOverride);

                var overrideGranted =
                    permissionOverride is null
                        ? (bool?)null
                        : permissionOverride.IsGranted;

                return new UserPermissionResponse
                {
                    PermissionId =
                        permission.Id,

                    PermissionName =
                        permission.Name,

                    Module =
                        permission.Module,

                    Description =
                        permission.Description,

                    GrantedByRole =
                        grantedByRole,

                    OverrideGranted =
                        overrideGranted,

                    EffectiveGranted =
                        overrideGranted ??
                        grantedByRole,

                    OverrideReason =
                        permissionOverride?.Reason
                };
            })
            .ToList();
    }

    public async Task<UserPermissionResponse>
        SetUserPermissionOverrideAsync(
            int workspaceId,
            int userId,
            SetUserPermissionOverrideRequest request)
    {
        await EnsureCanManageUserPermissionsAsync(
            workspaceId,
            userId);

        var targetMember =
            await GetTargetMemberAsync(
                workspaceId,
                userId);

        var permission =
            await _dbContext.Permissions
                .FirstOrDefaultAsync(permission =>
                    permission.Id ==
                        request.PermissionId &&
                    !permission.IsDeleted);

        if (permission is null)
        {
            throw new NotFoundException(
                "Permission not found.");
        }

        var existingOverride =
            await _dbContext.UserPermissionOverrides
                .FirstOrDefaultAsync(permissionOverride =>
                    permissionOverride.WorkspaceId ==
                        workspaceId &&
                    permissionOverride.UserId ==
                        userId &&
                    permissionOverride.PermissionId ==
                        request.PermissionId);

        var now =
            DateTime.UtcNow;

        UserPermissionOverride permissionOverride;

        if (existingOverride is null)
        {
            permissionOverride =
                new UserPermissionOverride
                {
                    WorkspaceId =
                        workspaceId,

                    UserId =
                        userId,

                    PermissionId =
                        request.PermissionId,

                    Permission =
                        permission,

                    IsGranted =
                        request.IsGranted,

                    Reason =
                        NormalizeOptionalText(
                            request.Reason),

                    CreatedAt =
                        now
                };

            _dbContext.UserPermissionOverrides.Add(
                permissionOverride);
        }
        else
        {
            permissionOverride =
                existingOverride;

            permissionOverride.IsGranted =
                request.IsGranted;

            permissionOverride.Reason =
                NormalizeOptionalText(
                    request.Reason);

            permissionOverride.IsDeleted =
                false;

            permissionOverride.DeletedAt =
                null;

            permissionOverride.UpdatedAt =
                now;
        }

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            request.IsGranted
                ? "permission.override_granted"
                : "permission.override_denied",
            nameof(UserPermissionOverride),
            permissionOverride.Id,
            request.IsGranted
                ? $"Granted permission {permission.Name} to user {userId}."
                : $"Denied permission {permission.Name} for user {userId}.");

        var grantedByRole =
            await _dbContext.RolePermissions
                .AsNoTracking()
                .AnyAsync(rolePermission =>
                    rolePermission.RoleId ==
                        targetMember.RoleId &&
                    rolePermission.PermissionId ==
                        permission.Id &&
                    !rolePermission.IsDeleted);

        return new UserPermissionResponse
        {
            PermissionId =
                permission.Id,

            PermissionName =
                permission.Name,

            Module =
                permission.Module,

            Description =
                permission.Description,

            GrantedByRole =
                grantedByRole,

            OverrideGranted =
                request.IsGranted,

            EffectiveGranted =
                request.IsGranted,

            OverrideReason =
                permissionOverride.Reason
        };
    }

    public async Task RemoveUserPermissionOverrideAsync(
        int workspaceId,
        int userId,
        int permissionId)
    {
        await EnsureCanManageUserPermissionsAsync(
            workspaceId,
            userId);

        await GetTargetMemberAsync(
            workspaceId,
            userId);

        var permission =
            await _dbContext.Permissions
                .AsNoTracking()
                .FirstOrDefaultAsync(permission =>
                    permission.Id ==
                        permissionId &&
                    !permission.IsDeleted);

        if (permission is null)
        {
            throw new NotFoundException(
                "Permission not found.");
        }

        var permissionOverride =
            await _dbContext.UserPermissionOverrides
                .FirstOrDefaultAsync(permissionOverride =>
                    permissionOverride.WorkspaceId ==
                        workspaceId &&
                    permissionOverride.UserId ==
                        userId &&
                    permissionOverride.PermissionId ==
                        permissionId &&
                    !permissionOverride.IsDeleted);

        if (permissionOverride is null)
        {
            throw new NotFoundException(
                "User permission override not found.");
        }

        var now =
            DateTime.UtcNow;

        permissionOverride.IsDeleted =
            true;

        permissionOverride.DeletedAt =
            now;

        permissionOverride.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "permission.override_removed",
            nameof(UserPermissionOverride),
            permissionOverride.Id,
            $"Removed permission override {permission.Name} from user {userId}.");
    }

    private async Task EnsureCanManageUserPermissionsAsync(
        int workspaceId,
        int targetUserId)
    {
        if (!_currentUserService.IsAuthenticated)
        {
            throw new UnauthorizedException(
                "Authentication is required.");
        }

        var currentUserId =
            _currentUserService.UserId;

        var currentUser =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id == currentUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (currentUser is null)
        {
            throw new UnauthorizedException(
                "Current user account is not available.");
        }

        var workspaceExists =
            await _dbContext.Workspaces
                .AsNoTracking()
                .AnyAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        if (currentUser.IsSystemAdmin)
        {
            return;
        }

        var currentMembership =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId ==
                        workspaceId &&
                    member.UserId ==
                        currentUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (currentMembership is null ||
            currentMembership.Role.Name !=
                SystemRoles.WorkspaceOwner)
        {
            throw new ForbiddenException(
                "Only the workspace owner can manage member permissions.");
        }

        if (currentUserId ==
            targetUserId)
        {
            throw new ConflictException(
                "Workspace owner cannot change their own permission overrides.");
        }
    }

    private async Task<WorkspaceMember>
        GetTargetMemberAsync(
            int workspaceId,
            int userId)
    {
        var member =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Include(workspaceMember =>
                    workspaceMember.Role)
                .Include(workspaceMember =>
                    workspaceMember.User)
                .FirstOrDefaultAsync(
                    workspaceMember =>
                        workspaceMember.WorkspaceId ==
                            workspaceId &&
                        workspaceMember.UserId ==
                            userId &&
                        workspaceMember.Status ==
                            WorkspaceMemberStatus.Active &&
                        !workspaceMember.IsDeleted);

        if (member is null)
        {
            throw new NotFoundException(
                "The selected user is not an active member of this workspace.");
        }

        if (!member.User.IsActive ||
            member.User.IsDeleted)
        {
            throw new ConflictException(
                "The selected user account is inactive or deleted.");
        }

        /*
         * WorkspaceOwner permissions are controlled by
         * the role/global administration, not by another
         * workspace owner.
         */
        if (member.Role.Name ==
                SystemRoles.WorkspaceOwner &&
            !await IsCurrentUserSystemAdminAsync())
        {
            throw new ForbiddenException(
                "Workspace owner permissions cannot be overridden by another workspace owner.");
        }

        return member;
    }

    private async Task<bool>
        IsCurrentUserSystemAdminAsync()
    {
        return await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(user =>
                user.Id ==
                    _currentUserService.UserId &&
                user.IsSystemAdmin &&
                user.IsActive &&
                !user.IsDeleted);
    }

    private static string? NormalizeOptionalText(
        string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }
}