using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class NotificationConfiguration
    : IEntityTypeConfiguration<Notification>
{
    public void Configure(
        EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");

        builder.HasKey(notification =>
            notification.Id);

        builder.Property(notification =>
                notification.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(notification =>
                notification.Message)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(notification =>
                notification.Type)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(notification =>
                notification.EntityName)
            .HasMaxLength(150);

        builder.HasOne(notification =>
                notification.User)
            .WithMany()
            .HasForeignKey(notification =>
                notification.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(notification =>
                notification.ActorUser)
            .WithMany()
            .HasForeignKey(notification =>
                notification.ActorUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(notification =>
                notification.Workspace)
            .WithMany()
            .HasForeignKey(notification =>
                notification.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(notification =>
            notification.UserId);

        builder.HasIndex(notification =>
            notification.ActorUserId);

        builder.HasIndex(notification =>
            new
            {
                notification.UserId,
                notification.IsRead,
                notification.CreatedAt
            });

        builder.HasIndex(notification =>
            new
            {
                notification.EntityName,
                notification.EntityId
            });
    }
}