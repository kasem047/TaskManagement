using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class ActivityLogConfiguration
    : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(
        EntityTypeBuilder<ActivityLog> builder)
    {
        builder.ToTable("ActivityLogs");

        builder.HasKey(activityLog =>
            activityLog.Id);

        builder.Property(activityLog =>
                activityLog.Action)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(activityLog =>
                activityLog.EntityName)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(activityLog =>
                activityLog.Description)
            .HasMaxLength(1000);

        builder.HasOne(activityLog =>
                activityLog.User)
            .WithMany(user =>
                user.ActivityLogs)
            .HasForeignKey(activityLog =>
                activityLog.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(activityLog =>
                activityLog.Workspace)
            .WithMany(workspace =>
                workspace.ActivityLogs)
            .HasForeignKey(activityLog =>
                activityLog.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(activityLog =>
            activityLog.WorkspaceId);

        builder.HasIndex(activityLog =>
            new
            {
                activityLog.WorkspaceId,
                activityLog.CreatedAt
            });

        builder.HasIndex(activityLog =>
            new
            {
                activityLog.EntityName,
                activityLog.EntityId
            });
    }
}