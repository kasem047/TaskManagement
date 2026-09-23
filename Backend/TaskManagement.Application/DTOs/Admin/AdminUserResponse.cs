using System.Text.Json.Serialization;

namespace TaskManagement.Application.DTOs.Admin;

public sealed class AdminUserResponse
{
    public int Id { get; set; }

    public string UserName { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public bool IsSystemAdmin { get; set; }

    public bool OwnsWorkspace { get; set; }

    [JsonPropertyName("workspaceRole")]
    public string WorkspaceRole { get; set; } = "None";

    [JsonPropertyName("roleDescription")]
    public string RoleDescription { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }
}