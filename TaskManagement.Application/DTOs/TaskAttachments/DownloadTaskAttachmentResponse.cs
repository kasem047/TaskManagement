namespace TaskManagement.Application.DTOs.TaskAttachments;

public sealed class DownloadTaskAttachmentResponse
{
    public byte[] FileContent { get; set; } = Array.Empty<byte>();

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;
}