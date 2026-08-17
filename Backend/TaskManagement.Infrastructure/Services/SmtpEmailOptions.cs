namespace TaskManagement.Infrastructure.Services;

public sealed class SmtpEmailOptions
{
    public const string SectionName =
        "Smtp";

    public string Host { get; set; } =
        string.Empty;

    public int Port { get; set; } =
        587;

    public string UserName { get; set; } =
        string.Empty;

    public string Password { get; set; } =
        string.Empty;

    public string FromEmail { get; set; } =
        string.Empty;

    public string FromName { get; set; } =
        "TaskManagement";

    public bool UseSsl { get; set; }
}