using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Data.Configurations;

public sealed class TaskReminderConfiguration
    : IEntityTypeConfiguration<TaskReminder>
{
    public void Configure(
        EntityTypeBuilder<TaskReminder> builder)
    {
        builder.ToTable("TaskReminders");

        builder.HasKey(reminder =>
            reminder.Id);

        builder.HasOne(reminder =>
                reminder.TaskItem)
            .WithMany()
            .HasForeignKey(reminder =>
                reminder.TaskItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(reminder =>
            new
            {
                reminder.TaskItemId,
                reminder.Type,
                reminder.DueDateSnapshot
            })
            .IsUnique();

        builder.HasIndex(reminder =>
            reminder.SentAt);
    }
}