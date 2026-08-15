using TaskManagement.Domain.Common;

namespace TaskManagement.Domain.Entities;

public class RolePermission : BaseEntity
{
    public int RoleId { get; set; }

    public Role Role { get; set; } = null!;

    public int PermissionId { get; set; }

    public Permission Permission { get; set; } = null!;
}