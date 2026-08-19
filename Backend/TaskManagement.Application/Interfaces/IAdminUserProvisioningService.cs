using TaskManagement.Application.DTOs.Admin;

namespace TaskManagement.Application.Interfaces;

public interface IAdminUserProvisioningService
{
    Task<AdminUserResponse> CreateUserAsync(
        CreateAdminUserRequest request);
}