using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Infrastructure.Identity;

public sealed class AdminUserProvisioningService
    : IAdminUserProvisioningService
{
    private readonly UserManager<User>
        _userManager;

    private readonly IApplicationDbContext
        _dbContext;

    private readonly ICurrentUserService
        _currentUserService;


    public AdminUserProvisioningService(
        UserManager<User> userManager,
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService)
    {
        _userManager =
            userManager;

        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;
    }


    public async Task<AdminUserResponse>
        CreateUserAsync(
            CreateAdminUserRequest request)
    {
        await EnsureSystemAdminAsync();


        var fullName =
            request.FullName.Trim();


        var email =
            request.Email.Trim()
                .ToLowerInvariant();


        var existingUser =
            await _userManager
                .FindByEmailAsync(
                    email);


        if (existingUser is not null)
        {
            throw new ConflictException(
                "Email is already registered.");
        }


        var now =
            DateTime.UtcNow;


        var user =
            new User
            {
                FullName =
                    fullName,

                Email =
                    email,

                UserName =
                    email,

                IsActive =
                    request.IsActive,

                IsSystemAdmin =
                    false,

                TokenVersion =
                    1,

                CreatedAt =
                    now
            };


        var result =
            await _userManager
                .CreateAsync(
                    user,
                    request.Password);


        if (!result.Succeeded)
        {
            var errors =
                string.Join(
                    " | ",
                    result.Errors
                        .Select(
                            error =>
                                error.Description));


            throw new BadRequestException(
                errors);
        }


        return new AdminUserResponse
        {
            Id =
                user.Id,

            UserName =
                user.UserName
                ?? string.Empty,

            FullName =
                user.FullName,

            Email =
                user.Email
                ?? string.Empty,

            IsActive =
                user.IsActive,

            IsSystemAdmin =
                user.IsSystemAdmin,

            CreatedAt =
                user.CreatedAt,

            LastLoginAt =
                user.LastLoginAt
        };
    }


    private async Task
        EnsureSystemAdminAsync()
    {
        if (!_currentUserService.IsAuthenticated)
        {
            throw new ForbiddenException(
                "Authentication is required.");
        }


        var currentUser =
            await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    user =>
                        user.Id ==
                            _currentUserService.UserId &&
                        user.IsActive &&
                        !user.IsDeleted);


        if (
            currentUser is null ||
            !currentUser.IsSystemAdmin
        )
        {
            throw new ForbiddenException(
                "Only the system administrator can access this resource.");
        }
    }
}