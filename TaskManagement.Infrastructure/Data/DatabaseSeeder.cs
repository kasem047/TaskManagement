using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(
        ApplicationDbContext context)
    {
        await using var transaction =
            await context.Database.BeginTransactionAsync();

        try
        {
            await SeedRolesAsync(context);
            await SeedPermissionsAsync(context);
            await SeedRolePermissionsAsync(context);

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static async Task SeedRolesAsync(
        ApplicationDbContext context)
    {
        var roles = await context.Roles.ToListAsync();

        var workspaceOwner = roles.FirstOrDefault(
            role =>
                role.Name ==
                SystemRoles.WorkspaceOwner);

        var oldOwner = roles.FirstOrDefault(
            role =>
                role.Name == "Owner");

        if (workspaceOwner is null &&
            oldOwner is not null)
        {
            oldOwner.Name =
                SystemRoles.WorkspaceOwner;

            oldOwner.Description =
                "Own and manage workspace, members and projects";

            oldOwner.IsSystemRole = true;

            workspaceOwner = oldOwner;
        }
        else if (workspaceOwner is null)
        {
            workspaceOwner = new Role
            {
                Name =
                    SystemRoles.WorkspaceOwner,

                Description =
                    "Own and manage workspace, members and projects",

                IsSystemRole = true
            };

            await context.Roles.AddAsync(
                workspaceOwner);
        }
        else
        {
            workspaceOwner.Description =
                "Own and manage workspace, members and projects";

            workspaceOwner.IsSystemRole = true;
        }

        await context.SaveChangesAsync();

        if (oldOwner is not null &&
            oldOwner.Id != workspaceOwner.Id)
        {
            await MoveMembersToRoleAsync(
                context,
                oldOwner.Id,
                workspaceOwner.Id);

            await RemoveRoleAsync(
                context,
                oldOwner);
        }

        roles = await context.Roles.ToListAsync();

        var projectManager = roles.FirstOrDefault(
            role =>
                role.Name ==
                SystemRoles.ProjectManager);

        var oldAdmin = roles.FirstOrDefault(
            role =>
                role.Name == "Admin");

        if (projectManager is null &&
            oldAdmin is not null)
        {
            oldAdmin.Name =
                SystemRoles.ProjectManager;

            oldAdmin.Description =
                "Manage project tasks, assignments and progress";

            oldAdmin.IsSystemRole = true;

            projectManager = oldAdmin;
        }
        else if (projectManager is null)
        {
            projectManager = new Role
            {
                Name =
                    SystemRoles.ProjectManager,

                Description =
                    "Manage project tasks, assignments and progress",

                IsSystemRole = true
            };

            await context.Roles.AddAsync(
                projectManager);
        }
        else
        {
            projectManager.Description =
                "Manage project tasks, assignments and progress";

            projectManager.IsSystemRole = true;
        }

        await context.SaveChangesAsync();

        if (oldAdmin is not null &&
            oldAdmin.Id != projectManager.Id)
        {
            await MoveMembersToRoleAsync(
                context,
                oldAdmin.Id,
                projectManager.Id);

            await RemoveRoleAsync(
                context,
                oldAdmin);
        }

        var member = await context.Roles
            .FirstOrDefaultAsync(
                role =>
                    role.Name ==
                    SystemRoles.Member);

        if (member is null)
        {
            member = new Role
            {
                Name = SystemRoles.Member,

                Description =
                    "View and execute assigned tasks",

                IsSystemRole = true
            };

            await context.Roles.AddAsync(
                member);
        }
        else
        {
            member.Description =
                "View and execute assigned tasks";

            member.IsSystemRole = true;
        }

        await context.SaveChangesAsync();

        var viewer = await context.Roles
            .FirstOrDefaultAsync(
                role =>
                    role.Name == "Viewer");

        if (viewer is not null)
        {
            await MoveMembersToRoleAsync(
                context,
                viewer.Id,
                member.Id);

            await RemoveRoleAsync(
                context,
                viewer);
        }
    }

    private static async Task MoveMembersToRoleAsync(
        ApplicationDbContext context,
        int sourceRoleId,
        int targetRoleId)
    {
        var workspaceMembers =
            await context.WorkspaceMembers
                .Where(member =>
                    member.RoleId ==
                    sourceRoleId)
                .ToListAsync();

        foreach (var workspaceMember
                 in workspaceMembers)
        {
            workspaceMember.RoleId =
                targetRoleId;

            workspaceMember.UpdatedAt =
                DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }

    private static async Task RemoveRoleAsync(
        ApplicationDbContext context,
        Role role)
    {
        var rolePermissions =
            await context.RolePermissions
                .Where(rolePermission =>
                    rolePermission.RoleId ==
                    role.Id)
                .ToListAsync();

        context.RolePermissions.RemoveRange(
            rolePermissions);

        context.Roles.Remove(role);

        await context.SaveChangesAsync();
    }

    private static async Task SeedPermissionsAsync(
        ApplicationDbContext context)
    {
        var permissions =
            await context.Permissions
                .ToListAsync();

        var oldTaskUpdate =
            permissions.FirstOrDefault(
                permission =>
                    permission.Name ==
                    "task.update");

        var taskDetailsUpdate =
            permissions.FirstOrDefault(
                permission =>
                    permission.Name ==
                    SystemPermissions.TaskDetailsUpdate);

        if (oldTaskUpdate is not null &&
            taskDetailsUpdate is null)
        {
            oldTaskUpdate.Name =
                SystemPermissions.TaskDetailsUpdate;

            oldTaskUpdate.Module =
                "Tasks";

            oldTaskUpdate.Description =
                "Update task title, description and details";
        }

        var requiredPermissions =
            new[]
            {
                new Permission
                {
                    Name =
                        SystemPermissions.WorkspaceManage,

                    Module =
                        "Workspace",

                    Description =
                        "Manage workspace settings"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.MemberInvite,

                    Module =
                        "Members",

                    Description =
                        "Invite members to workspace"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.MemberRemove,

                    Module =
                        "Members",

                    Description =
                        "Remove members from workspace"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.MemberChangeRole,

                    Module =
                        "Members",

                    Description =
                        "Change workspace member role"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.ProjectCreate,

                    Module =
                        "Projects",

                    Description =
                        "Create projects inside workspace"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.ProjectView,

                    Module =
                        "Projects",

                    Description =
                        "View projects"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.ProjectUpdate,

                    Module =
                        "Projects",

                    Description =
                        "Update project details"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.ProjectDelete,

                    Module =
                        "Projects",

                    Description =
                        "Delete projects"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskCreate,

                    Module =
                        "Tasks",

                    Description =
                        "Create tasks"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskView,

                    Module =
                        "Tasks",

                    Description =
                        "View tasks"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskDetailsUpdate,

                    Module =
                        "Tasks",

                    Description =
                        "Update task title, description and details"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskStatusUpdate,

                    Module =
                        "Tasks",

                    Description =
                        "Update task status and position"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskDelete,

                    Module =
                        "Tasks",

                    Description =
                        "Delete tasks"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskAssign,

                    Module =
                        "Tasks",

                    Description =
                        "Assign tasks to workspace members"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskComment,

                    Module =
                        "Tasks",

                    Description =
                        "Add task comments"
                },

                new Permission
                {
                    Name =
                        SystemPermissions.TaskAttachmentUpload,

                    Module =
                        "Tasks",

                    Description =
                        "Upload task attachments"
                }
            };

        var existingPermissionNames =
            permissions
                .Select(permission =>
                    permission.Name)
                .ToHashSet(
                    StringComparer.OrdinalIgnoreCase);

        var missingPermissions =
            requiredPermissions
                .Where(permission =>
                    !existingPermissionNames.Contains(
                        permission.Name))
                .ToList();

        if (missingPermissions.Count > 0)
        {
            await context.Permissions.AddRangeAsync(
                missingPermissions);
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedRolePermissionsAsync(
        ApplicationDbContext context)
    {
        var roles = await context.Roles
            .Where(role =>
                role.Name ==
                SystemRoles.WorkspaceOwner ||

                role.Name ==
                SystemRoles.ProjectManager ||

                role.Name ==
                SystemRoles.Member)
            .ToListAsync();

        var permissions =
            await context.Permissions
                .ToListAsync();

        var workspaceOwner = roles.First(
            role =>
                role.Name ==
                SystemRoles.WorkspaceOwner);

        var projectManager = roles.First(
            role =>
                role.Name ==
                SystemRoles.ProjectManager);

        var member = roles.First(
            role =>
                role.Name ==
                SystemRoles.Member);

        var permissionByName =
            permissions.ToDictionary(
                permission =>
                    permission.Name,

                StringComparer.OrdinalIgnoreCase);

        /*
         * Workspace Owner:
         * - manages workspace
         * - manages members and roles
         * - creates, updates and deletes projects
         * - has full task management permissions
         */
        var workspaceOwnerPermissionNames =
            new[]
            {
                SystemPermissions.WorkspaceManage,

                SystemPermissions.MemberInvite,
                SystemPermissions.MemberRemove,
                SystemPermissions.MemberChangeRole,

                SystemPermissions.ProjectCreate,
                SystemPermissions.ProjectView,
                SystemPermissions.ProjectUpdate,
                SystemPermissions.ProjectDelete,

                SystemPermissions.TaskCreate,
                SystemPermissions.TaskView,
                SystemPermissions.TaskDetailsUpdate,
                SystemPermissions.TaskStatusUpdate,
                SystemPermissions.TaskDelete,
                SystemPermissions.TaskAssign,
                SystemPermissions.TaskComment,
                SystemPermissions.TaskAttachmentUpload
            };

        /*
         * Project Manager:
         * - views the project
         * - manages project tasks
         * - cannot create, update or delete projects
         * - cannot manage workspace members or roles
         */
        var projectManagerPermissionNames =
            new[]
            {
                SystemPermissions.ProjectView,

                SystemPermissions.TaskCreate,
                SystemPermissions.TaskView,
                SystemPermissions.TaskDetailsUpdate,
                SystemPermissions.TaskStatusUpdate,
                SystemPermissions.TaskDelete,
                SystemPermissions.TaskAssign,
                SystemPermissions.TaskComment,
                SystemPermissions.TaskAttachmentUpload
            };

        /*
         * Member:
         * - views allowed projects and tasks
         * - updates task status
         * - adds comments and attachments
         */
        var memberPermissionNames =
            new[]
            {
                SystemPermissions.ProjectView,

                SystemPermissions.TaskView,
                SystemPermissions.TaskStatusUpdate,
                SystemPermissions.TaskComment,
                SystemPermissions.TaskAttachmentUpload
            };

        var desiredPermissions =
            new Dictionary<int, string[]>
            {
                [workspaceOwner.Id] =
                    workspaceOwnerPermissionNames,

                [projectManager.Id] =
                    projectManagerPermissionNames,

                [member.Id] =
                    memberPermissionNames
            };

        var targetRoleIds =
            desiredPermissions.Keys
                .ToList();

        var existingRolePermissions =
            await context.RolePermissions
                .Where(rolePermission =>
                    targetRoleIds.Contains(
                        rolePermission.RoleId))
                .ToListAsync();

        var desiredPairs =
            new HashSet<(
                int RoleId,
                int PermissionId)>();

        foreach (var rolePermissionGroup
                 in desiredPermissions)
        {
            foreach (var permissionName
                     in rolePermissionGroup.Value)
            {
                if (!permissionByName.TryGetValue(
                        permissionName,
                        out var permission))
                {
                    throw new InvalidOperationException(
                        $"Permission '{permissionName}' was not found.");
                }

                desiredPairs.Add((
                    rolePermissionGroup.Key,
                    permission.Id));
            }
        }

        var extraRolePermissions =
            existingRolePermissions
                .Where(rolePermission =>
                    !desiredPairs.Contains((
                        rolePermission.RoleId,
                        rolePermission.PermissionId)))
                .ToList();

        if (extraRolePermissions.Count > 0)
        {
            context.RolePermissions.RemoveRange(
                extraRolePermissions);
        }

        var remainingExistingPairs =
            existingRolePermissions
                .Where(rolePermission =>
                    !extraRolePermissions.Contains(
                        rolePermission))
                .Select(rolePermission =>
                    (
                        rolePermission.RoleId,
                        rolePermission.PermissionId
                    ))
                .ToHashSet();

        var missingRolePermissions =
            desiredPairs
                .Where(pair =>
                    !remainingExistingPairs.Contains(
                        pair))
                .Select(pair =>
                    new RolePermission
                    {
                        RoleId =
                            pair.RoleId,

                        PermissionId =
                            pair.PermissionId,

                        CreatedAt =
                            DateTime.UtcNow
                    })
                .ToList();

        if (missingRolePermissions.Count > 0)
        {
            await context.RolePermissions.AddRangeAsync(
                missingRolePermissions);
        }

        await context.SaveChangesAsync();
    }
}