namespace TaskManagement.Application.Interfaces;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(
        int workspaceId,
        string permissionName,
        CancellationToken cancellationToken = default);

    Task EnsurePermissionAsync(
        int workspaceId,
        string permissionName,
        CancellationToken cancellationToken = default);
}