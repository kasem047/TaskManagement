using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.RolesPermissions;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Application.Services;

public sealed class RolePermissionManagementService
    : IRolePermissionManagementService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public RolePermissionManagementService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService)
    {
        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;
    }

    public async Task<List<RoleResponse>>
        GetRolesAsync()
    {
        await EnsureSystemAdminAsync();

        return await _dbContext.Roles
            .AsNoTracking()
            .Where(role =>
                !role.IsDeleted)
            .OrderBy(role =>
                role.Name)
            .Select(role =>
                new RoleResponse
                {
                    Id =
                        role.Id,

                    Name =
                        role.Name,

                    Description =
                        role.Description,

                    IsSystemRole =
                        role.IsSystemRole,

                    PermissionCount =
                        role.RolePermissions.Count(
                            rolePermission =>
                                !rolePermission.IsDeleted &&
                                !rolePermission.Permission.IsDeleted)
                })
            .ToListAsync();
    }

    public async Task<List<PermissionResponse>>
        GetPermissionsAsync()
    {
        await EnsureSystemAdminAsync();

        return await _dbContext.Permissions
            .AsNoTracking()
            .Where(permission =>
                !permission.IsDeleted)
            .OrderBy(permission =>
                permission.Module)
            .ThenBy(permission =>
                permission.Name)
            .Select(permission =>
                new PermissionResponse
                {
                    Id =
                        permission.Id,

                    Name =
                        permission.Name,

                    Description =
                        permission.Description,

                    Module =
                        permission.Module
                })
            .ToListAsync();
    }

    public async Task<RolePermissionsResponse>
        GetRolePermissionsAsync(
            int roleId)
    {
        await EnsureSystemAdminAsync();

        var role =
            await _dbContext.Roles
                .AsNoTracking()
                .FirstOrDefaultAsync(role =>
                    role.Id == roleId &&
                    !role.IsDeleted);

        if (role is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        var permissions =
            await _dbContext.RolePermissions
                .AsNoTracking()
                .Include(rolePermission =>
                    rolePermission.Permission)
                .Where(rolePermission =>
                    rolePermission.RoleId ==
                        roleId &&
                    !rolePermission.IsDeleted &&
                    !rolePermission.Permission.IsDeleted)
                .OrderBy(rolePermission =>
                    rolePermission.Permission.Module)
                .ThenBy(rolePermission =>
                    rolePermission.Permission.Name)
                .Select(rolePermission =>
                    new PermissionResponse
                    {
                        Id =
                            rolePermission.Permission.Id,

                        Name =
                            rolePermission.Permission.Name,

                        Description =
                            rolePermission.Permission.Description,

                        Module =
                            rolePermission.Permission.Module
                    })
                .ToListAsync();

        return new RolePermissionsResponse
        {
            RoleId =
                role.Id,

            RoleName =
                role.Name,

            Permissions =
                permissions
        };
    }

    public async Task<RolePermissionsResponse>
        UpdateRolePermissionsAsync(
            int roleId,
            UpdateRolePermissionsRequest request)
    {
        await EnsureSystemAdminAsync();

        var role =
            await _dbContext.Roles
                .FirstOrDefaultAsync(role =>
                    role.Id == roleId &&
                    !role.IsDeleted);

        if (role is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        var requestedPermissionIds =
            request.PermissionIds
                .Distinct()
                .ToHashSet();

        if (requestedPermissionIds.Count > 0)
        {
            var existingPermissionIds =
                await _dbContext.Permissions
                    .AsNoTracking()
                    .Where(permission =>
                        requestedPermissionIds.Contains(
                            permission.Id) &&
                        !permission.IsDeleted)
                    .Select(permission =>
                        permission.Id)
                    .ToListAsync();

            if (existingPermissionIds.Count !=
                requestedPermissionIds.Count)
            {
                throw new BadRequestException(
                    "One or more selected permissions do not exist.");
            }
        }

        var currentRolePermissions =
            await _dbContext.RolePermissions
                .Where(rolePermission =>
                    rolePermission.RoleId ==
                        roleId)
                .ToListAsync();

        var now =
            DateTime.UtcNow;

        /*
         * Remove permissions that are no longer selected.
         */
        foreach (var rolePermission in
                 currentRolePermissions.Where(
                     rolePermission =>
                         !rolePermission.IsDeleted &&
                         !requestedPermissionIds.Contains(
                             rolePermission.PermissionId)))
        {
            rolePermission.IsDeleted =
                true;

            rolePermission.DeletedAt =
                now;

            rolePermission.UpdatedAt =
                now;
        }

        /*
         * Add or reactivate selected permissions.
         */
        foreach (var permissionId in
                 requestedPermissionIds)
        {
            var existingRolePermission =
                currentRolePermissions
                    .FirstOrDefault(
                        rolePermission =>
                            rolePermission.PermissionId ==
                                permissionId);

            if (existingRolePermission is null)
            {
                _dbContext.RolePermissions.Add(
                    new RolePermission
                    {
                        RoleId =
                            roleId,

                        PermissionId =
                            permissionId,

                        CreatedAt =
                            now
                    });

                continue;
            }

            if (existingRolePermission.IsDeleted)
            {
                existingRolePermission.IsDeleted =
                    false;

                existingRolePermission.DeletedAt =
                    null;

                existingRolePermission.UpdatedAt =
                    now;
            }
        }

        await _dbContext.SaveChangesAsync();

        return await GetRolePermissionsAsync(
            roleId);
    }

    private async Task EnsureSystemAdminAsync()
    {
        if (!_currentUserService.IsAuthenticated)
        {
            throw new UnauthorizedException(
                "Authentication is required.");
        }

        var isSystemAdmin =
            await _dbContext.Users
                .AsNoTracking()
                .AnyAsync(user =>
                    user.Id ==
                        _currentUserService.UserId &&
                    user.IsSystemAdmin &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (!isSystemAdmin)
        {
            throw new ForbiddenException(
                "Only the system administrator can manage roles and permissions.");
        }
    }
}