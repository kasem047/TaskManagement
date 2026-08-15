using Microsoft.EntityFrameworkCore;
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
    private readonly IPermissionService _permissionService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;

    public ProjectService(
        IApplicationDbContext dbContext,
        IPermissionService permissionService,
        IActivityLogService activityLogService,
        INotificationService notificationService)
    {
        _dbContext = dbContext;
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

        var projects = await _dbContext.Projects
            .AsNoTracking()
            .Include(project =>
                project.ManagerUser)
            .Where(project =>
                project.WorkspaceId == workspaceId &&
                !project.IsDeleted)
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
                "Project manager assigned",
                $"You were assigned as manager of project \"{project.Name}\".",
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
                    "Project manager changed",
                    $"You are no longer the manager of project \"{project.Name}\".",
                    "project.manager_removed",
                    nameof(Project),
                    project.Id);
            }

            if (project.ManagerUserId.HasValue)
            {
                await _notificationService.CreateAsync(
                    project.ManagerUserId.Value,
                    workspaceId,
                    "Project manager assigned",
                    $"You were assigned as manager of project \"{project.Name}\".",
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
                "Project archived",
                $"Project \"{project.Name}\" was archived.",
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
                "Project deleted",
                $"Project \"{projectName}\" was deleted.",
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
}