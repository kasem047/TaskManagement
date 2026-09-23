using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common;
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
        var adminUserId =
            _currentUserService.UserId;

        if (!await IsSystemAdminAsync(
                adminUserId))
        {
            throw new ForbiddenException(
                "Only the system administrator can create workspaces.");
        }

        var owner =
            await GetEligibleWorkspaceOwnerAsync(
                request.OwnerUserId);

        var ownerRole =
            await GetWorkspaceOwnerRoleAsync();

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
                    adminUserId,

                CreatedAt =
                    now
            };

        var workspaceMember =
            new WorkspaceMember
            {
                Workspace =
                    workspace,

                UserId =
                    owner.Id,

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
            $"Created workspace: {workspace.Name} and assigned owner {owner.FullName}.");

        await _notificationService.CreateAsync(
            owner.Id,
            workspace.Id,
            "إسناد مساحة عمل",
            $"تم تعيينك مالكًا لمساحة العمل \"{workspace.Name}\".",
            "workspace.assigned",
            nameof(Workspace),
            workspace.Id);

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
                .Include(workspace =>
                    workspace.WorkspaceMembers)
                .ThenInclude(member =>
                    member.User)
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

        if (!isSystemAdmin)
        {
            throw new ForbiddenException(
                "Only the system administrator can assign a new workspace owner.");
        }

        await ApplyOwnershipChangeAsync(
            workspaceId,
            request.NewOwnerUserId);
    }

    private async Task ApplyOwnershipChangeAsync(
        int workspaceId,
        int newOwnerUserId)
    {
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

        if (newOwnerUserId ==
            currentOwner.UserId)
        {
            throw new BadRequestException(
                "The selected user is already the workspace owner.");
        }

        var newOwnerUser =
            await GetEligibleWorkspaceOwnerAsync(
                newOwnerUserId,
                workspaceId);

        var ownerRole =
            await GetWorkspaceOwnerRoleAsync();

        var now =
            DateTime.UtcNow;

        var newOwnerMember =
            workspace.WorkspaceMembers
                .FirstOrDefault(member =>
                    member.UserId ==
                        newOwnerUserId &&
                    !member.IsDeleted);

        if (newOwnerMember is null)
        {
            newOwnerMember =
                new WorkspaceMember
                {
                    WorkspaceId =
                        workspaceId,

                    UserId =
                        newOwnerUser.Id,

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
                newOwnerMember);
        }
        else
        {
            newOwnerMember.RoleId =
                ownerRole.Id;

            newOwnerMember.Role =
                ownerRole;

            newOwnerMember.Status =
                WorkspaceMemberStatus.Active;

            newOwnerMember.UpdatedAt =
                now;
        }

        var oldOwnerName =
            currentOwner.User?.FullName ??
            "Previous owner";

        var newOwnerName =
            newOwnerUser.FullName;

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
            "workspace.ownership_assigned",
            nameof(Workspace),
            workspace.Id,
            $"Assigned workspace ownership from {oldOwnerName} to {newOwnerName}.");

        await _notificationService.CreateAsync(
            newOwnerUser.Id,
            workspaceId,
            "إسناد ملكية مساحة عمل",
            $"أصبحت مالك مساحة العمل \"{workspace.Name}\".",
            "workspace.ownership_assigned",
            nameof(Workspace),
            workspace.Id);

        await _notificationService.CreateAsync(
            currentOwner.UserId,
            workspaceId,
            "إسناد ملكية مساحة عمل",
            $"قام مسؤول النظام بتعيين {newOwnerName} مالكًا لمساحة العمل \"{workspace.Name}\". لم تعد عضوًا في هذه المساحة.",
            "workspace.ownership_assigned",
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
                "Workspace owner cannot leave directly. A system administrator must assign a new owner first.");
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
                "المشروع يحتاج مديرًا جديدًا",
                $"{memberName} غادر مساحة العمل وأصبح المشروع \"{project.Name}\" بلا مدير. يرجى تعيين مدير مشروع جديد.",
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

        var owner =
            workspace.WorkspaceMembers
                .FirstOrDefault(member =>
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    member.Role?.Name ==
                        SystemRoles.WorkspaceOwner);

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

            OwnerUserId =
                owner?.UserId ?? 0,

            OwnerUserName =
                owner?.User?.FullName ??
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

    private async Task<User>
        GetEligibleWorkspaceOwnerAsync(
            int ownerUserId,
            int? exceptWorkspaceId = null)
    {
        var owner =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id ==
                        ownerUserId &&
                    !user.IsDeleted);

        if (owner is null)
        {
            throw new NotFoundException(
                "The selected owner was not found.");
        }

        if (!owner.IsActive)
        {
            throw new ConflictException(
                "The selected owner account is inactive.");
        }

        if (owner.IsSystemAdmin)
        {
            throw new BadRequestException(
                "System administrator cannot be assigned as a workspace owner.");
        }

        var alreadyOwnsActiveWorkspace =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.UserId ==
                        ownerUserId &&
                    (
                        exceptWorkspaceId == null ||
                        member.WorkspaceId !=
                            exceptWorkspaceId.Value
                    ) &&
                    !member.IsDeleted &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.Workspace.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner);

        if (alreadyOwnsActiveWorkspace)
        {
            throw new ConflictException(
                "The selected user already owns an active workspace.");
        }

        return owner;
    }

    private async Task<Role>
        GetWorkspaceOwnerRoleAsync()
    {
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

        return ownerRole;
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