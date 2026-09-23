using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.WorkspaceInvitations;
using TaskManagement.Application.DTOs.WorkspaceMembers;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class WorkspaceInvitationService
    : IWorkspaceInvitationService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public WorkspaceInvitationService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _activityLogService = activityLogService;
        _notificationService = notificationService;
    }

    public async Task<List<WorkspaceInvitationResponse>>
        GetMyInvitationsAsync()
    {
        var currentUserId =
            _currentUserService.UserId;

        var invitations =
            await _dbContext.WorkspaceInvitations
                .AsNoTracking()
                .Include(x => x.Workspace)
                .Include(x => x.InvitedUser)
                .Include(x => x.InvitedByUser)
                .Include(x => x.Role)
                .Where(x =>
                    x.InvitedUserId == currentUserId &&
                    x.Status ==
                        WorkspaceInvitationStatus.Pending &&
                    !x.IsDeleted)
                .OrderByDescending(x =>
                    x.CreatedAt)
                .ToListAsync();

        return invitations
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<List<WorkspaceInvitationResponse>>
        GetWorkspaceInvitationsAsync(
            int workspaceId)
    {
        await EnsureCanManageWorkspaceAsync(
            workspaceId);

        var invitations =
            await _dbContext.WorkspaceInvitations
                .AsNoTracking()
                .Include(x => x.Workspace)
                .Include(x => x.InvitedUser)
                .Include(x => x.InvitedByUser)
                .Include(x => x.Role)
                .Where(x =>
                    x.WorkspaceId == workspaceId &&
                    !x.IsDeleted)
                .OrderByDescending(x =>
                    x.CreatedAt)
                .ToListAsync();

        return invitations
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<WorkspaceInvitationCreateResult>
        CreateAsync(
            int workspaceId,
            CreateWorkspaceInvitationRequest request)
    {
        var currentUserId =
            _currentUserService.UserId;

        var workspace =
            await EnsureCanManageWorkspaceAsync(
                workspaceId);

        var user =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id == request.UserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (user is null)
        {
            throw new NotFoundException(
                "User not found or inactive.");
        }

        if (user.IsSystemAdmin)
        {
            throw new BadRequestException(
                "The system administrator cannot be added as a workspace member.");
        }

        if (user.Id == currentUserId)
        {
            throw new BadRequestException(
                "You cannot invite yourself to the workspace.");
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

        EnsureAssignableWorkspaceRole(
            role);

        var activeMembershipInTarget =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == user.Id &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (activeMembershipInTarget)
        {
            throw new ConflictException(
                "User is already an active member of this workspace.");
        }

        var hasAnotherActiveWorkspace =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.UserId == user.Id &&
                    member.WorkspaceId != workspaceId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.Workspace.IsDeleted);

        /*
         * No other active workspace:
         * add directly.
         */
        if (!hasAnotherActiveWorkspace)
        {
            var member =
                await AddOrReactivateMemberAsync(
                    workspaceId,
                    user,
                    role);

            await _dbContext.SaveChangesAsync();

            await _activityLogService.LogAsync(
                workspaceId,
                "member.added",
                nameof(WorkspaceMember),
                member.Id,
                $"Added {user.FullName} directly to workspace \"{workspace.Name}\" with role {role.Name}.");

            await _notificationService.CreateAsync(
                user.Id,
                workspaceId,
                "تمت إضافتك إلى مساحة عمل",
                $"تمت إضافتك إلى مساحة العمل \"{workspace.Name}\" بدور {NotificationCopy.Role(role.Name)}.",
                "workspace.member_added",
                nameof(WorkspaceMember),
                member.Id);

            return new WorkspaceInvitationCreateResult
            {
                AddedDirectly = true,

                Message =
                    "User was added to the workspace directly.",

                Member =
                    MapMemberToResponse(
                        member),

                Invitation = null
            };
        }

        /*
         * User belongs to another workspace:
         * create / update pending invitation.
         */
        var existingPendingInvitation =
            await _dbContext.WorkspaceInvitations
                .FirstOrDefaultAsync(x =>
                    x.WorkspaceId == workspaceId &&
                    x.InvitedUserId == user.Id &&
                    x.Status ==
                        WorkspaceInvitationStatus.Pending &&
                    !x.IsDeleted);

        if (existingPendingInvitation is not null)
        {
            var roleChanged =
                existingPendingInvitation.RoleId !=
                role.Id;

            existingPendingInvitation.RoleId =
                role.Id;

            existingPendingInvitation.InvitedByUserId =
                currentUserId;

            existingPendingInvitation.UpdatedAt =
                DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            if (roleChanged)
            {
                await _notificationService.CreateAsync(
                    user.Id,
                    workspaceId,
                    "تم تحديث دعوة مساحة العمل",
                    $"تم تحديث دعوتك إلى مساحة العمل \"{workspace.Name}\". الدور المقترح: {NotificationCopy.Role(role.Name)}.",
                    "workspace.invitation_updated",
                    nameof(WorkspaceInvitation),
                    existingPendingInvitation.Id);
            }

            var refreshedInvitation =
                await GetInvitationResponseByIdAsync(
                    existingPendingInvitation.Id);

            return new WorkspaceInvitationCreateResult
            {
                AddedDirectly = false,

                Message =
                    "A pending invitation already exists and has been updated.",

                Member = null,

                Invitation =
                    refreshedInvitation
            };
        }

        /*
         * IMPORTANT:
         *
         * Store only FK values.
         *
         * Do NOT attach User / Workspace / Role navigation
         * objects here because some of them may already be
         * tracked by the current DbContext.
         */
        var invitation =
            new WorkspaceInvitation
            {
                WorkspaceId =
                    workspaceId,

                InvitedUserId =
                    user.Id,

                InvitedByUserId =
                    currentUserId,

                RoleId =
                    role.Id,

                Status =
                    WorkspaceInvitationStatus.Pending,

                CreatedAt =
                    DateTime.UtcNow
            };

        _dbContext.WorkspaceInvitations.Add(
            invitation);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "workspace.invitation_created",
            nameof(WorkspaceInvitation),
            invitation.Id,
            $"Invited {user.FullName} to workspace \"{workspace.Name}\" with role {role.Name}.");

        await _notificationService.CreateAsync(
            user.Id,
            workspaceId,
            "دعوة إلى مساحة عمل",
            $"دُعيت للانضمام إلى مساحة العمل \"{workspace.Name}\" بدور {NotificationCopy.Role(role.Name)}.",
            "workspace.invitation_received",
            nameof(WorkspaceInvitation),
            invitation.Id);

        var savedInvitation =
            await GetInvitationResponseByIdAsync(
                invitation.Id);

        return new WorkspaceInvitationCreateResult
        {
            AddedDirectly = false,

            Message =
                "Workspace invitation created successfully.",

            Member = null,

            Invitation =
                savedInvitation
        };
    }

    public async Task AcceptAsync(
        int invitationId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var invitation =
            await GetInvitationForResponseAsync(
                invitationId,
                currentUserId);

        if (invitation.Status ==
            WorkspaceInvitationStatus.Accepted)
        {
            return;
        }

        if (invitation.Status !=
            WorkspaceInvitationStatus.Pending)
        {
            throw new ConflictException(
                "This invitation is no longer pending.");
        }

        if (invitation.Workspace.IsDeleted)
        {
            throw new ConflictException(
                "The workspace is no longer available.");
        }

        if (invitation.Role.IsDeleted ||
            invitation.Role.Name ==
                SystemRoles.WorkspaceOwner)
        {
            throw new ConflictException(
                "The role assigned to this invitation is no longer available.");
        }

        var activeMembershipExists =
            await _dbContext.WorkspaceMembers
                .AnyAsync(member =>
                    member.WorkspaceId ==
                        invitation.WorkspaceId &&
                    member.UserId ==
                        currentUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (activeMembershipExists)
        {
            MarkInvitationAccepted(
                invitation,
                DateTime.UtcNow);

            await _dbContext.SaveChangesAsync();
            return;
        }

        var user =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id ==
                        currentUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (user is null)
        {
            throw new UnauthorizedException(
                "Your user account is not available.");
        }

        /*
         * Accepting does not remove membership from
         * other workspaces.
         */
        var member =
            await AddOrReactivateMemberAsync(
                invitation.WorkspaceId,
                user,
                invitation.Role);

        var now =
            DateTime.UtcNow;

        MarkInvitationAccepted(
            invitation,
            now);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            invitation.WorkspaceId,
            "workspace.invitation_accepted",
            nameof(WorkspaceInvitation),
            invitation.Id,
            $"{user.FullName} accepted the workspace invitation and joined with role {invitation.Role.Name}.");

        var ownerUserId =
            await GetWorkspaceOwnerUserIdAsync(
                invitation.WorkspaceId);

        await _notificationService.CreateManyAsync(
            new[]
            {
                invitation.InvitedByUserId,
                ownerUserId
            },
            invitation.WorkspaceId,
            "تم قبول دعوة مساحة العمل",
            $"{user.FullName} قبل الدعوة إلى مساحة العمل \"{invitation.Workspace.Name}\" وانضم بدور {NotificationCopy.Role(invitation.Role.Name)}.",
            "workspace.invitation_accepted",
            nameof(WorkspaceMember),
            member.Id);
    }

    public async Task RejectAsync(
        int invitationId)
    {
        var currentUserId =
            _currentUserService.UserId;

        var invitation =
            await GetInvitationForResponseAsync(
                invitationId,
                currentUserId);

        if (invitation.Status !=
            WorkspaceInvitationStatus.Pending)
        {
            throw new ConflictException(
                "This invitation is no longer pending.");
        }

        var now =
            DateTime.UtcNow;

        invitation.Status =
            WorkspaceInvitationStatus.Rejected;

        invitation.RespondedAt =
            now;

        invitation.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            invitation.WorkspaceId,
            "workspace.invitation_rejected",
            nameof(WorkspaceInvitation),
            invitation.Id,
            $"{invitation.InvitedUser.FullName} rejected the workspace invitation.");

        var ownerUserId =
            await GetWorkspaceOwnerUserIdAsync(
                invitation.WorkspaceId);

        await _notificationService.CreateManyAsync(
            new[]
            {
                invitation.InvitedByUserId,
                ownerUserId
            },
            invitation.WorkspaceId,
            "تم رفض دعوة مساحة العمل",
            $"{invitation.InvitedUser.FullName} رفض الدعوة إلى مساحة العمل \"{invitation.Workspace.Name}\".",
            "workspace.invitation_rejected",
            nameof(WorkspaceInvitation),
            invitation.Id);
    }

    public async Task CancelAsync(
        int workspaceId,
        int invitationId)
    {
        await EnsureCanManageWorkspaceAsync(
            workspaceId);

        var invitation =
            await _dbContext.WorkspaceInvitations
                .Include(x => x.Workspace)
                .Include(x => x.InvitedUser)
                .Include(x => x.InvitedByUser)
                .Include(x => x.Role)
                .FirstOrDefaultAsync(x =>
                    x.Id == invitationId &&
                    x.WorkspaceId == workspaceId &&
                    !x.IsDeleted);

        if (invitation is null)
        {
            throw new NotFoundException(
                "Workspace invitation not found.");
        }

        if (invitation.Status !=
            WorkspaceInvitationStatus.Pending)
        {
            throw new ConflictException(
                "Only a pending invitation can be cancelled.");
        }

        var now =
            DateTime.UtcNow;

        invitation.Status =
            WorkspaceInvitationStatus.Cancelled;

        invitation.RespondedAt =
            now;

        invitation.UpdatedAt =
            now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "workspace.invitation_cancelled",
            nameof(WorkspaceInvitation),
            invitation.Id,
            $"Cancelled invitation for {invitation.InvitedUser.FullName}.");

        await _notificationService.CreateAsync(
            invitation.InvitedUserId,
            workspaceId,
            "تم إلغاء دعوة مساحة العمل",
            $"أُلغيت دعوتك إلى مساحة العمل \"{invitation.Workspace.Name}\".",
            "workspace.invitation_cancelled",
            nameof(WorkspaceInvitation),
            invitation.Id);
    }

    private async Task<WorkspaceMember>
        AddOrReactivateMemberAsync(
            int workspaceId,
            User user,
            Role role)
    {
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
                        user.Id);

        if (existingMember is not null)
        {
            if (!existingMember.IsDeleted &&
                existingMember.Status ==
                    WorkspaceMemberStatus.Active)
            {
                throw new ConflictException(
                    "User is already an active member of this workspace.");
            }

            existingMember.RoleId =
                role.Id;

            existingMember.Status =
                WorkspaceMemberStatus.Active;

            existingMember.JoinedAt =
                now;

            existingMember.IsDeleted =
                false;

            existingMember.DeletedAt =
                null;

            existingMember.UpdatedAt =
                now;

            return existingMember;
        }

        /*
         * Again: use FK values only.
         * Avoid attaching an entity graph unnecessarily.
         */
        var member =
            new WorkspaceMember
            {
                WorkspaceId =
                    workspaceId,

                UserId =
                    user.Id,

                RoleId =
                    role.Id,

                Status =
                    WorkspaceMemberStatus.Active,

                JoinedAt =
                    now,

                CreatedAt =
                    now
            };

        _dbContext.WorkspaceMembers.Add(
            member);

        return member;
    }

    private async Task<Workspace>
        EnsureCanManageWorkspaceAsync(
            int workspaceId)
    {
        var currentUserId =
            _currentUserService.UserId;

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

        var isSystemAdmin =
            await _dbContext.Users
                .AsNoTracking()
                .AnyAsync(user =>
                    user.Id ==
                        currentUserId &&
                    user.IsSystemAdmin &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (isSystemAdmin)
        {
            return workspace;
        }

        var isOwner =
            workspace.WorkspaceMembers
                .Any(member =>
                    member.UserId ==
                        currentUserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted &&
                    !member.Role.IsDeleted &&
                    member.Role.Name ==
                        SystemRoles.WorkspaceOwner);

        if (!isOwner)
        {
            throw new ForbiddenException(
                "Only the workspace owner can manage workspace invitations.");
        }

        return workspace;
    }

    private async Task<WorkspaceInvitation>
        GetInvitationForResponseAsync(
            int invitationId,
            int currentUserId)
    {
        var invitation =
            await _dbContext.WorkspaceInvitations
                .Include(x => x.Workspace)
                .Include(x => x.InvitedUser)
                .Include(x => x.InvitedByUser)
                .Include(x => x.Role)
                .FirstOrDefaultAsync(x =>
                    x.Id == invitationId &&
                    x.InvitedUserId ==
                        currentUserId &&
                    !x.IsDeleted);

        if (invitation is null)
        {
            throw new NotFoundException(
                "Workspace invitation not found.");
        }

        return invitation;
    }

    private async Task<WorkspaceInvitationResponse>
        GetInvitationResponseByIdAsync(
            int invitationId)
    {
        var invitation =
            await _dbContext.WorkspaceInvitations
                .AsNoTracking()
                .Include(x => x.Workspace)
                .Include(x => x.InvitedUser)
                .Include(x => x.InvitedByUser)
                .Include(x => x.Role)
                .FirstOrDefaultAsync(x =>
                    x.Id == invitationId &&
                    !x.IsDeleted);

        if (invitation is null)
        {
            throw new NotFoundException(
                "Workspace invitation not found.");
        }

        return MapToResponse(
            invitation);
    }

    private static void
        MarkInvitationAccepted(
            WorkspaceInvitation invitation,
            DateTime respondedAt)
    {
        invitation.Status =
            WorkspaceInvitationStatus.Accepted;

        invitation.RespondedAt =
            respondedAt;

        invitation.UpdatedAt =
            respondedAt;
    }

    private static void
        EnsureAssignableWorkspaceRole(
            Role role)
    {
        if (role.Name !=
                SystemRoles.ProjectManager &&
            role.Name !=
                SystemRoles.Member)
        {
            throw new ConflictException(
                "Only ProjectManager and Member can be invited. Use ownership transfer for WorkspaceOwner.");
        }
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

    private static WorkspaceInvitationResponse
        MapToResponse(
            WorkspaceInvitation invitation)
    {
        return new WorkspaceInvitationResponse
        {
            Id =
                invitation.Id,

            WorkspaceId =
                invitation.WorkspaceId,

            WorkspaceName =
                invitation.Workspace?.Name ??
                string.Empty,

            InvitedUserId =
                invitation.InvitedUserId,

            InvitedUserFullName =
                invitation.InvitedUser?.FullName ??
                string.Empty,

            InvitedByUserId =
                invitation.InvitedByUserId,

            InvitedByUserFullName =
                invitation.InvitedByUser?.FullName ??
                string.Empty,

            RoleId =
                invitation.RoleId,

            RoleName =
                invitation.Role?.Name ??
                string.Empty,

            Status =
                invitation.Status.ToString(),

            CreatedAt =
                invitation.CreatedAt,

            RespondedAt =
                invitation.RespondedAt
        };
    }

    private static WorkspaceMemberResponse
        MapMemberToResponse(
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