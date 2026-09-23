using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.UserPermissions;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class UserPermissionManagementService
    : IUserPermissionManagementService
{
    private readonly IApplicationDbContext
        _dbContext;

    private readonly ICurrentUserService
        _currentUserService;

    private readonly IActivityLogService
        _activityLogService;


    public UserPermissionManagementService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IActivityLogService activityLogService)
    {
        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;

        _activityLogService =
            activityLogService;
    }


    /* =========================================================
       GET USER PERMISSIONS
       ========================================================= */

    public async Task<List<UserPermissionResponse>>
        GetUserPermissionsAsync(
            int workspaceId,
            int userId)
    {
        await EnsureSystemAdminAsync();

        await EnsureWorkspaceExistsAsync(
            workspaceId);


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
            rolePermissionIds
                .ToHashSet();


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
                        overrideGranted
                        ?? grantedByRole,

                    OverrideReason =
                        permissionOverride?.Reason
                };
            })
            .ToList();
    }


    /* =========================================================
       SET USER OVERRIDE
       ========================================================= */

    public async Task<UserPermissionResponse>
        SetUserPermissionOverrideAsync(
            int workspaceId,
            int userId,
            SetUserPermissionOverrideRequest request)
    {
        await EnsureSystemAdminAsync();

        throw new BadRequestException(
            "User permission overrides are disabled. Permissions are determined by the workspace role.");
    }


    /* =========================================================
       REMOVE USER OVERRIDE
       ========================================================= */

    public async Task
        RemoveUserPermissionOverrideAsync(
            int workspaceId,
            int userId,
            int permissionId)
    {
        await EnsureSystemAdminAsync();

        throw new BadRequestException(
            "User permission overrides are disabled. Permissions are determined by the workspace role.");
    }


    /* =========================================================
       SYSTEM ADMIN CHECK
       ========================================================= */

    private async Task EnsureSystemAdminAsync()
    {
        if (!_currentUserService.IsAuthenticated)
        {
            throw new UnauthorizedException(
                "Authentication is required.");
        }


        var currentUser =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user =>
                    user.Id ==
                        _currentUserService.UserId &&

                    user.IsActive &&

                    !user.IsDeleted);


        if (currentUser is null)
        {
            throw new UnauthorizedException(
                "Current user account is not available.");
        }


        if (!currentUser.IsSystemAdmin)
        {
            throw new ForbiddenException(
                "Only the system administrator can manage user-specific permission overrides.");
        }
    }


    /* =========================================================
       WORKSPACE CHECK
       ========================================================= */

    private async Task
        EnsureWorkspaceExistsAsync(
            int workspaceId)
    {
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
    }


    /* =========================================================
       TARGET MEMBER
       ========================================================= */

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


        return member;
    }
}
