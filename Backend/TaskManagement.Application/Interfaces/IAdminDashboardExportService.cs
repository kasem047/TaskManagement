using TaskManagement.Application.DTOs.Admin;

namespace TaskManagement.Application.Interfaces;

public interface IAdminDashboardExportService
{
    byte[] ExportToExcel(
        AdminDashboardResponse dashboard);

    byte[] ExportToPdf(
        AdminDashboardResponse dashboard);
}