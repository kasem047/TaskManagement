using Microsoft.EntityFrameworkCore;
using Moq;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.Services;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;
using TaskManagement.Domain.Enums;
using TaskManagement.Infrastructure.Data;

namespace TaskManagement.Tests.Services;

public sealed class PermissionServiceTests
{
    [Fact]
    public async Task HasPermissionAsync_SystemAdmin_ReturnsTrue()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    databaseName: Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var user = new User
        {
            Id = 1,
            UserName = "systemadmin@test.com",
            Email = "systemadmin@test.com",
            FullName = "System Admin",
            IsActive = true,
            IsSystemAdmin = true,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(user.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionService = new PermissionService(
            dbContext,
            currentUserServiceMock.Object);

        var result =
            await permissionService.HasPermissionAsync(
                workspaceId: 999,
                SystemPermissions.WorkspaceManage);

        Assert.True(result);
    }

    [Fact]
    public async Task HasPermissionAsync_ExplicitDenyOverridesRolePermission_ReturnsFalse()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    databaseName: Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = 1,
            UserName = "member@test.com",
            Email = "member@test.com",
            FullName = "Workspace Member",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var workspace = new Workspace
        {
            Id = 1,
            Name = "Test Workspace",
            CreatedByUserId = user.Id,
            CreatedAt = now
        };

        var role = new Role
        {
            Id = 1,
            Name = SystemRoles.ProjectManager,
            Description = "Project Manager",
            IsSystemRole = true,
            CreatedAt = now
        };

        var permission = new Permission
        {
            Id = 1,
            Name = SystemPermissions.MemberInvite,
            Module = "Members",
            Description = "Invite members to workspace",
            CreatedAt = now
        };

        var workspaceMember = new WorkspaceMember
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            RoleId = role.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        var rolePermission = new RolePermission
        {
            Id = 1,
            RoleId = role.Id,
            PermissionId = permission.Id,
            CreatedAt = now
        };

        var explicitDeny = new UserPermissionOverride
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            PermissionId = permission.Id,
            IsGranted = false,
            Reason = "Permission denied for this user",
            CreatedAt = now
        };

        dbContext.Users.Add(user);
        dbContext.Workspaces.Add(workspace);
        dbContext.Roles.Add(role);
        dbContext.Permissions.Add(permission);
        dbContext.WorkspaceMembers.Add(workspaceMember);
        dbContext.RolePermissions.Add(rolePermission);
        dbContext.UserPermissionOverrides.Add(explicitDeny);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(user.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionService = new PermissionService(
            dbContext,
            currentUserServiceMock.Object);

        var result =
            await permissionService.HasPermissionAsync(
                workspace.Id,
                SystemPermissions.MemberInvite);

        Assert.False(result);
    }

    [Fact]
    public async Task HasPermissionAsync_ExplicitAllowWithoutRolePermission_ReturnsTrue()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    databaseName: Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = 1,
            UserName = "member@test.com",
            Email = "member@test.com",
            FullName = "Workspace Member",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var workspace = new Workspace
        {
            Id = 1,
            Name = "Test Workspace",
            CreatedByUserId = user.Id,
            CreatedAt = now
        };

        var role = new Role
        {
            Id = 1,
            Name = SystemRoles.Member,
            Description = "Workspace Member",
            IsSystemRole = true,
            CreatedAt = now
        };

        var permission = new Permission
        {
            Id = 1,
            Name = SystemPermissions.MemberInvite,
            Module = "Members",
            Description = "Invite members to workspace",
            CreatedAt = now
        };

        var workspaceMember = new WorkspaceMember
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            RoleId = role.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        var explicitAllow = new UserPermissionOverride
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            PermissionId = permission.Id,
            IsGranted = true,
            Reason = "Permission granted specifically to this user",
            CreatedAt = now
        };

        dbContext.Users.Add(user);
        dbContext.Workspaces.Add(workspace);
        dbContext.Roles.Add(role);
        dbContext.Permissions.Add(permission);
        dbContext.WorkspaceMembers.Add(workspaceMember);
        dbContext.UserPermissionOverrides.Add(explicitAllow);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(user.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionService = new PermissionService(
            dbContext,
            currentUserServiceMock.Object);

        var result =
            await permissionService.HasPermissionAsync(
                workspace.Id,
                SystemPermissions.MemberInvite);

        Assert.True(result);
    }

    [Fact]
    public async Task HasPermissionAsync_RoleHasPermission_ReturnsTrue()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    databaseName: Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = 1,
            UserName = "manager@test.com",
            Email = "manager@test.com",
            FullName = "Project Manager",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var workspace = new Workspace
        {
            Id = 1,
            Name = "Test Workspace",
            CreatedByUserId = user.Id,
            CreatedAt = now
        };

        var role = new Role
        {
            Id = 1,
            Name = SystemRoles.ProjectManager,
            Description = "Project Manager",
            IsSystemRole = true,
            CreatedAt = now
        };

        var permission = new Permission
        {
            Id = 1,
            Name = SystemPermissions.MemberInvite,
            Module = "Members",
            Description = "Invite members",
            CreatedAt = now
        };

        var workspaceMember = new WorkspaceMember
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            RoleId = role.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        var rolePermission = new RolePermission
        {
            Id = 1,
            RoleId = role.Id,
            PermissionId = permission.Id,
            CreatedAt = now
        };

        dbContext.Users.Add(user);
        dbContext.Workspaces.Add(workspace);
        dbContext.Roles.Add(role);
        dbContext.Permissions.Add(permission);
        dbContext.WorkspaceMembers.Add(workspaceMember);
        dbContext.RolePermissions.Add(rolePermission);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(user.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionService = new PermissionService(
            dbContext,
            currentUserServiceMock.Object);

        var result =
            await permissionService.HasPermissionAsync(
                workspace.Id,
                SystemPermissions.MemberInvite);

        Assert.True(result);
    }

    [Fact]
    public async Task HasPermissionAsync_NoRolePermissionOrOverride_ReturnsFalse()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    databaseName: Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = 1,
            UserName = "member@test.com",
            Email = "member@test.com",
            FullName = "Workspace Member",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = now
        };

        var workspace = new Workspace
        {
            Id = 1,
            Name = "Test Workspace",
            CreatedByUserId = user.Id,
            CreatedAt = now
        };

        var role = new Role
        {
            Id = 1,
            Name = SystemRoles.Member,
            Description = "Workspace Member",
            IsSystemRole = true,
            CreatedAt = now
        };

        var permission = new Permission
        {
            Id = 1,
            Name = SystemPermissions.MemberInvite,
            Module = "Members",
            Description = "Invite members",
            CreatedAt = now
        };

        var workspaceMember = new WorkspaceMember
        {
            Id = 1,
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            RoleId = role.Id,
            Status = WorkspaceMemberStatus.Active,
            JoinedAt = now,
            CreatedAt = now
        };

        dbContext.Users.Add(user);
        dbContext.Workspaces.Add(workspace);
        dbContext.Roles.Add(role);
        dbContext.Permissions.Add(permission);
        dbContext.WorkspaceMembers.Add(workspaceMember);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(user.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionService = new PermissionService(
            dbContext,
            currentUserServiceMock.Object);

        var result =
            await permissionService.HasPermissionAsync(
                workspace.Id,
                SystemPermissions.MemberInvite);

        Assert.False(result);
    }

    [Fact]
    public async Task EnsurePermissionAsync_NoPermission_ThrowsForbiddenException()
    {
        var options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(
                    databaseName: Guid.NewGuid().ToString())
                .Options;

        await using var dbContext =
            new ApplicationDbContext(options);

        var user = new User
        {
            Id = 1,
            UserName = "member@test.com",
            Email = "member@test.com",
            FullName = "Workspace Member",
            IsActive = true,
            IsSystemAdmin = false,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);

        await dbContext.SaveChangesAsync();

        var currentUserServiceMock =
            new Mock<ICurrentUserService>();

        currentUserServiceMock
            .Setup(service => service.UserId)
            .Returns(user.Id);

        currentUserServiceMock
            .Setup(service => service.IsAuthenticated)
            .Returns(true);

        var permissionService = new PermissionService(
            dbContext,
            currentUserServiceMock.Object);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => permissionService.EnsurePermissionAsync(
                workspaceId: 999,
                SystemPermissions.MemberInvite));
    }
}