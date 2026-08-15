using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.WorkspaceMembers;

public class UpdateWorkspaceMemberRoleRequest
{
    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "RoleId must be greater than zero.")]
    public int RoleId { get; set; }
}