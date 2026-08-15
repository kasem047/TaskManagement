using System.ComponentModel.DataAnnotations;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.DTOs.Tasks;

public sealed class UpdateTaskStatusRequest
{
    [EnumDataType(
        typeof(TaskItemStatus),
        ErrorMessage = "Invalid task status.")]
    public TaskItemStatus Status { get; set; }

    [Range(
        0,
        double.MaxValue,
        ErrorMessage = "Position must be zero or greater.")]
    public double Position { get; set; }
}