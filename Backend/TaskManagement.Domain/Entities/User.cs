using Microsoft.AspNetCore.Identity;

namespace TaskManagement.Domain.Entities;

public class User : IdentityUser<int>
{
    public string FullName { get; set; } =
        string.Empty;

    public bool IsActive { get; set; } =
        true;

    public bool IsSystemAdmin { get; set; } =
        false;

    public int TokenVersion { get; set; } =
        1;

    public DateTime CreatedAt { get; set; } =
        DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public bool IsDeleted { get; set; } =
        false;

    public DateTime? DeletedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }


    public ICollection<Workspace> CreatedWorkspaces { get; set; } =
        new List<Workspace>();

    public ICollection<WorkspaceMember> WorkspaceMembers { get; set; } =
        new List<WorkspaceMember>();

    public ICollection<ProjectMember> ProjectMembers { get; set; } =
        new List<ProjectMember>();

    public ICollection<TaskItem> CreatedTasks { get; set; } =
        new List<TaskItem>();

    public ICollection<TaskAssignee> TaskAssignees { get; set; } =
        new List<TaskAssignee>();

    public ICollection<TaskComment> TaskComments { get; set; } =
        new List<TaskComment>();

    public ICollection<TaskAttachment> TaskAttachments { get; set; } =
        new List<TaskAttachment>();

    public ICollection<ActivityLog> ActivityLogs { get; set; } =
        new List<ActivityLog>();

    public ICollection<UserSession> UserSessions { get; set; } =
        new List<UserSession>();

    public ICollection<PasswordRecoveryRequest>
        PasswordRecoveryRequests
    { get; set; } =
            new List<PasswordRecoveryRequest>();
}