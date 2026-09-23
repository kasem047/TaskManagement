using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class ProjectMemberConfiguration
    : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(
        EntityTypeBuilder<ProjectMember> builder)
    {
        builder.ToTable("ProjectMembers");

        builder.HasKey(member =>
            member.Id);

        builder.HasOne(member =>
                member.Project)
            .WithMany(project =>
                project.Members)
            .HasForeignKey(member =>
                member.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(member =>
                member.User)
            .WithMany(user =>
                user.ProjectMembers)
            .HasForeignKey(member =>
                member.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(member =>
            member.ProjectId);

        builder.HasIndex(member =>
            member.UserId);

        builder.HasIndex(member => new
            {
                member.ProjectId,
                member.UserId
            })
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");
    }
}
