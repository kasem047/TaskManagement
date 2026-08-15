using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class TaskItemConfiguration
    : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(
        EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("TaskItems");

        builder.HasKey(task => task.Id);

        builder.Property(task => task.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(task => task.Description)
            .HasMaxLength(1000);

        builder.Property(task => task.Status)
            .IsRequired();

        builder.Property(task => task.Priority)
            .IsRequired();

        builder.Property(task => task.Position)
            .HasDefaultValue(0);

        builder.HasOne(task => task.Project)
            .WithMany(project => project.Tasks)
            .HasForeignKey(task => task.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(task => task.CreatedByUser)
            .WithMany(user => user.CreatedTasks)
            .HasForeignKey(task => task.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(task => task.ProjectId);

        builder.HasIndex(task => new
        {
            task.ProjectId,
            task.Status,
            task.Position
        });
    }
}