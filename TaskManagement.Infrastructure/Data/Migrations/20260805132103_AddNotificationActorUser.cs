using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationActorUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ActorUserId",
                table: "Notifications",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ActorUserId",
                table: "Notifications",
                column: "ActorUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_AspNetUsers_ActorUserId",
                table: "Notifications",
                column: "ActorUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_AspNetUsers_ActorUserId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_ActorUserId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ActorUserId",
                table: "Notifications");
        }
    }
}
