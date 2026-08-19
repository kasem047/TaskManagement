using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Workspaces;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class WorkspaceService
    : IWorkspaceService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public WorkspaceService(
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

    public async Task<WorkspaceResponse>
        CreateAsync(
            CreateWorkspaceRequest request)
    {
        var userId =
            _currentUserService.UserId;

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
                "A user cannot own more than one active workspace.");
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

        var isSystemAdmin =
            await IsSystemAdminAsync(
                userId);

        var query =
            _dbContext.Workspaces
                .Include(workspace =>
                    workspace.CreatedByUser)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.Role)
                .Where(workspace =>
                    !workspace.IsDeleted);

        if (!isSystemAdmin)
        {
            query =
                query.Where(workspace =>
                    workspace.WorkspaceMembers.Any(
                        member =>
                            member.UserId ==
                                userId &&
                            member.Status ==
                                WorkspaceMemberStatus.Active &&
                            !member.IsDeleted));
        }

        var workspaces =
            await query
                .OrderByDescending(
                    workspace =>
                        workspace.CreatedAt)
                .ToListAsync();

        return workspaces
            .Select(workspace =>
                MapToResponse(
                    workspace,
                    userId,
                    isSystemAdmin))
            .ToList();
    }

    public async Task<WorkspaceResponse>
        GetByIdAsync(
            int workspaceId)
    {
        var userId =
            _currentUserService.UserId;

        var isSystemAdmin =
            await IsSystemAdminAsync(
                userId);

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.CreatedByUser)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.Role)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var isMember =
            workspace.WorkspaceMembers.Any(
                member =>
                    member.UserId ==
                        userId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (!isMember &&
            !isSystemAdmin)
        {
            throw new ForbiddenException(
                "You do not have access to this workspace.");
        }

        return MapToResponse(
            workspace,
            userId,
            isSystemAdmin);
    }

    public async Task<WorkspaceResponse>
        UpdateAsync(
            int workspaceId,
            UpdateWorkspaceRequest request)
    {
        var userId =
            _currentUserService.UserId;

        var isSystemAdmin =
            await IsSystemAdminAsync(
                userId);

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.CreatedByUser)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.Role)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        await _permissionService
            .EnsurePermissionAsync(
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
            userId,
            isSystemAdmin);
    }

    public async Task TransferOwnershipAsync(
        int workspaceId,
        TransferWorkspaceOwnershipRequest request)
    {
        var currentUserId =
            _currentUserService.UserId;

        var isSystemAdmin =
            await IsSystemAdminAsync(
                currentUserId);

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.Role)
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.User)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var activeOwners =
            workspace.WorkspaceMembers
                .Where(member =>
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner)
                .ToList();

        if (activeOwners.Count != 1)
        {
            throw new ConflictException(
                "Workspace ownership state is invalid. A workspace must have exactly one active owner.");
        }

        var currentOwner =
            activeOwners[0];

        var currentUserIsOwner =
            currentOwner.UserId ==
                currentUserId;

        if (!currentUserIsOwner &&
            !isSystemAdmin)
        {
            throw new ForbiddenException(
                "Only the current workspace owner or system administrator can transfer ownership.");
        }

        if (request.NewOwnerUserId ==
            currentOwner.UserId)
        {
            throw new BadRequestException(
                "The selected user is already the workspace owner.");
        }

        var newOwnerMember =
            workspace.WorkspaceMembers
                .FirstOrDefault(member =>
                    member.UserId ==
                        request.NewOwnerUserId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active);

        if (newOwnerMember is null)
        {
            throw new NotFoundException(
                "The selected user must be an active member of this workspace before ownership can be transferred.");
        }

        if (newOwnerMember.User is null ||
            newOwnerMember.User.IsDeleted ||
            !newOwnerMember.User.IsActive)
        {
            throw new ConflictException(
                "The selected user account is inactive or unavailable.");
        }

        var newOwnerAlreadyOwnsWorkspace =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.UserId ==
                        request.NewOwnerUserId &&
                    member.WorkspaceId !=
                        workspaceId &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.Workspace.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner);

        if (newOwnerAlreadyOwnsWorkspace)
        {
            throw new ConflictException(
                "The selected user already owns another active workspace.");
        }

        if (await HasActiveAssignedTasksAsync(
                workspaceId,
                currentOwner.UserId))
        {
            throw new ConflictException(
                "Workspace ownership cannot be transferred while the current owner still has unfinished assigned tasks. Complete or cancel those tasks first.");
        }

        var oldOwnerName =
            currentOwner.User?.FullName ??
            "Previous owner";

        var newOwnerName =
            newOwnerMember.User.FullName;

        var now =
            DateTime.UtcNow;

        newOwnerMember.RoleId =
            currentOwner.RoleId;

        newOwnerMember.Role =
            currentOwner.Role;

        newOwnerMember.UpdatedAt =
            now;

        currentOwner.Status =
            WorkspaceMemberStatus.Removed;

        currentOwner.IsDeleted =
            true;

        currentOwner.DeletedAt =
            now;

        currentOwner.UpdatedAt =
            now;

        workspace.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "workspace.ownership_transferred",
            nameof(Workspace),
            workspace.Id,
            $"Transferred workspace ownership from {oldOwnerName} to {newOwnerName}.");

        await _notificationService.CreateAsync(
            newOwnerMember.UserId,
            workspaceId,
            "Workspace ownership transferred",
            $"You are now the owner of workspace \"{workspace.Name}\".",
            "workspace.ownership_transferred",
            nameof(Workspace),
            workspace.Id);

        await _notificationService.CreateAsync(
            currentOwner.UserId,
            workspaceId,
            "Workspace ownership transferred",
            $"Ownership of workspace \"{workspace.Name}\" was transferred to {newOwnerName}. You are no longer a member of this workspace.",
            "workspace.ownership_transferred",
            nameof(Workspace),
            workspace.Id);
    }

    public async Task LeaveAsync(
        int workspaceId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await _dbContext.Workspaces
                .AsNoTracking()
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        var member =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
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

        if (member is null)
        {
            throw new ForbiddenException(
                "You are not an active member of this workspace.");
        }

        if (member.Role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            throw new ConflictException(
                "Workspace owner cannot leave directly. Transfer ownership first.");
        }

        if (await HasActiveAssignedTasksAsync(
                workspaceId,
                currentUserId))
        {
            throw new ConflictException(
                "You cannot leave this workspace while you still have unfinished assigned tasks. Complete or cancel all assigned tasks first.");
        }

        var managedProjects =
            await _dbContext.Projects
                .Where(project =>
                    project.WorkspaceId ==
                        workspaceId &&
                    project.ManagerUserId ==
                        currentUserId &&
                    !project.IsDeleted)
                .ToListAsync();

        var ownerUserId =
            await GetWorkspaceOwnerUserIdAsync(
                workspaceId);

        var now =
            DateTime.UtcNow;

        foreach (var project in managedProjects)
        {
            project.ManagerUserId =
                null;

            project.UpdatedAt =
                now;
        }

        var memberName =
            member.User.FullName;

        var roleName =
            member.Role.Name;

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
            "member.left",
            nameof(WorkspaceMember),
            member.Id,
            $"{memberName} left the workspace. Previous role: {roleName}.");

        /*
         * Owner must know immediately if any project
         * became manager-less because of this departure.
         */
        foreach (var project in managedProjects)
        {
            await _notificationService.CreateAsync(
                ownerUserId,
                workspaceId,
                "Project requires a new manager",
                $"{memberName} left the workspace and project \"{project.Name}\" no longer has a manager. Please assign a new project manager.",
                "project.manager_required",
                nameof(Project),
                project.Id);
        }
    }

    public async Task DeleteAsync(
        int workspaceId)
    {
        var userId =
            _currentUserService.UserId;

        var isSystemAdmin =
            await IsSystemAdminAsync(
                userId);

        var workspace =
            await _dbContext.Workspaces
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.Role)
                .FirstOrDefaultAsync(workspace =>
                    workspace.Id ==
                        workspaceId &&
                    !workspace.IsDeleted);

        if (workspace is null)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }

        await _permissionService
            .EnsurePermissionAsync(
                workspaceId,
                SystemPermissions.WorkspaceManage);

        if (!isSystemAdmin)
        {
            EnsureOwner(
                workspace,
                userId);
        }

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

    private static WorkspaceResponse
        MapToResponse(
            Workspace workspace,
            int currentUserId,
            bool isSystemAdmin)
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
                isSystemAdmin
                    ? "SystemAdmin"
                    : currentMember?.Role?.Name ??
                      string.Empty,

            CreatedAt =
                workspace.CreatedAt
        };
    }

    private async Task<bool>
        IsSystemAdminAsync(
            int userId)
    {
        return await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(user =>
                user.Id ==
                    userId &&
                user.IsSystemAdmin &&
                user.IsActive &&
                !user.IsDeleted);
    }

    private async Task<bool>
        HasActiveAssignedTasksAsync(
            int workspaceId,
            int userId)
    {
        return await _dbContext.TaskAssignees
            .AsNoTracking()
            .AnyAsync(assignment =>
                assignment.UserId ==
                    userId &&
                !assignment.IsDeleted &&
                !assignment.TaskItem.IsDeleted &&
                !assignment.TaskItem.Project.IsDeleted &&
                assignment.TaskItem.Project.WorkspaceId ==
                    workspaceId &&
                assignment.TaskItem.Status !=
                    TaskItemStatus.Done &&
                assignment.TaskItem.Status !=
                    TaskItemStatus.Cancelled);
    }

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

    private static void EnsureOwner(
        Workspace workspace,
        int userId)
    {
        var isOwner =
            workspace.WorkspaceMembers.Any(
                member =>
                    member.UserId ==
                        userId &&
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