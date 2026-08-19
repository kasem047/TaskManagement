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


    /* =========================================================
       ROLES
       ========================================================= */

    private static async Task SeedRolesAsync(
        ApplicationDbContext context)
    {
        var roles =
            await context.Roles
                .ToListAsync();


        /* =====================================================
           WORKSPACE OWNER
           ===================================================== */

        var workspaceOwner =
            roles.FirstOrDefault(
                role =>
                    role.Name ==
                    SystemRoles.WorkspaceOwner);


        /*
         * Compatibility with old databases
         * that used "Owner".
         */
        var oldOwner =
            roles.FirstOrDefault(
                role =>
                    role.Name == "Owner");


        if (workspaceOwner is null &&
            oldOwner is not null)
        {
            oldOwner.Name =
                SystemRoles.WorkspaceOwner;

            oldOwner.Description =
                "Own and manage workspace, members and projects";

            oldOwner.IsSystemRole =
                true;

            workspaceOwner =
                oldOwner;
        }
        else if (workspaceOwner is null)
        {
            workspaceOwner =
                new Role
                {
                    Name =
                        SystemRoles.WorkspaceOwner,

                    Description =
                        "Own and manage workspace, members and projects",

                    IsSystemRole =
                        true
                };


            await context.Roles.AddAsync(
                workspaceOwner);
        }
        else
        {
            /*
             * System role identity remains protected.
             *
             * Its permissions are NOT reset here.
             */
            workspaceOwner.IsSystemRole =
                true;
        }


        await context.SaveChangesAsync();


        /*
         * Remove legacy duplicate "Owner" role after
         * transferring all its members.
         */
        if (oldOwner is not null &&
            oldOwner.Id !=
                workspaceOwner.Id)
        {
            await MoveMembersToRoleAsync(
                context,
                oldOwner.Id,
                workspaceOwner.Id);


            await RemoveRoleAsync(
                context,
                oldOwner);
        }


        /* =====================================================
           PROJECT MANAGER
           ===================================================== */

        roles =
            await context.Roles
                .ToListAsync();


        var projectManager =
            roles.FirstOrDefault(
                role =>
                    role.Name ==
                    SystemRoles.ProjectManager);


        /*
         * Compatibility with old databases
         * that used "Admin".
         */
        var oldAdmin =
            roles.FirstOrDefault(
                role =>
                    role.Name == "Admin");


        if (projectManager is null &&
            oldAdmin is not null)
        {
            oldAdmin.Name =
                SystemRoles.ProjectManager;

            oldAdmin.Description =
                "Manage project tasks, assignments and progress";

            oldAdmin.IsSystemRole =
                true;

            projectManager =
                oldAdmin;
        }
        else if (projectManager is null)
        {
            projectManager =
                new Role
                {
                    Name =
                        SystemRoles.ProjectManager,

                    Description =
                        "Manage project tasks, assignments and progress",

                    IsSystemRole =
                        true
                };


            await context.Roles.AddAsync(
                projectManager);
        }
        else
        {
            /*
             * Do not reset its permissions here.
             */
            projectManager.IsSystemRole =
                true;
        }


        await context.SaveChangesAsync();


        if (oldAdmin is not null &&
            oldAdmin.Id !=
                projectManager.Id)
        {
            await MoveMembersToRoleAsync(
                context,
                oldAdmin.Id,
                projectManager.Id);


            await RemoveRoleAsync(
                context,
                oldAdmin);
        }


        /* =====================================================
           MEMBER
           ===================================================== */

        var member =
            await context.Roles
                .FirstOrDefaultAsync(
                    role =>
                        role.Name ==
                        SystemRoles.Member);


        if (member is null)
        {
            member =
                new Role
                {
                    Name =
                        SystemRoles.Member,

                    Description =
                        "View and execute assigned tasks",

                    IsSystemRole =
                        true
                };


            await context.Roles.AddAsync(
                member);
        }
        else
        {
            /*
             * Preserve dynamic permissions.
             */
            member.IsSystemRole =
                true;
        }


        await context.SaveChangesAsync();


        /*
         * Compatibility with very old Viewer role.
         */
        var viewer =
            await context.Roles
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


    /* =========================================================
       MOVE MEMBERS FROM LEGACY ROLE
       ========================================================= */

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


        foreach (
            var workspaceMember
            in workspaceMembers)
        {
            workspaceMember.RoleId =
                targetRoleId;

            workspaceMember.UpdatedAt =
                DateTime.UtcNow;
        }


        await context.SaveChangesAsync();
    }


    /* =========================================================
       REMOVE LEGACY ROLE
       ========================================================= */

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


        context.Roles.Remove(
            role);


        await context.SaveChangesAsync();
    }


    /* =========================================================
       PERMISSIONS
       ========================================================= */

    private static async Task SeedPermissionsAsync(
        ApplicationDbContext context)
    {
        var permissions =
            await context.Permissions
                .ToListAsync();


        /*
         * Compatibility rename:
         * task.update
         *      ↓
         * task.details.update
         */
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


        /*
         * These are the permission definitions supported
         * by the application.
         *
         * IMPORTANT:
         * This only ensures that the permission records exist.
         *
         * It does NOT decide which role receives them.
         */
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
            await context.Permissions
                .AddRangeAsync(
                    missingPermissions);
        }


        await context.SaveChangesAsync();
    }


    /* =========================================================
       DEFAULT ROLE PERMISSIONS
       ========================================================= */

    private static async Task SeedRolePermissionsAsync(
        ApplicationDbContext context)
    {
        /*
         * =====================================================
         * IMPORTANT DYNAMIC-PERMISSION RULE
         * =====================================================
         *
         * Default permissions are assigned ONLY when a system
         * role has never had RolePermission records before.
         *
         * Once initialized, the database becomes the source
         * of truth.
         *
         * This means SystemAdmin is free to:
         *
         * - grant permissions
         * - revoke permissions
         * - leave a role with zero permissions
         *
         * and restarting the API will NOT restore the defaults.
         *
         * Soft-deleted RolePermission records still count as
         * historical initialization. This is important because
         * a SystemAdmin may intentionally revoke every permission
         * from a role.
         * =====================================================
         */


        var roles =
            await context.Roles
                .Where(role =>
                    !role.IsDeleted &&
                    (
                        role.Name ==
                            SystemRoles.WorkspaceOwner ||

                        role.Name ==
                            SystemRoles.ProjectManager ||

                        role.Name ==
                            SystemRoles.Member
                    ))
                .ToListAsync();


        var workspaceOwner =
            roles.FirstOrDefault(
                role =>
                    role.Name ==
                    SystemRoles.WorkspaceOwner);


        var projectManager =
            roles.FirstOrDefault(
                role =>
                    role.Name ==
                    SystemRoles.ProjectManager);


        var member =
            roles.FirstOrDefault(
                role =>
                    role.Name ==
                    SystemRoles.Member);


        if (workspaceOwner is null ||
            projectManager is null ||
            member is null)
        {
            throw new InvalidOperationException(
                "One or more required system roles were not found.");
        }


        var permissions =
            await context.Permissions
                .Where(permission =>
                    !permission.IsDeleted)
                .ToListAsync();


        var permissionByName =
            permissions.ToDictionary(
                permission =>
                    permission.Name,

                StringComparer.OrdinalIgnoreCase);


        /*
         * Default permissions are ONLY bootstrap values.
         * They are NOT enforced after initialization.
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


        var memberPermissionNames =
            new[]
            {
                SystemPermissions.ProjectView,

                SystemPermissions.TaskView,
                SystemPermissions.TaskStatusUpdate,
                SystemPermissions.TaskComment,
                SystemPermissions.TaskAttachmentUpload
            };


        await SeedRoleDefaultsOnlyIfNeverInitializedAsync(
            context,
            workspaceOwner.Id,
            workspaceOwnerPermissionNames,
            permissionByName);


        await SeedRoleDefaultsOnlyIfNeverInitializedAsync(
            context,
            projectManager.Id,
            projectManagerPermissionNames,
            permissionByName);


        await SeedRoleDefaultsOnlyIfNeverInitializedAsync(
            context,
            member.Id,
            memberPermissionNames,
            permissionByName);


        await context.SaveChangesAsync();
    }


    /* =========================================================
       INITIALIZE ROLE DEFAULTS ONCE
       ========================================================= */

    private static async Task
        SeedRoleDefaultsOnlyIfNeverInitializedAsync(
            ApplicationDbContext context,
            int roleId,
            IEnumerable<string> defaultPermissionNames,
            IReadOnlyDictionary<string, Permission>
                permissionByName)
    {
        /*
         * IMPORTANT:
         *
         * We intentionally do NOT filter IsDeleted here.
         *
         * Even a soft-deleted RolePermission proves that this
         * role has already been initialized and subsequently
         * customized by an administrator.
         */
        var roleHasEverBeenInitialized =
            await context.RolePermissions
                .AnyAsync(rolePermission =>
                    rolePermission.RoleId ==
                    roleId);


        if (roleHasEverBeenInitialized)
        {
            return;
        }


        var now =
            DateTime.UtcNow;


        var rolePermissions =
            new List<RolePermission>();


        foreach (
            var permissionName
            in defaultPermissionNames)
        {
            if (!permissionByName.TryGetValue(
                    permissionName,
                    out var permission))
            {
                throw new InvalidOperationException(
                    $"Permission '{permissionName}' was not found.");
            }


            rolePermissions.Add(
                new RolePermission
                {
                    RoleId =
                        roleId,

                    PermissionId =
                        permission.Id,

                    CreatedAt =
                        now
                });
        }


        if (rolePermissions.Count > 0)
        {
            await context.RolePermissions
                .AddRangeAsync(
                    rolePermissions);
        }
    }
}