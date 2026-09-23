using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class PermissionService : IPermissionService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public PermissionService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> HasPermissionAsync(
        int workspaceId,
        string permissionName,
        CancellationToken cancellationToken = default)
    {
        if (!_currentUserService.IsAuthenticated)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(permissionName))
        {
            return false;
        }

        var userId = _currentUserService.UserId;

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                u =>
                    u.Id == userId &&
                    u.IsActive &&
                    !u.IsDeleted,
                cancellationToken);

        if (user is null)
        {
            return false;
        }

        // مدير النظام يملك صلاحية عامة.
        if (user.IsSystemAdmin)
        {
            return true;
        }

        var workspaceExists = await _dbContext.Workspaces
            .AsNoTracking()
            .AnyAsync(
                w =>
                    w.Id == workspaceId &&
                    !w.IsDeleted,
                cancellationToken);

        if (!workspaceExists)
        {
            return false;
        }

        var permission = await _dbContext.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p =>
                    p.Name == permissionName &&
                    !p.IsDeleted,
                cancellationToken);

        if (permission is null)
        {
            return false;
        }

        var workspaceMember = await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                wm =>
                    wm.WorkspaceId == workspaceId &&
                    wm.UserId == userId &&
                    wm.Status == WorkspaceMemberStatus.Active &&
                    !wm.IsDeleted,
                cancellationToken);

        if (workspaceMember is null)
        {
            return false;
        }

        // المنع الصريح له الأولوية.
        var hasExplicitDeny =
            await _dbContext.UserPermissionOverrides
                .AsNoTracking()
                .AnyAsync(
                    permissionOverride =>
                        permissionOverride.WorkspaceId == workspaceId &&
                        permissionOverride.UserId == userId &&
                        permissionOverride.PermissionId == permission.Id &&
                        !permissionOverride.IsGranted &&
                        !permissionOverride.IsDeleted,
                    cancellationToken);

        if (hasExplicitDeny)
        {
            return false;
        }

        // السماح الصريح يأتي بعد المنع الصريح.
        var hasExplicitAllow =
            await _dbContext.UserPermissionOverrides
                .AsNoTracking()
                .AnyAsync(
                    permissionOverride =>
                        permissionOverride.WorkspaceId == workspaceId &&
                        permissionOverride.UserId == userId &&
                        permissionOverride.PermissionId == permission.Id &&
                        permissionOverride.IsGranted &&
                        !permissionOverride.IsDeleted,
                    cancellationToken);

        if (hasExplicitAllow)
        {
            return true;
        }

        // في حال عدم وجود Override نعتمد صلاحيات الدور.
        return await _dbContext.RolePermissions
            .AsNoTracking()
            .AnyAsync(
                rolePermission =>
                    rolePermission.RoleId == workspaceMember.RoleId &&
                    rolePermission.PermissionId == permission.Id &&
                    !rolePermission.IsDeleted,
                cancellationToken);
    }

    public async Task EnsurePermissionAsync(
        int workspaceId,
        string permissionName,
        CancellationToken cancellationToken = default)
    {
        var hasPermission = await HasPermissionAsync(
            workspaceId,
            permissionName,
            cancellationToken);

        if (!hasPermission)
        {
            throw new ForbiddenException(
                "You do not have permission to perform this action.");
        }
    }

    public async Task<bool> IsSystemAdminAsync(
        CancellationToken cancellationToken = default)
    {
        if (!_currentUserService.IsAuthenticated)
        {
            return false;
        }

        var userId = _currentUserService.UserId;

        return await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(
                user =>
                    user.Id == userId &&
                    user.IsSystemAdmin &&
                    user.IsActive &&
                    !user.IsDeleted,
                cancellationToken);
    }

    public async Task<string?> GetActiveRoleNameAsync(
        int workspaceId,
        CancellationToken cancellationToken = default)
    {
        if (!_currentUserService.IsAuthenticated)
        {
            return null;
        }

        if (await IsSystemAdminAsync(cancellationToken))
        {
            return "SystemAdmin";
        }

        var userId = _currentUserService.UserId;

        var workspaceMember = await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .Include(member => member.Role)
            .FirstOrDefaultAsync(
                member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == userId &&
                    member.Status == WorkspaceMemberStatus.Active &&
                    !member.IsDeleted,
                cancellationToken);

        if (workspaceMember is null ||
            workspaceMember.Role is null ||
            workspaceMember.Role.IsDeleted)
        {
            return null;
        }

        return workspaceMember.Role.Name;
    }
}