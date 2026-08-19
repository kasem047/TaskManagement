using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.RolesPermissions;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

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
            .OrderByDescending(role =>
                role.IsSystemRole)
            .ThenBy(role =>
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

    public async Task<RoleResponse>
        CreateRoleAsync(
            CreateRoleRequest request)
    {
        await EnsureSystemAdminAsync();

        var normalizedName =
            request.Name.Trim();

        var roleNameExists =
            await _dbContext.Roles
                .AsNoTracking()
                .AnyAsync(role =>
                    role.Name ==
                        normalizedName);

        if (roleNameExists)
        {
            throw new ConflictException(
                "A role with the same name already exists.");
        }

        var permissionIds =
            request.PermissionIds
                .Distinct()
                .ToHashSet();

        await EnsurePermissionsExistAsync(
            permissionIds);

        var now =
            DateTime.UtcNow;

        var role =
            new Role
            {
                Name =
                    normalizedName,

                Description =
                    NormalizeOptionalText(
                        request.Description),

                IsSystemRole =
                    false,

                CreatedAt =
                    now
            };

        _dbContext.Roles.Add(
            role);

        foreach (var permissionId in
                 permissionIds)
        {
            role.RolePermissions.Add(
                new RolePermission
                {
                    PermissionId =
                        permissionId,

                    CreatedAt =
                        now
                });
        }

        await _dbContext.SaveChangesAsync();

        return await GetRoleResponseAsync(
            role.Id);
    }

    public async Task<RoleResponse>
        UpdateRoleAsync(
            int roleId,
            UpdateRoleRequest request)
    {
        await EnsureSystemAdminAsync();

        var role =
            await _dbContext.Roles
                .FirstOrDefaultAsync(role =>
                    role.Id ==
                        roleId &&
                    !role.IsDeleted);

        if (role is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        if (role.IsSystemRole)
        {
            throw new ConflictException(
                "System role metadata cannot be changed. Its permissions can still be managed.");
        }

        var normalizedName =
            request.Name.Trim();

        var duplicateName =
            await _dbContext.Roles
                .AsNoTracking()
                .AnyAsync(existingRole =>
                    existingRole.Id !=
                        roleId &&
                    existingRole.Name ==
                        normalizedName);

        if (duplicateName)
        {
            throw new ConflictException(
                "A role with the same name already exists.");
        }

        role.Name =
            normalizedName;

        role.Description =
            NormalizeOptionalText(
                request.Description);

        role.UpdatedAt =
            DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return await GetRoleResponseAsync(
            role.Id);
    }

    public async Task DeleteRoleAsync(
        int roleId)
    {
        await EnsureSystemAdminAsync();

        var role =
            await _dbContext.Roles
                .FirstOrDefaultAsync(role =>
                    role.Id ==
                        roleId &&
                    !role.IsDeleted);

        if (role is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        if (role.IsSystemRole)
        {
            throw new ConflictException(
                "System roles cannot be deleted.");
        }

        var isAssignedToActiveMember =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.RoleId ==
                        roleId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (isAssignedToActiveMember)
        {
            throw new ConflictException(
                "This role is assigned to one or more active workspace members. Reassign those members before deleting the role.");
        }

        var now =
            DateTime.UtcNow;

        role.IsDeleted =
            true;

        role.DeletedAt =
            now;

        role.UpdatedAt =
            now;

        var rolePermissions =
            await _dbContext.RolePermissions
                .Where(rolePermission =>
                    rolePermission.RoleId ==
                        roleId &&
                    !rolePermission.IsDeleted)
                .ToListAsync();

        foreach (var rolePermission in
                 rolePermissions)
        {
            rolePermission.IsDeleted =
                true;

            rolePermission.DeletedAt =
                now;

            rolePermission.UpdatedAt =
                now;
        }

        await _dbContext.SaveChangesAsync();
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

        await EnsurePermissionsExistAsync(
            requestedPermissionIds);

        var currentRolePermissions =
            await _dbContext.RolePermissions
                .Where(rolePermission =>
                    rolePermission.RoleId ==
                        roleId)
                .ToListAsync();

        var now =
            DateTime.UtcNow;

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

    private async Task EnsurePermissionsExistAsync(
        HashSet<int> permissionIds)
    {
        if (permissionIds.Count == 0)
        {
            return;
        }

        var existingPermissionIds =
            await _dbContext.Permissions
                .AsNoTracking()
                .Where(permission =>
                    permissionIds.Contains(
                        permission.Id) &&
                    !permission.IsDeleted)
                .Select(permission =>
                    permission.Id)
                .ToListAsync();

        if (existingPermissionIds.Count !=
            permissionIds.Count)
        {
            throw new BadRequestException(
                "One or more selected permissions do not exist.");
        }
    }

    private async Task<RoleResponse>
        GetRoleResponseAsync(
            int roleId)
    {
        var role =
            await _dbContext.Roles
                .AsNoTracking()
                .Where(role =>
                    role.Id ==
                        roleId &&
                    !role.IsDeleted)
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
                .FirstOrDefaultAsync();

        if (role is null)
        {
            throw new NotFoundException(
                "Role not found.");
        }

        return role;
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