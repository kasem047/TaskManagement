using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.WorkspaceInvitations;

public sealed class CreateWorkspaceInvitationRequest
{
    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "UserId must be greater than zero.")]
    public int UserId { get; set; }


    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "RoleId must be greater than zero.")]
    public int RoleId { get; set; }
}