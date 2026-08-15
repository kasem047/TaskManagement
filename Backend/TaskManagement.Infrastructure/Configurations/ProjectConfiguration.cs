using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class ProjectConfiguration
    : IEntityTypeConfiguration<Project>
{
    public void Configure(
        EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("Projects");

        builder.HasKey(project =>
            project.Id);

        builder.Property(project =>
                project.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(project =>
                project.Description)
            .HasMaxLength(1000);

        builder.Property(project =>
                project.IsArchived)
            .HasDefaultValue(false);

        builder.HasOne(project =>
                project.Workspace)
            .WithMany(workspace =>
                workspace.Projects)
            .HasForeignKey(project =>
                project.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(project =>
                project.ManagerUser)
            .WithMany()
            .HasForeignKey(project =>
                project.ManagerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(project =>
            project.WorkspaceId);

        builder.HasIndex(project =>
            project.ManagerUserId);

        builder.HasIndex(project =>
            new
            {
                project.WorkspaceId,
                project.Name
            });
    }
}