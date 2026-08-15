namespace TaskManagement.Application.DTOs.TaskAttachments;

public sealed class UploadTaskAttachmentData
{
    public Stream Content { get; set; } = Stream.Null;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; }
}