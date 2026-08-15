using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }

    DbSet<Workspace> Workspaces { get; }

    DbSet<WorkspaceMember> WorkspaceMembers { get; }

    DbSet<Project> Projects { get; }

    DbSet<TaskItem> TaskItems { get; }

    DbSet<TaskAssignee> TaskAssignees { get; }

    DbSet<TaskComment> TaskComments { get; }

    DbSet<TaskAttachment> TaskAttachments { get; }

    DbSet<ActivityLog> ActivityLogs { get; }

    DbSet<Notification> Notifications { get; }

    DbSet<TaskReminder> TaskReminders { get; }

    DbSet<Role> Roles { get; }

    DbSet<Permission> Permissions { get; }

    DbSet<RolePermission> RolePermissions { get; }

    DbSet<UserPermissionOverride> UserPermissionOverrides { get; }

    DbSet<UserSession> UserSessions { get; }

    Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default);
}