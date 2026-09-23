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

    public DbSet<WorkspaceInvitation> WorkspaceInvitations { get; set; }

    public DbSet<Project> Projects { get; set; }

    public DbSet<ProjectMember> ProjectMembers { get; set; }

    public DbSet<TaskItem> TaskItems { get; set; }

    public DbSet<TaskAssignee> TaskAssignees { get; set; }

    public DbSet<TaskDependency> TaskDependencies { get; set; }

    public DbSet<TaskComment> TaskComments { get; set; }

    public DbSet<TaskAttachment> TaskAttachments { get; set; }

    public DbSet<ActivityLog> ActivityLogs { get; set; }

    public DbSet<Notification> Notifications { get; set; }

    public DbSet<TaskReminder> TaskReminders { get; set; }

    public DbSet<Role> Roles { get; set; }

    public DbSet<Permission> Permissions { get; set; }

    public DbSet<RolePermission> RolePermissions { get; set; }

    public DbSet<UserPermissionOverride>
        UserPermissionOverrides
    {
        get;
        set;
    }

    public DbSet<UserSession> UserSessions { get; set; }

    public DbSet<PasswordRecoveryRequest>
        PasswordRecoveryRequests
    {
        get;
        set;
    }


    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(
            modelBuilder);


        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly);


        /* =====================================================
           USER
           ===================================================== */

        modelBuilder.Entity<User>()
            .HasIndex(user =>
                user.Email)
            .IsUnique();


        modelBuilder.Entity<User>()
            .Property(user =>
                user.FullName)
            .HasMaxLength(150)
            .IsRequired();


        modelBuilder.Entity<User>()
            .Property(user =>
                user.Email)
            .HasMaxLength(200)
            .IsRequired();


        modelBuilder.Entity<User>()
            .Property(user =>
                user.PasswordHash)
            .HasMaxLength(500);


        /* =====================================================
           USER SESSION
           ===================================================== */

        modelBuilder.Entity<UserSession>()
            .Property(session =>
                session.SessionToken)
            .HasMaxLength(200)
            .IsRequired();


        modelBuilder.Entity<UserSession>()
            .Property(session =>
                session.DeviceId)
            .HasMaxLength(200)
            .IsRequired();


        modelBuilder.Entity<UserSession>()
            .Property(session =>
                session.DeviceName)
            .HasMaxLength(200);


        modelBuilder.Entity<UserSession>()
            .Property(session =>
                session.IpAddress)
            .HasMaxLength(100);


        modelBuilder.Entity<UserSession>()
            .Property(session =>
                session.UserAgent)
            .HasMaxLength(500);


        modelBuilder.Entity<UserSession>()
            .HasIndex(session =>
                session.SessionToken)
            .IsUnique();


        modelBuilder.Entity<UserSession>()
            .HasIndex(session =>
                new
                {
                    session.UserId,
                    session.DeviceId
                });


        modelBuilder.Entity<UserSession>()
            .HasOne(session =>
                session.User)
            .WithMany(user =>
                user.UserSessions)
            .HasForeignKey(session =>
                session.UserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        /* =====================================================
           ROLE
           ===================================================== */

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


        /* =====================================================
           PERMISSION
           ===================================================== */

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


        /* =====================================================
           ROLE PERMISSION
           ===================================================== */

        modelBuilder.Entity<RolePermission>()
            .HasOne(rolePermission =>
                rolePermission.Role)
            .WithMany(role =>
                role.RolePermissions)
            .HasForeignKey(rolePermission =>
                rolePermission.RoleId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<RolePermission>()
            .HasOne(rolePermission =>
                rolePermission.Permission)
            .WithMany(permission =>
                permission.RolePermissions)
            .HasForeignKey(rolePermission =>
                rolePermission.PermissionId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<RolePermission>()
            .HasIndex(rolePermission =>
                new
                {
                    rolePermission.RoleId,
                    rolePermission.PermissionId
                })
            .IsUnique();


        /* =====================================================
           WORKSPACE
           ===================================================== */

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
            .OnDelete(
                DeleteBehavior.Restrict);


        /* =====================================================
           WORKSPACE MEMBER
           ===================================================== */

        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(member =>
                member.Workspace)
            .WithMany(workspace =>
                workspace.WorkspaceMembers)
            .HasForeignKey(member =>
                member.WorkspaceId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(member =>
                member.User)
            .WithMany(user =>
                user.WorkspaceMembers)
            .HasForeignKey(member =>
                member.UserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(member =>
                member.Role)
            .WithMany(role =>
                role.WorkspaceMembers)
            .HasForeignKey(member =>
                member.RoleId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<WorkspaceMember>()
            .HasIndex(member =>
                new
                {
                    member.WorkspaceId,
                    member.UserId
                })
            .IsUnique();


        /* =====================================================
           WORKSPACE INVITATION
           ===================================================== */

        modelBuilder.Entity<WorkspaceInvitation>()
            .HasOne(invitation =>
                invitation.Workspace)
            .WithMany()
            .HasForeignKey(invitation =>
                invitation.WorkspaceId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<WorkspaceInvitation>()
            .HasOne(invitation =>
                invitation.InvitedUser)
            .WithMany()
            .HasForeignKey(invitation =>
                invitation.InvitedUserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<WorkspaceInvitation>()
            .HasOne(invitation =>
                invitation.InvitedByUser)
            .WithMany()
            .HasForeignKey(invitation =>
                invitation.InvitedByUserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<WorkspaceInvitation>()
            .HasOne(invitation =>
                invitation.Role)
            .WithMany()
            .HasForeignKey(invitation =>
                invitation.RoleId)
            .OnDelete(
                DeleteBehavior.Restrict);


        /*
         * هذه ليست Unique عمدًا.
         *
         * لأن المستخدم يمكن أن يُدعى لنفس مساحة العمل
         * في وقت لاحق بعد رفض/إلغاء دعوة قديمة.
         *
         * الخدمة نفسها تمنع وجود أكثر من Pending invitation
         * في الوقت نفسه.
         */
        modelBuilder.Entity<WorkspaceInvitation>()
            .HasIndex(invitation =>
                new
                {
                    invitation.WorkspaceId,
                    invitation.InvitedUserId,
                    invitation.Status
                });


        modelBuilder.Entity<WorkspaceInvitation>()
            .HasIndex(invitation =>
                new
                {
                    invitation.InvitedUserId,
                    invitation.Status,
                    invitation.CreatedAt
                });


        /* =====================================================
           USER PERMISSION OVERRIDE
           ===================================================== */

        modelBuilder.Entity<UserPermissionOverride>()
            .Property(item =>
                item.Reason)
            .HasMaxLength(500);


        modelBuilder.Entity<UserPermissionOverride>()
            .HasOne(item =>
                item.Workspace)
            .WithMany()
            .HasForeignKey(item =>
                item.WorkspaceId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<UserPermissionOverride>()
            .HasOne(item =>
                item.Permission)
            .WithMany(permission =>
                permission.UserPermissionOverrides)
            .HasForeignKey(item =>
                item.PermissionId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<UserPermissionOverride>()
            .HasIndex(item =>
                new
                {
                    item.WorkspaceId,
                    item.UserId,
                    item.PermissionId
                })
            .IsUnique();


        /* =====================================================
           TASK DEPENDENCY
           ===================================================== */

        modelBuilder.Entity<TaskDependency>()
            .HasOne(dependency =>
                dependency.TaskItem)
            .WithMany(task =>
                task.Dependencies)
            .HasForeignKey(dependency =>
                dependency.TaskItemId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<TaskDependency>()
            .HasOne(dependency =>
                dependency.DependsOnTaskItem)
            .WithMany(task =>
                task.DependentTasks)
            .HasForeignKey(dependency =>
                dependency.DependsOnTaskItemId)
            .OnDelete(
                DeleteBehavior.Restrict);


        modelBuilder.Entity<TaskDependency>()
            .HasIndex(dependency =>
                new
                {
                    dependency.TaskItemId,
                    dependency.DependsOnTaskItemId
                })
            .IsUnique();
    }
}