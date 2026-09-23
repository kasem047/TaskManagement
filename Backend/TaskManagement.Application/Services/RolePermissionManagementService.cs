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

        _ = request;

        throw new BadRequestException(
            "Custom roles are disabled. Workspace roles are fixed: WorkspaceOwner, ProjectManager, and Member.");
    }

    public async Task<RoleResponse>
        UpdateRoleAsync(
            int roleId,
            UpdateRoleRequest request)
    {
        await EnsureSystemAdminAsync();

        _ = roleId;
        _ = request;

        throw new BadRequestException(
            "Workspace roles are fixed and cannot be renamed or edited.");
    }

    public async Task DeleteRoleAsync(
        int roleId)
    {
        await EnsureSystemAdminAsync();

        _ = roleId;

        throw new BadRequestException(
            "Workspace roles are fixed and cannot be deleted.");
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

        _ = roleId;
        _ = request;

        throw new BadRequestException(
            "Role permissions are fixed and cannot be changed.");
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