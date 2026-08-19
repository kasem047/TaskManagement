using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/admin")]
public sealed class AdminController
    : ControllerBase
{
    private readonly IAdminService
        _adminService;

    private readonly IAdminDashboardExportService
        _adminDashboardExportService;

    private readonly IAdminUserProvisioningService
        _adminUserProvisioningService;


    public AdminController(
        IAdminService adminService,
        IAdminDashboardExportService adminDashboardExportService,
        IAdminUserProvisioningService adminUserProvisioningService)
    {
        _adminService =
            adminService;

        _adminDashboardExportService =
            adminDashboardExportService;

        _adminUserProvisioningService =
            adminUserProvisioningService;
    }


    /* =========================================================
       DASHBOARD
       ========================================================= */

    [HttpGet("dashboard")]
    public async Task<
        ActionResult<AdminDashboardResponse>>
        GetDashboard()
    {
        var dashboard =
            await _adminService
                .GetDashboardAsync();


        return Ok(
            dashboard);
    }


    [HttpGet("dashboard/export/excel")]
    public async Task<IActionResult>
        ExportDashboardToExcel()
    {
        var dashboard =
            await _adminService
                .GetDashboardAsync();


        var fileContent =
            _adminDashboardExportService
                .ExportToExcel(
                    dashboard);


        var timestamp =
            DateTime.UtcNow.ToString(
                "yyyyMMdd-HHmmss",
                CultureInfo.InvariantCulture);


        var fileName =
            $"task-management-dashboard-{timestamp}.xlsx";


        return File(
            fileContent,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }


    [HttpGet("dashboard/export/pdf")]
    public async Task<IActionResult>
        ExportDashboardToPdf()
    {
        var dashboard =
            await _adminService
                .GetDashboardAsync();


        var fileContent =
            _adminDashboardExportService
                .ExportToPdf(
                    dashboard);


        var timestamp =
            DateTime.UtcNow.ToString(
                "yyyyMMdd-HHmmss",
                CultureInfo.InvariantCulture);


        var fileName =
            $"task-management-dashboard-{timestamp}.pdf";


        return File(
            fileContent,
            "application/pdf",
            fileName);
    }


    /* =========================================================
       USERS
       ========================================================= */

    [HttpGet("users")]
    public async Task<
        ActionResult<List<AdminUserResponse>>>
        GetUsers(
            [FromQuery]
            string? search = null,

            [FromQuery]
            bool? isActive = null)
    {
        var users =
            await _adminService
                .GetUsersAsync(
                    search,
                    isActive);


        return Ok(
            users);
    }


    [HttpGet("users/{userId:int}")]
    public async Task<
        ActionResult<AdminUserResponse>>
        GetUserById(
            int userId)
    {
        var user =
            await _adminService
                .GetUserByIdAsync(
                    userId);


        return Ok(
            user);
    }


    [HttpPost("users")]
    public async Task<
        ActionResult<AdminUserResponse>>
        CreateUser(
            [FromBody]
            CreateAdminUserRequest request)
    {
        var user =
            await _adminUserProvisioningService
                .CreateUserAsync(
                    request);


        return CreatedAtAction(
            nameof(GetUserById),
            new
            {
                userId =
                    user.Id
            },
            user);
    }


    [HttpPatch(
        "users/{userId:int}/active-status")]
    public async Task<
        ActionResult<AdminUserResponse>>
        SetUserActiveStatus(
            int userId,

            [FromBody]
            SetUserActiveStatusRequest request)
    {
        var user =
            await _adminService
                .SetUserActiveStatusAsync(
                    userId,
                    request);


        return Ok(
            user);
    }
}