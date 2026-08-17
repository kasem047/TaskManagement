using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountPasswordRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PasswordRecoveryRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    AccountEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    RecoveryEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    PublicToken = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    RequestExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReviewedByAdminUserId = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AdminDecisionReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CodeSentByAdminUserId = table.Column<int>(type: "int", nullable: true),
                    CodeHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    CodeSentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CodeExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CodeAttemptCount = table.Column<int>(type: "int", nullable: false),
                    CodeVerifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResetTokenHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ResetTokenExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PasswordResetAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordRecoveryRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordRecoveryRequests_AspNetUsers_CodeSentByAdminUserId",
                        column: x => x.CodeSentByAdminUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PasswordRecoveryRequests_AspNetUsers_ReviewedByAdminUserId",
                        column: x => x.ReviewedByAdminUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PasswordRecoveryRequests_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryRequests_CodeSentByAdminUserId",
                table: "PasswordRecoveryRequests",
                column: "CodeSentByAdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryRequests_PublicToken",
                table: "PasswordRecoveryRequests",
                column: "PublicToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryRequests_ReviewedByAdminUserId",
                table: "PasswordRecoveryRequests",
                column: "ReviewedByAdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryRequests_Status_CreatedAt",
                table: "PasswordRecoveryRequests",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryRequests_UserId_Status",
                table: "PasswordRecoveryRequests",
                columns: new[] { "UserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PasswordRecoveryRequests");
        }
    }
}
