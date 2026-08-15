namespace TaskManagement.Application.Common.Exceptions;

public class UnauthorizedException : Exception
{
    public UnauthorizedException()
        : base("Authentication is required.")
    {
    }

    public UnauthorizedException(string message)
        : base(message)
    {
    }
}