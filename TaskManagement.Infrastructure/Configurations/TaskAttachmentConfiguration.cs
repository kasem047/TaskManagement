using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class TaskAttachmentConfiguration
    : IEntityTypeConfiguration<TaskAttachment>
{
    public void Configure(
        EntityTypeBuilder<TaskAttachment> builder)
    {
        builder.ToTable("TaskAttachments");

        builder.HasKey(attachment =>
            attachment.Id);

        builder.Property(attachment =>
                attachment.FileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(attachment =>
                attachment.FilePath)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(attachment =>
                attachment.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(attachment =>
                attachment.FileSize)
            .IsRequired();

        builder.HasOne(attachment =>
                attachment.TaskItem)
            .WithMany(task =>
                task.TaskAttachments)
            .HasForeignKey(attachment =>
                attachment.TaskItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(attachment =>
                attachment.User)
            .WithMany(user =>
                user.TaskAttachments)
            .HasForeignKey(attachment =>
                attachment.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(attachment =>
            attachment.TaskItemId);

        builder.HasIndex(attachment =>
            new
            {
                attachment.TaskItemId,
                attachment.CreatedAt
            });
    }
}