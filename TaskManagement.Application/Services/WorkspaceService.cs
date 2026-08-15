using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Workspaces;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class WorkspaceService : IWorkspaceService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;

    public WorkspaceService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IActivityLogService activityLogService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _permissionService = permissionService;
        _activityLogService = activityLogService;
    }

    public async Task<WorkspaceResponse> CreateAsync(
        CreateWorkspaceRequest request)
    {
        var userId =
            _currentUserService.UserId;

        /*
         * Business rule:
         * A user can create only one active workspace.
         */
        var hasCreatedActiveWorkspace =
            await _dbContext.Workspaces
                .AsNoTracking()
                .AnyAsync(workspace =>
                    workspace.CreatedByUserId == userId &&
                    !workspace.IsDeleted);

        if (hasCreatedActiveWorkspace)
        {
            throw new ConflictException(
                "You can create only one active workspace.");
        }

        /*
         * Business rule:
         * A user cannot own more than one active workspace,
         * even if ownership was granted rather than created by them.
         */
        var alreadyOwnsActiveWorkspace =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.UserId == userId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.Workspace.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner);

        if (alreadyOwnsActiveWorkspace)
        {
            throw new ConflictException(
                "You cannot own more than one active workspace.");
        }

        var ownerRole =
            await _dbContext.Roles
                .FirstOrDefaultAsync(role =>
                    role.Name ==
                        SystemRoles.WorkspaceOwner &&
                    !role.IsDeleted);

        if (ownerRole is null)
        {
            throw new NotFoundException(
                "Workspace owner role was not found.");
        }

        var now =
            DateTime.UtcNow;

        var workspace =
            new Workspace
            {
                Name =
                    request.Name.Trim(),

                Description =
                    string.IsNullOrWhiteSpace(
                        request.Description)
                        ? null
                        : request.Description.Trim(),

                CreatedByUserId =
                    userId,

                CreatedAt =
                    now
            };

        var workspaceMember =
            new WorkspaceMember
            {
                Workspace =
                    workspace,

                UserId =
                    userId,

                RoleId =
                    ownerRole.Id,

                Status =
                    WorkspaceMemberStatus.Active,

                JoinedAt =
                    now,

                CreatedAt =
                    now
            };

        workspace.WorkspaceMembers.Add(
            workspaceMember);

        _dbContext.Workspaces.Add(
            workspace);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspace.Id,
            "workspace.created",
            nameof(Workspace),
            workspace.Id,
            $"Created workspace: {workspace.Name}");

        return await GetByIdAsync(
            workspace.Id);
    }

    public async Task<List<WorkspaceResponse>>
        GetMyWorkspacesAsync()
    {
        var userId =
            _currentUserService.UserId;

        var workspaces =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.CreatedByUser)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                    .ThenInclude(member =>
                        member.Role)
                .Where(workspace =>
                    !workspace.IsDeleted &&
                    workspace.WorkspaceMembers.Any(
                        member =>
                            member.UserId == userId &&
                            member.Status ==
                                WorkspaceMemberStatus.Active &&
                            !member.IsDeleted))
                .OrderByDescending(
                    workspace =>
                        workspace.CreatedAt)
                .ToListAsync();

        return workspaces
            .Select(workspace =>
                MapToResponse(
                    workspace,
                    userId))
            .ToList();
    }

    public async Task<WorkspaceResponse> GetByIdAsync(
        int workspaceId)
    {
        var userId =
            _currentUserService.UserId;

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.CreatedByUser)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                    .ThenInclude(member =>
                        member.Role)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var isMember =
            workspace.WorkspaceMembers.Any(member =>
                member.UserId == userId &&
                member.Status ==
                    WorkspaceMemberStatus.Active &&
                !member.IsDeleted);

        if (!isMember)
        {
            throw new ForbiddenException(
                "You do not have access to this workspace.");
        }

        return MapToResponse(
            workspace,
            userId);
    }

    public async Task<WorkspaceResponse> UpdateAsync(
        int workspaceId,
        UpdateWorkspaceRequest request)
    {
        var userId =
            _currentUserService.UserId;

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.CreatedByUser)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                    .ThenInclude(member =>
                        member.Role)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.WorkspaceManage);

        workspace.Name =
            request.Name.Trim();

        workspace.Description =
            string.IsNullOrWhiteSpace(
                request.Description)
                ? null
                : request.Description.Trim();

        workspace.UpdatedAt =
            DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "workspace.updated",
            nameof(Workspace),
            workspace.Id,
            $"Updated workspace: {workspace.Name}");

        return MapToResponse(
            workspace,
            userId);
    }

    public async Task DeleteAsync(
        int workspaceId)
    {
        var userId =
            _currentUserService.UserId;

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                    .ThenInclude(member =>
                        member.Role)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id == workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.WorkspaceManage);

        EnsureOwner(
            workspace,
            userId);

        await _activityLogService.LogAsync(
            workspaceId,
            "workspace.deleted",
            nameof(Workspace),
            workspace.Id,
            $"Deleted workspace: {workspace.Name}");

        var now =
            DateTime.UtcNow;

        workspace.IsDeleted =
            true;

        workspace.DeletedAt =
            now;

        workspace.UpdatedAt =
            now;

        foreach (var member in
                 workspace.WorkspaceMembers
                     .Where(member =>
                         !member.IsDeleted))
        {
            member.Status =
                WorkspaceMemberStatus.Removed;

            member.IsDeleted =
                true;

            member.DeletedAt =
                now;

            member.UpdatedAt =
                now;
        }

        await _dbContext.SaveChangesAsync();
    }

    private static WorkspaceResponse MapToResponse(
        Workspace workspace,
        int currentUserId)
    {
        var currentMember =
            workspace.WorkspaceMembers
                .FirstOrDefault(member =>
                    member.UserId ==
                        currentUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        return new WorkspaceResponse
        {
            Id =
                workspace.Id,

            Name =
                workspace.Name,

            Description =
                workspace.Description,

            CreatedByUserId =
                workspace.CreatedByUserId,

            CreatedByUserName =
                workspace.CreatedByUser?.FullName ??
                string.Empty,

            CurrentUserRole =
                currentMember?.Role?.Name ??
                string.Empty,

            CreatedAt =
                workspace.CreatedAt
        };
    }

    private static void EnsureOwner(
        Workspace workspace,
        int userId)
    {
        var isOwner =
            workspace.WorkspaceMembers.Any(member =>
                member.UserId == userId &&
                member.Status ==
                    WorkspaceMemberStatus.Active &&
                !member.IsDeleted &&
                member.Role.Name ==
                    SystemRoles.WorkspaceOwner);

        if (!isOwner)
        {
            throw new ForbiddenException(
                "Only workspace owner can perform this action.");
        }
    }
}