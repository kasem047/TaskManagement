using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class TaskAssigneeConfiguration
    : IEntityTypeConfiguration<TaskAssignee>
{
    public void Configure(
        EntityTypeBuilder<TaskAssignee> builder)
    {
        builder.ToTable("TaskAssignees");

        builder.HasKey(taskAssignee =>
            taskAssignee.Id);

        builder.HasOne(taskAssignee =>
                taskAssignee.TaskItem)
            .WithMany(task =>
                task.TaskAssignees)
            .HasForeignKey(taskAssignee =>
                taskAssignee.TaskItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(taskAssignee =>
                taskAssignee.User)
            .WithMany(user =>
                user.TaskAssignees)
            .HasForeignKey(taskAssignee =>
                taskAssignee.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(taskAssignee =>
                new
                {
                    taskAssignee.TaskItemId,
                    taskAssignee.UserId
                })
            .IsUnique();

        builder.HasIndex(taskAssignee =>
            taskAssignee.UserId);
    }
}