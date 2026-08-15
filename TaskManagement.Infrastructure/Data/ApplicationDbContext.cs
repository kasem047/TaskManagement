using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Data;

public class ApplicationDbContext :
    IdentityUserContext<User, int>,
    IApplicationDbContext
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Workspace> Workspaces { get; set; }

    public DbSet<WorkspaceMember> WorkspaceMembers { get; set; }

    public DbSet<Project> Projects { get; set; }

    public DbSet<TaskItem> TaskItems { get; set; }

    public DbSet<TaskAssignee> TaskAssignees { get; set; }

    public DbSet<TaskComment> TaskComments { get; set; }

    public DbSet<TaskAttachment> TaskAttachments { get; set; }

    public DbSet<ActivityLog> ActivityLogs { get; set; }

    public DbSet<Notification> Notifications { get; set; }

    public DbSet<TaskReminder> TaskReminders { get; set; }

    public DbSet<Role> Roles { get; set; }

    public DbSet<Permission> Permissions { get; set; }

    public DbSet<RolePermission> RolePermissions { get; set; }

    public DbSet<UserPermissionOverride> UserPermissionOverrides { get; set; }

    public DbSet<UserSession> UserSessions { get; set; }

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly);

        // User
        modelBuilder.Entity<User>()
            .HasIndex(user => user.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .Property(user => user.FullName)
            .HasMaxLength(150)
            .IsRequired();

        modelBuilder.Entity<User>()
            .Property(user => user.Email)
            .HasMaxLength(200)
            .IsRequired();

        modelBuilder.Entity<User>()
            .Property(user => user.PasswordHash)
            .HasMaxLength(500);

        // UserSession
        modelBuilder.Entity<UserSession>()
            .Property(userSession =>
                userSession.SessionToken)
            .HasMaxLength(200)
            .IsRequired();

        modelBuilder.Entity<UserSession>()
            .Property(userSession =>
                userSession.DeviceId)
            .HasMaxLength(200)
            .IsRequired();

        modelBuilder.Entity<UserSession>()
            .Property(userSession =>
                userSession.DeviceName)
            .HasMaxLength(200);

        modelBuilder.Entity<UserSession>()
            .Property(userSession =>
                userSession.IpAddress)
            .HasMaxLength(100);

        modelBuilder.Entity<UserSession>()
            .Property(userSession =>
                userSession.UserAgent)
            .HasMaxLength(500);

        modelBuilder.Entity<UserSession>()
            .HasIndex(userSession =>
                userSession.SessionToken)
            .IsUnique();

        modelBuilder.Entity<UserSession>()
            .HasIndex(userSession =>
                new
                {
                    userSession.UserId,
                    userSession.DeviceId
                });

        modelBuilder.Entity<UserSession>()
            .HasOne(userSession =>
                userSession.User)
            .WithMany(user =>
                user.UserSessions)
            .HasForeignKey(userSession =>
                userSession.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Role
        modelBuilder.Entity<Role>()
            .Property(role =>
                role.Name)
            .HasMaxLength(100)
            .IsRequired();

        modelBuilder.Entity<Role>()
            .Property(role =>
                role.Description)
            .HasMaxLength(500);

        modelBuilder.Entity<Role>()
            .HasIndex(role =>
                role.Name)
            .IsUnique();

        // Permission
        modelBuilder.Entity<Permission>()
            .Property(permission =>
                permission.Name)
            .HasMaxLength(150)
            .IsRequired();

        modelBuilder.Entity<Permission>()
            .Property(permission =>
                permission.Module)
            .HasMaxLength(100)
            .IsRequired();

        modelBuilder.Entity<Permission>()
            .Property(permission =>
                permission.Description)
            .HasMaxLength(500);

        modelBuilder.Entity<Permission>()
            .HasIndex(permission =>
                permission.Name)
            .IsUnique();

        // RolePermission
        modelBuilder.Entity<RolePermission>()
            .HasOne(rolePermission =>
                rolePermission.Role)
            .WithMany(role =>
                role.RolePermissions)
            .HasForeignKey(rolePermission =>
                rolePermission.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RolePermission>()
            .HasOne(rolePermission =>
                rolePermission.Permission)
            .WithMany(permission =>
                permission.RolePermissions)
            .HasForeignKey(rolePermission =>
                rolePermission.PermissionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RolePermission>()
            .HasIndex(rolePermission =>
                new
                {
                    rolePermission.RoleId,
                    rolePermission.PermissionId
                })
            .IsUnique();

        // Workspace
        modelBuilder.Entity<Workspace>()
            .Property(workspace =>
                workspace.Name)
            .HasMaxLength(150)
            .IsRequired();

        modelBuilder.Entity<Workspace>()
            .Property(workspace =>
                workspace.Description)
            .HasMaxLength(500);

        modelBuilder.Entity<Workspace>()
            .HasOne(workspace =>
                workspace.CreatedByUser)
            .WithMany(user =>
                user.CreatedWorkspaces)
            .HasForeignKey(workspace =>
                workspace.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // WorkspaceMember
        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(workspaceMember =>
                workspaceMember.Workspace)
            .WithMany(workspace =>
                workspace.WorkspaceMembers)
            .HasForeignKey(workspaceMember =>
                workspaceMember.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(workspaceMember =>
                workspaceMember.User)
            .WithMany(user =>
                user.WorkspaceMembers)
            .HasForeignKey(workspaceMember =>
                workspaceMember.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(workspaceMember =>
                workspaceMember.Role)
            .WithMany(role =>
                role.WorkspaceMembers)
            .HasForeignKey(workspaceMember =>
                workspaceMember.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkspaceMember>()
            .HasIndex(workspaceMember =>
                new
                {
                    workspaceMember.WorkspaceId,
                    workspaceMember.UserId
                })
            .IsUnique();

        // UserPermissionOverride
        modelBuilder.Entity<UserPermissionOverride>()
            .Property(userPermissionOverride =>
                userPermissionOverride.Reason)
            .HasMaxLength(500);

        modelBuilder.Entity<UserPermissionOverride>()
            .HasOne(userPermissionOverride =>
                userPermissionOverride.Workspace)
            .WithMany()
            .HasForeignKey(userPermissionOverride =>
                userPermissionOverride.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserPermissionOverride>()
            .HasOne(userPermissionOverride =>
                userPermissionOverride.Permission)
            .WithMany(permission =>
                permission.UserPermissionOverrides)
            .HasForeignKey(userPermissionOverride =>
                userPermissionOverride.PermissionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserPermissionOverride>()
            .HasIndex(userPermissionOverride =>
                new
                {
                    userPermissionOverride.WorkspaceId,
                    userPermissionOverride.UserId,
                    userPermissionOverride.PermissionId
                })
            .IsUnique();
    }
}