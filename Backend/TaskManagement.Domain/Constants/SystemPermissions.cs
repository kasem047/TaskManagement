namespace TaskManagement.Domain.Constants;

public static class SystemPermissions
{
    public const string WorkspaceManage = "workspace.manage";

    public const string MemberInvite = "member.invite";
    public const string MemberRemove = "member.remove";
    public const string MemberChangeRole = "member.change_role";

    public const string ProjectCreate = "project.create";
    public const string ProjectView = "project.view";
    public const string ProjectUpdate = "project.update";
    public const string ProjectDelete = "project.delete";

    public const string TaskCreate = "task.create";
    public const string TaskView = "task.view";
    public const string TaskDetailsUpdate = "task.details.update";
    public const string TaskStatusUpdate = "task.status.update";
    public const string TaskDelete = "task.delete";
    public const string TaskAssign = "task.assign";
    public const string TaskComment = "task.comment";
    public const string TaskAttachmentUpload = "task.attachment.upload";
}