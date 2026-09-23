namespace TaskManagement.Application.DTOs.TaskAssignees;

public sealed class AssignableMemberResponse
{
    public int UserId { get; set; }

    public string FullName { get; set; } =
        string.Empty;

    public string Email { get; set; } =
        string.Empty;

    public string RoleName { get; set; } =
        string.Empty;
}
