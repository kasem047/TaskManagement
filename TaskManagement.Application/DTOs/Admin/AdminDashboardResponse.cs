namespace TaskManagement.Application.DTOs.Admin;

public sealed class AdminDashboardResponse
{
    public int TotalUsers { get; set; }

    public int ActiveUsers { get; set; }

    public int InactiveUsers { get; set; }

    public int TotalWorkspaces { get; set; }

    public int TotalProjects { get; set; }

    public int ActiveProjects { get; set; }

    public int ArchivedProjects { get; set; }

    public int TotalTasks { get; set; }

    public int TodoTasks { get; set; }

    public int InProgressTasks { get; set; }

    public int InReviewTasks { get; set; }

    public int DoneTasks { get; set; }

    public int CancelledTasks { get; set; }
}