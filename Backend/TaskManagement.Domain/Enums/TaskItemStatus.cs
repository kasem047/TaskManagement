namespace TaskManagement.Domain.Enums;

public enum TaskItemStatus
{
    Todo = 1,
    InProgress = 2,
    PartiallyCompleted = 3,

    InReview = PartiallyCompleted,
    Done = 4,
    Cancelled = 5
}