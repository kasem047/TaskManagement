namespace TaskManagement.Application.DTOs.Tasks;

public sealed class TaskResponse
{
    public int Id { get; set; }

    public int ProjectId { get; set; }

    public string Title { get; set; } =
        string.Empty;

    public string? Description { get; set; }

    public string Status { get; set; } =
        string.Empty;

    public string Priority { get; set; } =
        string.Empty;

    public DateTime? DueDate { get; set; }

    public double Position { get; set; }

    public int CreatedByUserId { get; set; }


    /* =========================================================
       PROGRESS
       ========================================================= */

    public int? ProgressPercentage { get; set; }

    public string? ProgressNote { get; set; }

    public DateTime? ProgressUpdatedAt { get; set; }


    /* =========================================================
       AUDIT
       ========================================================= */

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}