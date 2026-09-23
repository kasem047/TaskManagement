using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Projects;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Services;

public sealed class ProjectService : IProjectService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public ProjectService(
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

    public async Task<List<ProjectResponse>> GetProjectsAsync(
        int workspaceId)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectView);

        var roleName =
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId);

        var query = ApplyProjectVisibility(
            _dbContext.Projects
                .AsNoTracking()
                .Include(project =>
                    project.ManagerUser)
                .Where(project =>
                    project.WorkspaceId == workspaceId &&
                    !project.IsDeleted),
            roleName);

        var projects = await query
            .OrderBy(project =>
                project.IsArchived)
            .ThenBy(project =>
                project.Name)
            .ToListAsync();

        return projects
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<ProjectResponse> GetProjectByIdAsync(
        int workspaceId,
        int projectId)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectView);

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await EnsureProjectVisibleAsync(
            project,
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId));

        return MapToResponse(project);
    }

    public async Task<ProjectResponse> CreateProjectAsync(
        int workspaceId,
        CreateProjectRequest request)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectCreate);

        var normalizedName =
            request.Name.Trim();

        var projectNameExists =
            await _dbContext.Projects.AnyAsync(project =>
                project.WorkspaceId == workspaceId &&
                !project.IsDeleted &&
                project.Name == normalizedName);

        if (projectNameExists)
        {
            throw new ConflictException(
                "A project with the same name already exists in this workspace.");
        }

        var managerUser =
            await GetValidProjectManagerAsync(
                workspaceId,
                request.ManagerUserId);

        var now = DateTime.UtcNow;

        var project = new Project
        {
            WorkspaceId = workspaceId,
            ManagerUserId = managerUser?.Id,
            ManagerUser = managerUser,
            Name = normalizedName,
            Description = NormalizeOptionalText(
                request.Description),
            IsArchived = false,
            CreatedAt = now
        };

        _dbContext.Projects.Add(project);

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "project.created",
            nameof(Project),
            project.Id,
            $"Created project: {project.Name}");

        if (project.ManagerUserId.HasValue)
        {
            await _notificationService.CreateAsync(
                project.ManagerUserId.Value,
                workspaceId,
                "تم تعيينك مديرًا للمشروع",
                $"تم تعيينك مديرًا للمشروع \"{project.Name}\".",
                "project.manager_assigned",
                nameof(Project),
                project.Id);
        }

        return MapToResponse(project);
    }

    public async Task<ProjectResponse> UpdateProjectAsync(
        int workspaceId,
        int projectId,
        UpdateProjectRequest request)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectUpdate);

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Archived projects cannot be updated.");
        }

        var normalizedName =
            request.Name.Trim();

        var projectNameExists =
            await _dbContext.Projects.AnyAsync(existingProject =>
                existingProject.WorkspaceId == workspaceId &&
                existingProject.Id != projectId &&
                !existingProject.IsDeleted &&
                existingProject.Name == normalizedName);

        if (projectNameExists)
        {
            throw new ConflictException(
                "A project with the same name already exists in this workspace.");
        }

        var previousManagerUserId =
            project.ManagerUserId;

        var managerUser =
            await GetValidProjectManagerAsync(
                workspaceId,
                request.ManagerUserId);

        var managerChanged =
            previousManagerUserId != managerUser?.Id;

        project.ManagerUserId = managerUser?.Id;
        project.ManagerUser = managerUser;
        project.Name = normalizedName;
        project.Description = NormalizeOptionalText(
            request.Description);
        project.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "project.updated",
            nameof(Project),
            project.Id,
            $"Updated project: {project.Name}");

        if (managerChanged)
        {
            if (previousManagerUserId.HasValue)
            {
                await _notificationService.CreateAsync(
                    previousManagerUserId.Value,
                    workspaceId,
                    "لم تعد مديرًا للمشروع",
                    $"لم تعد مديرًا للمشروع \"{project.Name}\".",
                    "project.manager_removed",
                    nameof(Project),
                    project.Id);
            }

            if (project.ManagerUserId.HasValue)
            {
                await _notificationService.CreateAsync(
                    project.ManagerUserId.Value,
                    workspaceId,
                    "تم تعيينك مديرًا للمشروع",
                    $"تم تعيينك مديرًا للمشروع \"{project.Name}\".",
                    "project.manager_assigned",
                    nameof(Project),
                    project.Id);
            }
        }

        return MapToResponse(project);
    }

    public async Task ArchiveProjectAsync(
        int workspaceId,
        int projectId)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectUpdate);

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Project is already archived.");
        }

        project.IsArchived = true;
        project.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "project.archived",
            nameof(Project),
            project.Id,
            $"Archived project: {project.Name}");

        if (project.ManagerUserId.HasValue)
        {
            await _notificationService.CreateAsync(
                project.ManagerUserId.Value,
                workspaceId,
                "تم أرشفة مشروع",
                $"تم أرشفة المشروع \"{project.Name}\".",
                "project.archived",
                nameof(Project),
                project.Id);
        }
    }

    public async Task DeleteProjectAsync(
        int workspaceId,
        int projectId)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectDelete);

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        var managerUserId =
            project.ManagerUserId;

        var projectName =
            project.Name;

        var now = DateTime.UtcNow;

        project.IsDeleted = true;
        project.DeletedAt = now;
        project.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "project.deleted",
            nameof(Project),
            project.Id,
            $"Deleted project: {projectName}");

        if (managerUserId.HasValue)
        {
            await _notificationService.CreateAsync(
                managerUserId.Value,
                workspaceId,
                "تم حذف مشروع",
                $"تم حذف المشروع \"{projectName}\".",
                "project.deleted",
                nameof(Project),
                project.Id);
        }
    }

    private async Task EnsureWorkspaceExistsAsync(
        int workspaceId)
    {
        var workspaceExists =
            await _dbContext.Workspaces.AnyAsync(workspace =>
                workspace.Id == workspaceId &&
                !workspace.IsDeleted);

        if (!workspaceExists)
        {
            throw new NotFoundException(
                "Workspace not found.");
        }
    }

    private async Task<Project> GetProjectAsync(
        int workspaceId,
        int projectId)
    {
        var project = await _dbContext.Projects
            .Include(currentProject =>
                currentProject.ManagerUser)
            .FirstOrDefaultAsync(currentProject =>
                currentProject.Id == projectId &&
                currentProject.WorkspaceId == workspaceId &&
                !currentProject.IsDeleted);

        if (project is null)
        {
            throw new NotFoundException(
                "Project not found.");
        }

        return project;
    }

    private IQueryable<Project> ApplyProjectVisibility(
        IQueryable<Project> query,
        string? roleName)
    {
        var userId =
            _currentUserService.UserId;

        if (roleName == "SystemAdmin" ||
            roleName == SystemRoles.WorkspaceOwner ||
            roleName == "Owner")
        {
            return query;
        }

        if (roleName == SystemRoles.ProjectManager)
        {
            return query.Where(project =>
                project.ManagerUserId == userId);
        }

        if (roleName == SystemRoles.Member)
        {
            return query.Where(project =>
                project.Members.Any(member =>
                    !member.IsDeleted &&
                    member.UserId == userId) ||
                project.Tasks.Any(task =>
                    !task.IsDeleted &&
                    task.TaskAssignees.Any(assignment =>
                        !assignment.IsDeleted &&
                        assignment.UserId == userId)));
        }

        return query.Where(_ => false);
    }

    private async Task EnsureProjectVisibleAsync(
        Project project,
        string? roleName)
    {
        var userId =
            _currentUserService.UserId;

        if (roleName == "SystemAdmin" ||
            roleName == SystemRoles.WorkspaceOwner ||
            roleName == "Owner")
        {
            return;
        }

        if (roleName == SystemRoles.ProjectManager)
        {
            if (project.ManagerUserId != userId)
            {
                throw new NotFoundException(
                    "Project not found.");
            }

            return;
        }

        if (roleName == SystemRoles.Member)
        {
            var assigned = await _dbContext.TaskAssignees
                .AsNoTracking()
                .AnyAsync(assignment =>
                    assignment.UserId == userId &&
                    !assignment.IsDeleted &&
                    !assignment.TaskItem.IsDeleted &&
                    assignment.TaskItem.ProjectId == project.Id);

            var isProjectMember =
                await _dbContext.ProjectMembers
                    .AsNoTracking()
                    .AnyAsync(member =>
                        member.ProjectId == project.Id &&
                        member.UserId == userId &&
                        !member.IsDeleted);

            if (!assigned &&
                !isProjectMember)
            {
                throw new NotFoundException(
                    "Project not found.");
            }

            return;
        }

        throw new NotFoundException(
            "Project not found.");
    }

    private async Task<User?> GetValidProjectManagerAsync(
        int workspaceId,
        int? managerUserId)
    {
        if (!managerUserId.HasValue)
        {
            return null;
        }

        var managerUser = await _dbContext.Users
            .FirstOrDefaultAsync(user =>
                user.Id == managerUserId.Value &&
                !user.IsDeleted);

        if (managerUser is null)
        {
            throw new NotFoundException(
                "Selected project manager was not found.");
        }

        if (!managerUser.IsActive)
        {
            throw new ConflictException(
                "Selected project manager account is inactive.");
        }

        var managerMembership =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == managerUserId.Value &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (managerMembership is null)
        {
            throw new BadRequestException(
                "Selected project manager must be an active member of this workspace.");
        }

        if (managerMembership.Role.Name !=
            SystemRoles.ProjectManager)
        {
            throw new BadRequestException(
                "Selected user must have the ProjectManager role in this workspace.");
        }

        return managerUser;
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

    private static ProjectResponse MapToResponse(
        Project project)
    {
        return new ProjectResponse
        {
            Id = project.Id,
            WorkspaceId = project.WorkspaceId,
            ManagerUserId = project.ManagerUserId,
            ManagerUserFullName =
                project.ManagerUser?.FullName,
            Name = project.Name,
            Description = project.Description,
            IsArchived = project.IsArchived,
            CreatedAt = project.CreatedAt,
            UpdatedAt = project.UpdatedAt
        };
    }

    public async Task<List<ProjectMemberResponse>>
        GetProjectMembersAsync(
            int workspaceId,
            int projectId)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectView);

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await EnsureProjectVisibleAsync(
            project,
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId));

        var memberRows =
            await _dbContext.ProjectMembers
                .AsNoTracking()
                .Where(member =>
                    member.ProjectId == projectId &&
                    !member.IsDeleted)
                .Select(member => new
                {
                    member.Id,
                    member.ProjectId,
                    member.UserId,
                    FullName = member.User.FullName,
                    Email = member.User.Email ?? string.Empty,
                    JoinedAt = member.CreatedAt
                })
                .OrderBy(member => member.FullName)
                .ToListAsync();

        if (memberRows.Count == 0)
        {
            return [];
        }

        var memberUserIds =
            memberRows
                .Select(member => member.UserId)
                .Distinct()
                .ToList();

        var roleRows =
            await _dbContext.WorkspaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.WorkspaceId == workspaceId &&
                    memberUserIds.Contains(member.UserId) &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted)
                .Select(member => new
                {
                    member.UserId,
                    RoleName = member.Role.Name
                })
                .ToListAsync();

        var roleByUserId =
            roleRows
                .GroupBy(row => row.UserId)
                .ToDictionary(
                    group => group.Key,
                    group =>
                        group.First().RoleName ??
                        string.Empty);

        return memberRows
            .Select(member => new ProjectMemberResponse
            {
                Id = member.Id,
                ProjectId = member.ProjectId,
                UserId = member.UserId,
                FullName = member.FullName,
                Email = member.Email,
                RoleName =
                    roleByUserId.GetValueOrDefault(
                        member.UserId,
                        string.Empty),
                JoinedAt = member.JoinedAt
            })
            .ToList();
    }

    public async Task<ProjectMemberResponse>
        AddProjectMemberAsync(
            int workspaceId,
            int projectId,
            AddProjectMemberRequest request)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectUpdate);

        var roleName =
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId);

        if (roleName != SystemRoles.WorkspaceOwner &&
            roleName != "Owner" &&
            roleName != "SystemAdmin")
        {
            throw new ForbiddenException(
                "Only the workspace owner can add members to a project.");
        }

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Members cannot be added to an archived project.");
        }

        var workspaceMember =
            await _dbContext.WorkspaceMembers
                .Include(member =>
                    member.User)
                .Include(member =>
                    member.Role)
                .FirstOrDefaultAsync(member =>
                    member.WorkspaceId == workspaceId &&
                    member.UserId == request.UserId &&
                    member.Status ==
                        WorkspaceMemberStatus.Active &&
                    !member.IsDeleted);

        if (workspaceMember is null)
        {
            throw new BadRequestException(
                "The selected user must be an active member of this workspace.");
        }

        if (!workspaceMember.User.IsActive ||
            workspaceMember.User.IsDeleted)
        {
            throw new ConflictException(
                "The selected user account is inactive or unavailable.");
        }

        if (workspaceMember.Role.Name ==
            SystemRoles.WorkspaceOwner)
        {
            throw new BadRequestException(
                "The workspace owner is already responsible for this project.");
        }

        var existingMember =
            await _dbContext.ProjectMembers
                .FirstOrDefaultAsync(member =>
                    member.ProjectId == projectId &&
                    member.UserId == request.UserId);

        var now = DateTime.UtcNow;

        if (existingMember is not null &&
            !existingMember.IsDeleted)
        {
            throw new ConflictException(
                "The selected user is already a member of this project.");
        }

        if (existingMember is not null)
        {
            existingMember.IsDeleted = false;
            existingMember.DeletedAt = null;
            existingMember.UpdatedAt = now;
        }
        else
        {
            existingMember = new ProjectMember
            {
                ProjectId = projectId,
                UserId = request.UserId,
                CreatedAt = now
            };

            _dbContext.ProjectMembers.Add(existingMember);
        }

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "project.member_added",
            nameof(Project),
            project.Id,
            $"Added {workspaceMember.User.FullName} to project: {project.Name}");

        await _notificationService.CreateAsync(
            request.UserId,
            workspaceId,
            "تمت إضافتك إلى مشروع",
            $"تمت إضافتك إلى المشروع \"{project.Name}\".",
            "project.member_added",
            nameof(Project),
            project.Id);

        return MapMemberToResponse(
            existingMember,
            workspaceMember.Role.Name,
            workspaceMember.User);
    }

    public async Task RemoveProjectMemberAsync(
        int workspaceId,
        int projectId,
        int userId)
    {
        await EnsureWorkspaceExistsAsync(workspaceId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.ProjectUpdate);

        var roleName =
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId);

        if (roleName != SystemRoles.WorkspaceOwner &&
            roleName != "Owner" &&
            roleName != "SystemAdmin")
        {
            throw new ForbiddenException(
                "Only the workspace owner can remove members from a project.");
        }

        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        var member =
            await _dbContext.ProjectMembers
                .Include(currentMember =>
                    currentMember.User)
                .FirstOrDefaultAsync(currentMember =>
                    currentMember.ProjectId == projectId &&
                    currentMember.UserId == userId &&
                    !currentMember.IsDeleted);

        if (member is null)
        {
            throw new NotFoundException(
                "Project member was not found.");
        }

        var now = DateTime.UtcNow;

        member.IsDeleted = true;
        member.DeletedAt = now;
        member.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "project.member_removed",
            nameof(Project),
            project.Id,
            $"Removed {member.User.FullName} from project: {project.Name}");
    }

    private static ProjectMemberResponse MapMemberToResponse(
        ProjectMember member,
        string roleName,
        User? user = null)
    {
        var mappedUser =
            user ?? member.User;

        return new ProjectMemberResponse
        {
            Id = member.Id,
            ProjectId = member.ProjectId,
            UserId = member.UserId,
            FullName =
                mappedUser?.FullName ??
                string.Empty,
            Email =
                mappedUser?.Email ??
                string.Empty,
            RoleName = roleName,
            JoinedAt = member.CreatedAt
        };
    }
}