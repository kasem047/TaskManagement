using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectManagerUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ManagerUserId",
                table: "Projects",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Projects_ManagerUserId",
                table: "Projects",
                column: "ManagerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_AspNetUsers_ManagerUserId",
                table: "Projects",
                column: "ManagerUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_AspNetUsers_ManagerUserId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Projects_ManagerUserId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ManagerUserId",
                table: "Projects");
        }
    }
}
