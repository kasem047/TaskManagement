using Microsoft.EntityFrameworkCore;
using Moq;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.WorkspaceMembers;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.Services;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.Tests.Services;

public sealed class WorkspaceMemberServiceTests
{
    [Fact]
    public async Task UpdateMemberRoleAsync_ProjectManagerChangesMemberRole_ThrowsForbiddenException()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        var projectManagerUser = new User
        {
            Id = 1,
            UserName = "manager@test.com",
            Email = "manager@test.com",
            FullName = "Project Manager",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var targetUser = new User
        {
            Id = 2,
            UserName = "member@test.com",
            Email = "member@test.com",
            FullName = "Workspace Member",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var projectManagerRole = new Role
        {
            Id = 1,
            Name = SystemRoles.ProjectManager,
            Description = "Project Manager",
            IsSystemRole = true,
            CreatedAt = now
        };

        var memberRole = new Role
        {
            Id = 2,
            Name = SystemRoles.Member,
            Description = "Workspace Member",
            IsSystemRole = true,
            CreatedAt = now
        };

        var workspace = new Workspace
        {
            Id = 1,
            Name = "Test Workspace",
            CreatedByUserId = projectManagerUser.Id,
            CreatedAt = now
        };

        var projectManagerMembership = new WorkspaceMember
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = projectManagerUser.Id,
            RoleId = projectManagerRole.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        var targetMembership = new WorkspaceMember
        {
            Id = 2,
            WorkspaceId = workspace.Id,
            UserId = targetUser.Id,
            RoleId = memberRole.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        dbContext.Users.AddRange(
            projectManagerUser,
            targetUser);

        dbContext.Roles.AddRange(
            projectManagerRole,
            memberRole);

        dbContext.Workspaces.Add(workspace);

        dbContext.WorkspaceMembers.AddRange(
            projectManagerMembership,
            targetMembership);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(projectManagerUser.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionServiceMock =
            new Mock<IPermissionService>();

        var activityLogServiceMock =
            new Mock<IActivityLogService>();

        activityLogServiceMock
            .Setup(service => service.LogAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var notificationServiceMock =
            new Mock<INotificationService>();

        var workspaceMemberService =
            new WorkspaceMemberService(
                dbContext,
                currentUserServiceMock.Object,
                permissionServiceMock.Object,
                activityLogServiceMock.Object,
                notificationServiceMock.Object);

        var request =
            new UpdateWorkspaceMemberRoleRequest
            {
                RoleId = projectManagerRole.Id
            };

        await Assert.ThrowsAsync<ForbiddenException>(
            () => workspaceMemberService.UpdateMemberRoleAsync(
                workspace.Id,
                targetMembership.Id,
                request));

        permissionServiceMock.Verify(
            service =>
                service.EnsurePermissionAsync(
                    It.IsAny<int>(),
                    It.IsAny<string>(),
                    It.IsAny<CancellationToken>()),
            Times.Never);

        activityLogServiceMock.Verify(
            service => service.LogAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string?>()),
            Times.Never);

        notificationServiceMock.Verify(
            service => service.CreateAsync(
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<int?>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateMemberRoleAsync_LastWorkspaceOwnerIsDemoted_ThrowsConflictException()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        var ownerUser = new User
        {
            Id = 1,
            UserName = "owner@test.com",
            Email = "owner@test.com",
            FullName = "Workspace Owner",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var ownerRole = new Role
        {
            Id = 1,
            Name = SystemRoles.WorkspaceOwner,
            Description = "Workspace Owner",
            IsSystemRole = true,
            CreatedAt = now
        };

        var memberRole = new Role
        {
            Id = 2,
            Name = SystemRoles.Member,
            Description = "Workspace Member",
            IsSystemRole = true,
            CreatedAt = now
        };

        var workspace = new Workspace
        {
            Id = 1,
            Name = "Test Workspace",
            CreatedByUserId = ownerUser.Id,
            CreatedAt = now
        };

        var ownerMembership = new WorkspaceMember
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = ownerUser.Id,
            RoleId = ownerRole.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        dbContext.Users.Add(ownerUser);

        dbContext.Roles.AddRange(
            ownerRole,
            memberRole);

        dbContext.Workspaces.Add(workspace);
        dbContext.WorkspaceMembers.Add(ownerMembership);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(ownerUser.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionServiceMock =
            new Mock<IPermissionService>();

        permissionServiceMock
            .Setup(service =>
                service.EnsurePermissionAsync(
                    workspace.Id,
                    SystemPermissions.MemberChangeRole,
                    It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var activityLogServiceMock =
            new Mock<IActivityLogService>();

        activityLogServiceMock
            .Setup(service => service.LogAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var notificationServiceMock =
            new Mock<INotificationService>();

        var workspaceMemberService =
            new WorkspaceMemberService(
                dbContext,
                currentUserServiceMock.Object,
                permissionServiceMock.Object,
                activityLogServiceMock.Object,
                notificationServiceMock.Object);

        var request =
            new UpdateWorkspaceMemberRoleRequest
            {
                RoleId = memberRole.Id
            };

        await Assert.ThrowsAsync<ConflictException>(
            () => workspaceMemberService.UpdateMemberRoleAsync(
                workspace.Id,
                ownerMembership.Id,
                request));

        var ownerStillExists =
            await dbContext.WorkspaceMembers
                .Include(member => member.Role)
                .AnyAsync(member =>
                    member.Id == ownerMembership.Id &&
                    member.Role.Name ==
                    SystemRoles.WorkspaceOwner);

        Assert.True(ownerStillExists);

        activityLogServiceMock.Verify(
            service => service.LogAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string?>()),
            Times.Never);

        notificationServiceMock.Verify(
            service => service.CreateAsync(
                It.IsAny<int>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<int?>()),
            Times.Never);
    }
}