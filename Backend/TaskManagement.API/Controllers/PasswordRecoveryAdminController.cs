using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Admin;
using TaskManagement.Application.Interfaces;
using TaskManagement.Domain.Enums;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route(
    "api/admin/password-recovery-requests")]
public sealed class PasswordRecoveryAdminController
    : ControllerBase
{
    private readonly IPasswordRecoveryService
        _passwordRecoveryService;


    public PasswordRecoveryAdminController(
        IPasswordRecoveryService passwordRecoveryService)
    {
        _passwordRecoveryService =
            passwordRecoveryService;
    }


    [HttpGet]
    public async Task<
        ActionResult<List<AdminPasswordRecoveryResponse>>>
        GetRequests(
            [FromQuery]
            PasswordRecoveryStatus? status = null)
    {
        var response =
            await _passwordRecoveryService
                .GetAdminRequestsAsync(
                    status);


        return Ok(
            response);
    }


    [HttpGet("{requestId:int}")]
    public async Task<
        ActionResult<AdminPasswordRecoveryResponse>>
        GetRequest(
            int requestId)
    {
        var response =
            await _passwordRecoveryService
                .GetAdminRequestByIdAsync(
                    requestId);


        return Ok(
            response);
    }


    [HttpPost(
        "{requestId:int}/approve")]
    public async Task<
        ActionResult<AdminPasswordRecoveryResponse>>
        Approve(
            int requestId)
    {
        var response =
            await _passwordRecoveryService
                .ApproveAsync(
                    requestId);


        return Ok(
            response);
    }


    [HttpPost(
        "{requestId:int}/reject")]
    public async Task<
        ActionResult<AdminPasswordRecoveryResponse>>
        Reject(
            int requestId,
            [FromBody]
            RejectPasswordRecoveryRequest request)
    {
        var response =
            await _passwordRecoveryService
                .RejectAsync(
                    requestId,
                    request);


        return Ok(
            response);
    }


    /*
     * الزر الذي طلبته تحديدًا:
     *
     * المدير يوافق أولًا،
     * وبعدها يضغط هذا الإجراء
     * والنظام يولد رمز 6 أرقام ويرسله.
     */
    [HttpPost(
        "{requestId:int}/send-code")]
    public async Task<
        ActionResult<AdminPasswordRecoveryResponse>>
        SendCode(
            int requestId)
    {
        var response =
            await _passwordRecoveryService
                .SendCodeAsync(
                    requestId);


        return Ok(
            response);
    }
}