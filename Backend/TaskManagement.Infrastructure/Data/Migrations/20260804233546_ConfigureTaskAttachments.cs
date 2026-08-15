using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ConfigureTaskAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_TaskComments_TaskItemId_CreatedAt",
                table: "TaskComments",
                columns: new[] { "TaskItemId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskAttachments_TaskItemId_CreatedAt",
                table: "TaskAttachments",
                columns: new[] { "TaskItemId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TaskComments_TaskItemId_CreatedAt",
                table: "TaskComments");

            migrationBuilder.DropIndex(
                name: "IX_TaskAttachments_TaskItemId_CreatedAt",
                table: "TaskAttachments");
        }
    }
}
