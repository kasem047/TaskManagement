namespace TaskManagement.Application.DTOs.Notifications;

public sealed class NotificationRecipientResponse
{
    public int UserId { get; set; }

    public string FullName { get; set; } =
        string.Empty;

    public string Email { get; set; } =
        string.Empty;

    public int? WorkspaceId { get; set; }

    public string? WorkspaceName { get; set; }

    public string? RoleName { get; set; }

    public string Relationship { get; set; } =
        string.Empty;
}