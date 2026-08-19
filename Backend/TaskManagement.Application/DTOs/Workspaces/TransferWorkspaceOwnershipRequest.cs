using System.ComponentModel.DataAnnotations;

namespace TaskManagement.Application.DTOs.Workspaces;

public sealed class TransferWorkspaceOwnershipRequest
{
    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "NewOwnerUserId must be greater than zero.")]
    public int NewOwnerUserId { get; set; }
}