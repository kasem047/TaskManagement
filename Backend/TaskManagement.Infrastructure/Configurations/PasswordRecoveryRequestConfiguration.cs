using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Configurations;

public sealed class PasswordRecoveryRequestConfiguration
    : IEntityTypeConfiguration<PasswordRecoveryRequest>
{
    public void Configure(
        EntityTypeBuilder<PasswordRecoveryRequest> builder)
    {
        builder.ToTable(
            "PasswordRecoveryRequests");


        builder.HasKey(request =>
            request.Id);


        builder.Property(request =>
                request.AccountEmail)
            .IsRequired()
            .HasMaxLength(256);


        builder.Property(request =>
                request.RecoveryEmail)
            .IsRequired()
            .HasMaxLength(256);


        builder.Property(request =>
                request.Reason)
            .IsRequired()
            .HasMaxLength(1000);


        builder.Property(request =>
                request.PublicToken)
            .IsRequired()
            .HasMaxLength(128);


        builder.Property(request =>
                request.AdminDecisionReason)
            .HasMaxLength(1000);


        builder.Property(request =>
                request.CodeHash)
            .HasMaxLength(256);


        builder.Property(request =>
                request.ResetTokenHash)
            .HasMaxLength(256);


        builder.HasOne(request =>
                request.User)
            .WithMany(user =>
                user.PasswordRecoveryRequests)
            .HasForeignKey(request =>
                request.UserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        builder.HasOne(request =>
                request.ReviewedByAdminUser)
            .WithMany()
            .HasForeignKey(request =>
                request.ReviewedByAdminUserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        builder.HasOne(request =>
                request.CodeSentByAdminUser)
            .WithMany()
            .HasForeignKey(request =>
                request.CodeSentByAdminUserId)
            .OnDelete(
                DeleteBehavior.Restrict);


        builder.HasIndex(request =>
                request.PublicToken)
            .IsUnique();


        builder.HasIndex(request =>
            new
            {
                request.UserId,
                request.Status
            });


        builder.HasIndex(request =>
            new
            {
                request.Status,
                request.CreatedAt
            });
    }
}