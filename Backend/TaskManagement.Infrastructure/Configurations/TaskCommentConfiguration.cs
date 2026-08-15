using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class TaskCommentConfiguration
    : IEntityTypeConfiguration<TaskComment>
{
    public void Configure(
        EntityTypeBuilder<TaskComment> builder)
    {
        builder.ToTable("TaskComments");

        builder.HasKey(comment =>
            comment.Id);

        builder.Property(comment =>
                comment.Content)
            .IsRequired()
            .HasMaxLength(1000);

        builder.HasOne(comment =>
                comment.TaskItem)
            .WithMany(task =>
                task.TaskComments)
            .HasForeignKey(comment =>
                comment.TaskItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(comment =>
                comment.User)
            .WithMany(user =>
                user.TaskComments)
            .HasForeignKey(comment =>
                comment.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(comment =>
            comment.TaskItemId);

        builder.HasIndex(comment =>
            new
            {
                comment.TaskItemId,
                comment.CreatedAt
            });
    }
}