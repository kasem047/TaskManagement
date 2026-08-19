namespace TaskManagement.Application.DTOs.Tasks;

public sealed class TaskDependencyResponse
{
    public int TaskId { get; set; }

    public int DependsOnTaskId { get; set; }

    public string DependsOnTaskTitle { get; set; } =
        string.Empty;

    public string DependsOnTaskStatus { get; set; } =
        string.Empty;

    public bool IsSatisfied { get; set; }
}


public sealed class SetTaskDependenciesRequest
{
    public List<int> DependsOnTaskIds { get; set; } =
        new();
}