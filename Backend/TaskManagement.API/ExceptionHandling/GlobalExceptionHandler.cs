using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;

namespace TaskManagement.API.ExceptionHandling;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(
        ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var error = MapException(exception);

        LogException(
            exception,
            error.StatusCode,
            httpContext.TraceIdentifier);

        var problemDetails = new ProblemDetails
        {
            Status = error.StatusCode,
            Title = error.Title,
            Detail = error.Detail,
            Instance = httpContext.Request.Path
        };

        problemDetails.Extensions["errorCode"] =
            error.ErrorCode;

        problemDetails.Extensions["traceId"] =
            httpContext.TraceIdentifier;

        problemDetails.Extensions["timestamp"] =
            DateTime.UtcNow;

        httpContext.Response.StatusCode =
            error.StatusCode;

        httpContext.Response.ContentType =
            "application/problem+json";

        await httpContext.Response.WriteAsJsonAsync(
            problemDetails,
            cancellationToken);

        return true;
    }

    private static ErrorDetails MapException(
        Exception exception)
    {
        return exception switch
        {
            BadRequestException badRequest =>
                new ErrorDetails(
                    StatusCodes.Status400BadRequest,
                    "Bad Request",
                    badRequest.Message,
                    "bad_request"),

            ValidationException validation =>
                new ErrorDetails(
                    StatusCodes.Status400BadRequest,
                    "Validation Failed",
                    validation.Message,
                    "validation_error"),

            BadHttpRequestException badHttpRequest =>
                new ErrorDetails(
                    StatusCodes.Status400BadRequest,
                    "Bad Request",
                    badHttpRequest.Message,
                    "invalid_request"),

            UnauthorizedException unauthorized =>
                new ErrorDetails(
                    StatusCodes.Status401Unauthorized,
                    "Unauthorized",
                    unauthorized.Message,
                    "unauthorized"),

            ForbiddenException forbidden =>
                new ErrorDetails(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    forbidden.Message,
                    "forbidden"),

            NotFoundException notFound =>
                new ErrorDetails(
                    StatusCodes.Status404NotFound,
                    "Not Found",
                    notFound.Message,
                    "not_found"),

            ConflictException conflict =>
                new ErrorDetails(
                    StatusCodes.Status409Conflict,
                    "Conflict",
                    conflict.Message,
                    "conflict"),

            DbUpdateConcurrencyException =>
                new ErrorDetails(
                    StatusCodes.Status409Conflict,
                    "Conflict",
                    "The requested data was modified by another operation. Please refresh and try again.",
                    "concurrency_conflict"),

            _ =>
                new ErrorDetails(
                    StatusCodes.Status500InternalServerError,
                    "Internal Server Error",
                    "An unexpected error occurred. Please try again later.",
                    "internal_server_error")
        };
    }

    private void LogException(
        Exception exception,
        int statusCode,
        string traceId)
    {
        if (statusCode >= 500)
        {
            _logger.LogError(
                exception,
                "Unhandled server error. TraceId: {TraceId}",
                traceId);

            return;
        }

        _logger.LogInformation(
            "Request failed with status {StatusCode}. " +
            "Message: {Message}. TraceId: {TraceId}",
            statusCode,
            exception.Message,
            traceId);
    }

    private sealed record ErrorDetails(
        int StatusCode,
        string Title,
        string Detail,
        string ErrorCode);
}