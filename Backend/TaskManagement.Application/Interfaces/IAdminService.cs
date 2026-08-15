using TaskManagement.Application.DTOs.Admin;

namespace TaskManagement.Application.Interfaces;

public interface IAdminService
{
    Task<AdminDashboardResponse> GetDashboardAsync();

    Task<List<AdminUserResponse>> GetUsersAsync(
        string? search = null,
        bool? isActive = null);

    Task<AdminUserResponse> GetUserByIdAsync(
        int userId);

    Task<AdminUserResponse> SetUserActiveStatusAsync(
        int userId,
        SetUserActiveStatusRequest request);
}