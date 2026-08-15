using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.Infrastructure.Services;

public sealed class FileStorageService : IFileStorageService
{
    private readonly string _storageRootPath;

    public FileStorageService(string storageRootPath)
    {
        if (string.IsNullOrWhiteSpace(storageRootPath))
        {
            throw new ArgumentException(
                "Storage root path is required.",
                nameof(storageRootPath));
        }

        _storageRootPath = Path.GetFullPath(storageRootPath);

        Directory.CreateDirectory(_storageRootPath);
    }

    public async Task<string> SaveFileAsync(
        Stream content,
        string fileName,
        int taskId)
    {
        if (content is null)
        {
            throw new ArgumentNullException(nameof(content));
        }

        if (taskId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(taskId));
        }

        var extension = Path.GetExtension(fileName);

        var storedFileName =
            $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";

        var relativePath = Path.Combine(
            $"task-{taskId}",
            storedFileName);

        var fullPath = GetSafeFullPath(relativePath);

        var directoryPath = Path.GetDirectoryName(fullPath);

        if (!string.IsNullOrWhiteSpace(directoryPath))
        {
            Directory.CreateDirectory(directoryPath);
        }

        await using var fileStream = new FileStream(
            fullPath,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true);

        await content.CopyToAsync(fileStream);

        return relativePath.Replace(
            Path.DirectorySeparatorChar,
            '/');
    }

    public async Task<byte[]> ReadFileAsync(
        string filePath)
    {
        var fullPath = GetSafeFullPath(filePath);

        if (!File.Exists(fullPath))
        {
            throw new NotFoundException(
                "The attachment file was not found in storage.");
        }

        return await File.ReadAllBytesAsync(fullPath);
    }

    public Task DeleteFileAsync(
        string filePath)
    {
        var fullPath = GetSafeFullPath(filePath);

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    private string GetSafeFullPath(
        string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            throw new BadRequestException(
                "The attachment file path is invalid.");
        }

        var normalizedRelativePath = relativePath.Replace(
            '/',
            Path.DirectorySeparatorChar);

        var fullPath = Path.GetFullPath(
            Path.Combine(
                _storageRootPath,
                normalizedRelativePath));

        var storageRootWithSeparator =
            _storageRootPath.EndsWith(
                Path.DirectorySeparatorChar)
                ? _storageRootPath
                : _storageRootPath
                  + Path.DirectorySeparatorChar;

        if (!fullPath.StartsWith(
                storageRootWithSeparator,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException(
                "The attachment file path is invalid.");
        }

        return fullPath;
    }
}