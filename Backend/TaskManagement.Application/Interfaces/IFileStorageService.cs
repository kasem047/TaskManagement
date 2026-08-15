namespace TaskManagement.Application.Interfaces;

public interface IFileStorageService
{
    Task<string> SaveFileAsync(
        Stream content,
        string fileName,
        int taskId);

    Task<byte[]> ReadFileAsync(
        string filePath);

    Task DeleteFileAsync(
        string filePath);
}