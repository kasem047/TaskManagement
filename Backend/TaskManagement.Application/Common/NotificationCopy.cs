using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Common;

internal static class NotificationCopy
{
    public static string Role(
        string? roleName)
    {
        return roleName switch
        {
            "WorkspaceOwner" or "Owner" =>
                "مالك مساحة العمل",
            "ProjectManager" =>
                "مدير مشروع",
            "Member" =>
                "عضو",
            _ =>
                roleName ?? "—"
        };
    }

    public static string Status(
        string? statusName)
    {
        return statusName switch
        {
            "Todo" =>
                "للعمل",
            "InProgress" =>
                "قيد التنفيذ",
            "PartiallyCompleted" or "InReview" =>
                "جزئيًا",
            "Done" =>
                "مكتملة",
            "Cancelled" =>
                "ملغاة",
            _ =>
                statusName ?? "—"
        };
    }

    public static string Priority(
        TaskPriority priority)
    {
        return priority switch
        {
            TaskPriority.Low =>
                "منخفضة",
            TaskPriority.Medium =>
                "متوسطة",
            TaskPriority.High =>
                "عالية",
            TaskPriority.Critical =>
                "حرجة",
            _ =>
                priority.ToString()
        };
    }
}
