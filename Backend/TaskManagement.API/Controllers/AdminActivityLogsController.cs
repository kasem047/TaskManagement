using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Common.Exceptions;
using TaskManagement.Application.DTOs.ActivityLogs;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/admin/activity-logs")]
public sealed class AdminActivityLogsController
    : ControllerBase
{
    private readonly IApplicationDbContext
        _dbContext;

    private readonly ICurrentUserService
        _currentUserService;


    public AdminActivityLogsController(
        IApplicationDbContext dbContext,
        ICurrentUserService currentUserService)
    {
        _dbContext =
            dbContext;

        _currentUserService =
            currentUserService;
    }


    /* =========================================================
       GLOBAL SYSTEM AUDIT LOG
       SYSTEM ADMIN ONLY
       ========================================================= */

    [HttpGet]
    public async Task<
        ActionResult<GlobalActivityLogPagedResponse>>
        GetGlobalActivityLogs(
            [FromQuery]
            GlobalActivityLogQueryRequest request)
    {
        await EnsureSystemAdminAsync();


        if (
            request.From.HasValue &&
            request.To.HasValue &&
            request.From.Value >
                request.To.Value)
        {
            throw new BadRequestException(
                "From date cannot be later than To date.");
        }


        var query =
            _dbContext.ActivityLogs
                .AsNoTracking()
                .Include(activityLog =>
                    activityLog.User)
                .Include(activityLog =>
                    activityLog.Workspace)
                .Where(activityLog =>
                    !activityLog.IsDeleted);


        /* =====================================================
           WORKSPACE FILTER
           ===================================================== */

        if (
            request.WorkspaceId.HasValue)
        {
            query =
                query.Where(
                    activityLog =>
                        activityLog.WorkspaceId ==
                            request.WorkspaceId.Value);
        }


        /* =====================================================
           USER FILTER
           ===================================================== */

        if (
            request.UserId.HasValue)
        {
            query =
                query.Where(
                    activityLog =>
                        activityLog.UserId ==
                            request.UserId.Value);
        }


        /* =====================================================
           ACTION FILTER
           ===================================================== */

        if (
            !string.IsNullOrWhiteSpace(
                request.Action))
        {
            var action =
                request.Action.Trim();


            query =
                query.Where(
                    activityLog =>
                        activityLog.Action.Contains(
                            action));
        }


        /* =====================================================
           ENTITY FILTER
           ===================================================== */

        if (
            !string.IsNullOrWhiteSpace(
                request.EntityName))
        {
            var entityName =
                request.EntityName.Trim();


            query =
                query.Where(
                    activityLog =>
                        activityLog.EntityName.Contains(
                            entityName));
        }


        /* =====================================================
           DATE FILTER
           ===================================================== */

        if (
            request.From.HasValue)
        {
            query =
                query.Where(
                    activityLog =>
                        activityLog.CreatedAt >=
                            request.From.Value);
        }


        if (
            request.To.HasValue)
        {
            query =
                query.Where(
                    activityLog =>
                        activityLog.CreatedAt <=
                            request.To.Value);
        }


        /* =====================================================
           SEARCH
           ===================================================== */

        if (
            !string.IsNullOrWhiteSpace(
                request.Search))
        {
            var search =
                request.Search.Trim();


            query =
                query.Where(
                    activityLog =>

                        activityLog.Action.Contains(
                            search)

                        ||

                        activityLog.EntityName.Contains(
                            search)

                        ||

                        (
                            activityLog.Description !=
                                null &&
                            activityLog.Description.Contains(
                                search)
                        )

                        ||

                        activityLog.User.FullName.Contains(
                            search)

                        ||

                        activityLog.Workspace.Name.Contains(
                            search));
        }


        /* =====================================================
           COUNT
           ===================================================== */

        var totalCount =
            await query.CountAsync();


        var totalPages =
            totalCount == 0

                ? 0

                : (int)Math.Ceiling(
                    totalCount /
                    (double)request.PageSize);


        /* =====================================================
           PAGE
           ===================================================== */

        var items =
            await query
                .OrderByDescending(
                    activityLog =>
                        activityLog.CreatedAt)
                .ThenByDescending(
                    activityLog =>
                        activityLog.Id)
                .Skip(
                    (request.Page - 1) *
                    request.PageSize)
                .Take(
                    request.PageSize)
                .Select(
                    activityLog =>
                        new GlobalActivityLogItemResponse
                        {
                            Id =
                                activityLog.Id,

                            WorkspaceId =
                                activityLog.WorkspaceId,

                            WorkspaceName =
                                activityLog.Workspace.Name,

                            UserId =
                                activityLog.UserId,

                            UserFullName =
                                activityLog.User.FullName,

                            Action =
                                activityLog.Action,

                            EntityName =
                                activityLog.EntityName,

                            EntityId =
                                activityLog.EntityId,

                            Description =
                                activityLog.Description,

                            CreatedAt =
                                activityLog.CreatedAt
                        })
                .ToListAsync();


        return Ok(
            new GlobalActivityLogPagedResponse
            {
                Items =
                    items,

                Page =
                    request.Page,

                PageSize =
                    request.PageSize,

                TotalCount =
                    totalCount,

                TotalPages =
                    totalPages
            });
    }


    /* =========================================================
       SYSTEM ADMIN CHECK
       ========================================================= */

    private async Task EnsureSystemAdminAsync()
    {
        var currentUserId =
            _currentUserService.UserId;


        var isSystemAdmin =
            await _dbContext.Users
                .AsNoTracking()
                .AnyAsync(
                    user =>
                        user.Id ==
                            currentUserId &&
                        user.IsSystemAdmin &&
                        user.IsActive &&
                        !user.IsDeleted);


        if (!isSystemAdmin)
        {
            throw new ForbiddenException(
                "Only the system administrator can access the global audit log.");
        }
    }
}