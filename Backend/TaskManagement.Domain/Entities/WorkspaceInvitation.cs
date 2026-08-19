using TaskManagement.Domain.Common;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Domain.Entities;

public sealed class WorkspaceInvitation
    : BaseEntity
{
    public int WorkspaceId { get; set; }

    public Workspace Workspace { get; set; } =
        null!;


    public int InvitedUserId { get; set; }

    public User InvitedUser { get; set; } =
        null!;


    public int InvitedByUserId { get; set; }

    public User InvitedByUser { get; set; } =
        null!;


    public int RoleId { get; set; }

    public Role Role { get; set; } =
        null!;


    public WorkspaceInvitationStatus Status { get; set; } =
        WorkspaceInvitationStatus.Pending;


    public DateTime? RespondedAt { get; set; }
}