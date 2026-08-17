using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.DTOs.Auth;
using TaskManagement.Domain.Enums;

namespace TaskManagement.Application.Interfaces;

public interface IPasswordRecoveryService
{
    Task<PasswordRecoveryPublicStatusResponse>
        CreateRequestAsync(
            CreatePasswordRecoveryRequest request);

    Task<PasswordRecoveryPublicStatusResponse>
        GetPublicStatusAsync(
            string publicToken);

    Task<VerifyPasswordRecoveryCodeResponse>
        VerifyCodeAsync(
            VerifyPasswordRecoveryCodeRequest request);

    Task ResetPasswordAsync(
        ResetForgottenPasswordRequest request);


    Task<List<AdminPasswordRecoveryResponse>>
        GetAdminRequestsAsync(
            PasswordRecoveryStatus? status);

    Task<AdminPasswordRecoveryResponse>
        GetAdminRequestByIdAsync(
            int requestId);

    Task<AdminPasswordRecoveryResponse>
        ApproveAsync(
            int requestId);

    Task<AdminPasswordRecoveryResponse>
        RejectAsync(
            int requestId,
            RejectPasswordRecoveryRequest request);

    Task<AdminPasswordRecoveryResponse>
        SendCodeAsync(
            int requestId);
}