namespace TaskManagement.Application.DTOs.ActivityLogs;

public sealed class ActivityLogResponse
{
    public int Id { get; set; }

    public int WorkspaceId { get; set; }

     // الشخص الذي قام بالفعل.
 
    public int UserId { get; set; }

    public string UserFullName { get; set; } =
        string.Empty;

    public string Action { get; set; } =
        string.Empty;

    public string EntityName { get; set; } =
        string.Empty;

    public int EntityId { get; set; }

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }

    /*
     * تستخدم في أحداث الإسناد.
     *
     * UserFullName = من قام بالإسناد.
     * TargetUserFullName = الشخص الذي
     * أُسندت إليه المهمة أو أزيل منها.
     */
    public int? TargetUserId { get; set; }

    public string? TargetUserFullName { get; set; }
}