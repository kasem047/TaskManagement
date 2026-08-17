using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.Infrastructure.Services;

public sealed class SmtpEmailService
    : IEmailService
{
    private readonly SmtpEmailOptions
        _options;


    public SmtpEmailService(
        IOptions<SmtpEmailOptions> options)
    {
        _options =
            options.Value;
    }


    public async Task SendAsync(
        string toEmail,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken = default)
    {
        ValidateConfiguration();


        var message =
            new MimeMessage();


        message.From.Add(
            new MailboxAddress(
                _options.FromName,
                _options.FromEmail));


        message.To.Add(
            MailboxAddress.Parse(
                toEmail));


        message.Subject =
            subject;


        var bodyBuilder =
            new BodyBuilder
            {
                HtmlBody =
                    htmlBody
            };


        message.Body =
            bodyBuilder
                .ToMessageBody();


        using var client =
            new SmtpClient();


        var socketOptions =
            _options.UseSsl
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTlsWhenAvailable;


        await client.ConnectAsync(
            _options.Host,
            _options.Port,
            socketOptions,
            cancellationToken);


        if (!string.IsNullOrWhiteSpace(
                _options.UserName))
        {
            await client.AuthenticateAsync(
                _options.UserName,
                _options.Password,
                cancellationToken);
        }


        await client.SendAsync(
            message,
            cancellationToken);


        await client.DisconnectAsync(
            true,
            cancellationToken);
    }


    private void ValidateConfiguration()
    {
        if (string.IsNullOrWhiteSpace(
                _options.Host))
        {
            throw new InvalidOperationException(
                "SMTP Host is not configured.");
        }


        if (_options.Port <= 0)
        {
            throw new InvalidOperationException(
                "SMTP Port is not configured.");
        }


        if (string.IsNullOrWhiteSpace(
                _options.FromEmail))
        {
            throw new InvalidOperationException(
                "SMTP FromEmail is not configured.");
        }
    }
}