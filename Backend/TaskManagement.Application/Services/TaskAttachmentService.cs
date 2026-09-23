using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.TaskAttachments;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Constants;
using TaskManagement.Domain.Entities;

namespace TaskManagement.Application.Services;

public sealed class TaskAttachmentService
    : ITaskAttachmentService
{
    private const long MaximumFileSize =
        10 * 1024 * 1024;

    private static readonly HashSet<string>
        AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".png",
            ".jpg",
            ".jpeg"
        };

    private readonly IApplicationDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly IPermissionService _permissionService;
    private readonly IFileStorageService _fileStorageService;
    private readonly IActivityLogService _activityLogService;

    public TaskAttachmentService(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService,
        IPermissionService permissionService,
        IFileStorageService fileStorageService,
        IActivityLogService activityLogService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _permissionService = permissionService;
        _fileStorageService = fileStorageService;
        _activityLogService = activityLogService;
    }

    public async Task<List<TaskAttachmentResponse>>
        GetTaskAttachmentsAsync(
            int workspaceId,
            int projectId,
            int taskId)
    {
        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskView);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        var attachments =
            await _dbContext.TaskAttachments
                .AsNoTracking()
                .Include(attachment =>
                    attachment.User)
                .Where(attachment =>
                    attachment.TaskItemId == taskId &&
                    !attachment.IsDeleted)
                .OrderBy(attachment =>
                    attachment.CreatedAt)
                .ToListAsync();

        return attachments
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<TaskAttachmentResponse>
        UploadTaskAttachmentAsync(
            int workspaceId,
            int projectId,
            int taskId,
            UploadTaskAttachmentData uploadData)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskAttachmentUpload);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Attachments cannot be uploaded to tasks in an archived project.");
        }

        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);

        ValidateUploadData(uploadData);

        var currentUserId =
            _currentUserService.UserId;

        var currentUser =
            await _dbContext.Users
                .FirstOrDefaultAsync(user =>
                    user.Id == currentUserId &&
                    user.IsActive &&
                    !user.IsDeleted);

        if (currentUser is null)
        {
            throw new UnauthorizedException(
                "Current user account is not available.");
        }

        string? storedFilePath = null;
        TaskAttachment attachment;

        try
        {
            storedFilePath =
                await _fileStorageService.SaveFileAsync(
                    uploadData.Content,
                    uploadData.FileName,
                    taskId);

            attachment = new TaskAttachment
            {
                TaskItemId = taskId,
                UserId = currentUserId,
                FileName = Path.GetFileName(
                    uploadData.FileName),
                FilePath = storedFilePath,
                ContentType =
                    NormalizeContentType(
                        uploadData.ContentType),
                FileSize = uploadData.FileSize,
                CreatedAt = DateTime.UtcNow,
                User = currentUser
            };

            _dbContext.TaskAttachments.Add(
                attachment);

            await _dbContext.SaveChangesAsync();
        }
        catch
        {
            if (!string.IsNullOrWhiteSpace(
                    storedFilePath))
            {
                await _fileStorageService.DeleteFileAsync(
                    storedFilePath);
            }

            throw;
        }

        await _activityLogService.LogAsync(
            workspaceId,
            "attachment.uploaded",
            nameof(TaskAttachment),
            attachment.Id,
            $"Uploaded attachment: {attachment.FileName}");

        return MapToResponse(
            attachment);
    }

    public async Task<DownloadTaskAttachmentResponse>
        DownloadTaskAttachmentAsync(
            int workspaceId,
            int projectId,
            int taskId,
            int attachmentId)
    {
        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskView);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        var attachment =
            await GetAttachmentAsync(
                taskId,
                attachmentId);

        var fileContent =
            await _fileStorageService.ReadFileAsync(
                attachment.FilePath);

        return new DownloadTaskAttachmentResponse
        {
            FileContent = fileContent,
            FileName = attachment.FileName,
            ContentType = attachment.ContentType
        };
    }

    public async Task DeleteTaskAttachmentAsync(
        int workspaceId,
        int projectId,
        int taskId,
        int attachmentId)
    {
        var project = await GetProjectAsync(
            workspaceId,
            projectId);

        await _permissionService.EnsurePermissionAsync(
            workspaceId,
            SystemPermissions.TaskAttachmentUpload);

        await EnsureMemberAssignedWhenRequiredAsync(
            workspaceId,
            taskId);

        if (project.IsArchived)
        {
            throw new ConflictException(
                "Attachments in archived projects cannot be deleted.");
        }

        await EnsureTaskExistsAsync(
            workspaceId,
            projectId,
            taskId);

        var attachment =
            await GetAttachmentAsync(
                taskId,
                attachmentId);

        EnsureAttachmentOwner(
            attachment);

        await _fileStorageService.DeleteFileAsync(
            attachment.FilePath);

        var now = DateTime.UtcNow;

        attachment.IsDeleted = true;
        attachment.DeletedAt = now;
        attachment.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();

        await _activityLogService.LogAsync(
            workspaceId,
            "attachment.deleted",
            nameof(TaskAttachment),
            attachment.Id,
            $"Deleted attachment: {attachment.FileName}");
    }

    private async Task<Project> GetProjectAsync(
        int workspaceId,
        int projectId)
    {
        var project =
            await _dbContext.Projects
                .FirstOrDefaultAsync(project =>
                    project.Id == projectId &&
                    project.WorkspaceId == workspaceId &&
                    !project.IsDeleted);

        if (project is null)
        {
            throw new NotFoundException(
                "Project not found.");
        }

        return project;
    }

    private async Task EnsureMemberAssignedWhenRequiredAsync(
        int workspaceId,
        int taskId)
    {
        var roleName =
            await _permissionService.GetActiveRoleNameAsync(
                workspaceId);

        if (roleName != SystemRoles.Member)
        {
            return;
        }

        var assigned =
            await _dbContext.TaskAssignees.AnyAsync(assignment =>
                assignment.TaskItemId == taskId &&
                assignment.UserId == _currentUserService.UserId &&
                !assignment.IsDeleted);

        if (!assigned)
        {
            throw new ForbiddenException(
                "You can only access tasks assigned to you.");
        }
    }

    private async Task EnsureTaskExistsAsync(
        int workspaceId,
        int projectId,
        int taskId)
    {
        var projectExists =
            await _dbContext.Projects.AnyAsync(project =>
                project.Id == projectId &&
                project.WorkspaceId == workspaceId &&
                !project.IsDeleted);

        if (!projectExists)
        {
            throw new NotFoundException(
                "Project not found.");
        }

        var taskExists =
            await _dbContext.TaskItems.AnyAsync(task =>
                task.Id == taskId &&
                task.ProjectId == projectId &&
                !task.IsDeleted);

        if (!taskExists)
        {
            throw new NotFoundException(
                "Task not found.");
        }
    }

    private async Task<TaskAttachment>
        GetAttachmentAsync(
            int taskId,
            int attachmentId)
    {
        var attachment =
            await _dbContext.TaskAttachments
                .Include(taskAttachment =>
                    taskAttachment.User)
                .FirstOrDefaultAsync(
                    taskAttachment =>
                        taskAttachment.Id ==
                            attachmentId &&
                        taskAttachment.TaskItemId ==
                            taskId &&
                        !taskAttachment.IsDeleted);

        if (attachment is null)
        {
            throw new NotFoundException(
                "Task attachment not found.");
        }

        return attachment;
    }

    private void EnsureAttachmentOwner(
        TaskAttachment attachment)
    {
        if (attachment.UserId !=
            _currentUserService.UserId)
        {
            throw new ForbiddenException(
                "You can only delete your own attachments.");
        }
    }

    private static void ValidateUploadData(
        UploadTaskAttachmentData uploadData)
    {
        if (uploadData is null)
        {
            throw new BadRequestException(
                "File data is required.");
        }

        if (uploadData.Content is null ||
            !uploadData.Content.CanRead)
        {
            throw new BadRequestException(
                "The uploaded file content is invalid.");
        }

        if (uploadData.FileSize <= 0)
        {
            throw new BadRequestException(
                "The uploaded file cannot be empty.");
        }

        if (uploadData.FileSize >
            MaximumFileSize)
        {
            throw new BadRequestException(
                "The uploaded file cannot exceed 10 MB.");
        }

        var safeFileName =
            Path.GetFileName(
                uploadData.FileName);

        if (string.IsNullOrWhiteSpace(
                safeFileName))
        {
            throw new BadRequestException(
                "The uploaded file name is invalid.");
        }

        if (safeFileName.Length > 255)
        {
            throw new BadRequestException(
                "The uploaded file name cannot exceed 255 characters.");
        }

        var extension =
            Path.GetExtension(
                safeFileName);

        if (string.IsNullOrWhiteSpace(
                extension) ||
            !AllowedExtensions.Contains(
                extension))
        {
            throw new BadRequestException(
                "The uploaded file type is not allowed.");
        }

        if (uploadData.ContentType?.Length >
            100)
        {
            throw new BadRequestException(
                "The uploaded file content type is invalid.");
        }
    }

    private static string NormalizeContentType(
        string contentType)
    {
        return string.IsNullOrWhiteSpace(
            contentType)
            ? "application/octet-stream"
            : contentType.Trim();
    }

    private static TaskAttachmentResponse
        MapToResponse(
            TaskAttachment attachment)
    {
        return new TaskAttachmentResponse
        {
            Id = attachment.Id,
            TaskItemId = attachment.TaskItemId,
            UserId = attachment.UserId,
            UserFullName =
                attachment.User.FullName,
            FileName = attachment.FileName,
            ContentType =
                attachment.ContentType,
            FileSize = attachment.FileSize,
            CreatedAt = attachment.CreatedAt
        };
    }
}