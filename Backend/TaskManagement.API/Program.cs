using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using TaskManagement.API.BackgroundServices;
using TaskManagement.API.ExceptionHandling;
using TaskManagement.API.Hubs;
using TaskManagement.API.Services;
using TaskManagement.Application.Interfaces;
using TaskManagement.Application.Services;
using TaskManagement.Domain.Entities;
using TaskManagement.Infrastructure.Data;
using TaskManagement.Infrastructure.Identity;
using TaskManagement.Infrastructure.Security;
using TaskManagement.Infrastructure.Services;

var builder =
    WebApplication.CreateBuilder(
        args);


/* =========================================================
   CONTROLLERS
   ========================================================= */

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions
            .Converters
            .Add(
                new JsonStringEnumConverter());
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory =
            context =>
            {
                var problemDetails =
                    new ValidationProblemDetails(
                        context.ModelState)
                    {
                        Title =
                            "Validation failed.",

                        Status =
                            StatusCodes
                                .Status400BadRequest,

                        Detail =
                            "One or more validation errors occurred.",

                        Instance =
                            context.HttpContext
                                .Request.Path
                    };


                problemDetails.Extensions[
                    "traceId"] =
                        context.HttpContext
                            .TraceIdentifier;


                return new BadRequestObjectResult(
                    problemDetails)
                {
                    ContentTypes =
                    {
                        "application/problem+json"
                    }
                };
            };
    });


/* =========================================================
   SIGNALR
   ========================================================= */

builder.Services
    .AddSignalR();


/* =========================================================
   CORS
   ========================================================= */

builder.Services
    .AddCors(options =>
    {
        options.AddPolicy(
            "FrontendPolicy",
            policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:4200",
                        "https://localhost:4200")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
    });


/* =========================================================
   BACKGROUND SERVICES
   ========================================================= */

builder.Services
    .AddHostedService<
        TaskReminderBackgroundService>();


/* =========================================================
   EXCEPTION HANDLING
   ========================================================= */

builder.Services
    .AddExceptionHandler<
        GlobalExceptionHandler>();

builder.Services
    .AddProblemDetails();


/* =========================================================
   DATABASE
   ========================================================= */

builder.Services
    .AddDbContext<
        ApplicationDbContext>(
        options =>
            options.UseSqlServer(
                builder.Configuration
                    .GetConnectionString(
                        "DefaultConnection")));


builder.Services
    .AddScoped<
        IApplicationDbContext>(
        serviceProvider =>
            serviceProvider
                .GetRequiredService<
                    ApplicationDbContext>());


/* =========================================================
   TIME
   ========================================================= */

builder.Services
    .AddSingleton(
        TimeProvider.System);


/* =========================================================
   IDENTITY
   ========================================================= */

builder.Services
    .AddIdentityCore<User>(
        options =>
        {
            options.Password.RequiredLength =
                8;

            options.Password.RequireDigit =
                true;

            options.Password.RequireLowercase =
                true;

            options.Password.RequireUppercase =
                false;

            options.Password.RequireNonAlphanumeric =
                false;

            options.User.RequireUniqueEmail =
                true;
        })
    .AddEntityFrameworkStores<
        ApplicationDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();


/* =========================================================
   JWT
   ========================================================= */

var jwtKey =
    builder.Configuration[
        "Jwt:Key"];

var jwtIssuer =
    builder.Configuration[
        "Jwt:Issuer"];

var jwtAudience =
    builder.Configuration[
        "Jwt:Audience"];


if (string.IsNullOrWhiteSpace(
        jwtKey))
{
    throw new InvalidOperationException(
        "JWT Key is not configured.");
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

builder.Services
    .AddAuthentication(
        options =>
        {
            options.DefaultAuthenticateScheme =
                JwtBearerDefaults
                    .AuthenticationScheme;

            options.DefaultChallengeScheme =
                JwtBearerDefaults
                    .AuthenticationScheme;
        })
    .AddJwtBearer(
        options =>
        {
            options.TokenValidationParameters =
                new TokenValidationParameters
                {
                    ValidateIssuer =
                        true,

                    ValidIssuer =
                        jwtIssuer,

                    ValidateAudience =
                        true,

                    ValidAudience =
                        jwtAudience,

                    ValidateIssuerSigningKey =
                        true,

                    IssuerSigningKey =
                        new SymmetricSecurityKey(
                            Encoding.UTF8
                                .GetBytes(
                                    jwtKey)),

                    ValidateLifetime =
                        true,

                    ClockSkew =
                        TimeSpan.Zero
                };


            options.Events =
                new JwtBearerEvents
                {
                    OnMessageReceived =
                        context =>
                        {
                            var accessToken =
                                context.Request.Query[
                                    "access_token"];


                            var path =
                                context.HttpContext
                                    .Request.Path;


                            if (
                                !string.IsNullOrEmpty(
                                    accessToken) &&
                                path.StartsWithSegments(
                                    "/hubs/notifications"))
                            {
                                context.Token =
                                    accessToken;
                            }


                            return Task.CompletedTask;
                        },


                    OnTokenValidated =
                        async context =>
                        {
                            var userIdValue =
                                context.Principal?
                                    .FindFirstValue(
                                        ClaimTypes
                                            .NameIdentifier)
                                ??
                                context.Principal?
                                    .FindFirstValue(
                                        "sub");


                            var sessionIdValue =
                                context.Principal?
                                    .FindFirstValue(
                                        "sessionId");


                            var tokenVersionValue =
                                context.Principal?
                                    .FindFirstValue(
                                        "tokenVersion");


                            if (
                                !int.TryParse(
                                    userIdValue,
                                    out var userId) ||
                                !int.TryParse(
                                    sessionIdValue,
                                    out var sessionId) ||
                                !int.TryParse(
                                    tokenVersionValue,
                                    out var tokenVersion))
                            {
                                context.Fail(
                                    "Invalid token claims.");

                                return;
                            }


                            var dbContext =
                                context.HttpContext
                                    .RequestServices
                                    .GetRequiredService<
                                        ApplicationDbContext>();


                            var user =
                                await dbContext
                                    .Users
                                    .FirstOrDefaultAsync(
                                        user =>
                                            user.Id ==
                                            userId);


                            if (
                                user is null ||
                                !user.IsActive ||
                                user.IsDeleted)
                            {
                                context.Fail(
                                    "User is inactive or deleted.");

                                return;
                            }


                            if (
                                user.TokenVersion !=
                                tokenVersion)
                            {
                                context.Fail(
                                    "Token version is no longer valid.");

                                return;
                            }


                            var session =
                                await dbContext
                                    .UserSessions
                                    .FirstOrDefaultAsync(
                                        session =>
                                            session.Id ==
                                                sessionId &&
                                            session.UserId ==
                                                userId &&
                                            session.RevokedAt ==
                                                null &&
                                            !session.IsDeleted &&
                                            session.ExpiresAt >
                                                DateTime.UtcNow);


                            if (session is null)
                            {
                                context.Fail(
                                    "Session is no longer valid.");

                                return;
                            }


                            session.LastUsedAt =
                                DateTime.UtcNow;


                            await dbContext
                                .SaveChangesAsync();
                        }
                };
        });


/* =========================================================
   AUTHORIZATION
   ========================================================= */

builder.Services
    .AddAuthorization();


/* =========================================================
   HTTP CONTEXT
   ========================================================= */

builder.Services
    .AddHttpContextAccessor();


/* =========================================================
   SMTP EMAIL
   ========================================================= */

builder.Services
    .Configure<SmtpEmailOptions>(
        builder.Configuration
            .GetSection(
                SmtpEmailOptions.SectionName));


builder.Services
    .AddScoped<
        IEmailService,
        SmtpEmailService>();


/* =========================================================
   CURRENT USER / AUTH
   ========================================================= */

builder.Services
    .AddScoped<
        ICurrentUserService,
        CurrentUserService>();


builder.Services
    .AddScoped<
        IJwtTokenService,
        JwtTokenService>();


builder.Services
    .AddScoped<
        IAuthService,
        AuthService>();


builder.Services
    .AddScoped<
        IPasswordRecoveryService,
        PasswordRecoveryService>();


/* =========================================================
   ADMINISTRATION
   ========================================================= */

builder.Services
    .AddScoped<
        IAdminService,
        AdminService>();


builder.Services
    .AddScoped<
        IAdminDashboardExportService,
        AdminDashboardExportService>();


/* =========================================================
   WORKSPACES
   ========================================================= */

builder.Services
    .AddScoped<
        IWorkspaceService,
        WorkspaceService>();


builder.Services
    .AddScoped<
        IWorkspaceMemberService,
        WorkspaceMemberService>();


/* =========================================================
   PERMISSIONS
   ========================================================= */

builder.Services
    .AddScoped<
        IPermissionService,
        PermissionService>();


builder.Services
    .AddScoped<
        IRolePermissionManagementService,
        RolePermissionManagementService>();


builder.Services
    .AddScoped<
        IUserPermissionManagementService,
        UserPermissionManagementService>();


/* =========================================================
   PROJECTS
   ========================================================= */

builder.Services
    .AddScoped<
        IProjectService,
        ProjectService>();


/* =========================================================
   TASKS
   ========================================================= */

builder.Services
    .AddScoped<
        ITaskService,
        TaskService>();


builder.Services
    .AddScoped<
        ITaskAssigneeService,
        TaskAssigneeService>();


builder.Services
    .AddScoped<
        ITaskCommentService,
        TaskCommentService>();


/* =========================================================
   FILE STORAGE
   ========================================================= */

builder.Services
    .AddSingleton<
        IFileStorageService>(
        serviceProvider =>
        {
            var storageRootPath =
                Path.Combine(
                    builder.Environment
                        .ContentRootPath,
                    "Storage",
                    "TaskAttachments");


            return new FileStorageService(
                storageRootPath);
        });


builder.Services
    .AddScoped<
        ITaskAttachmentService,
        TaskAttachmentService>();


/* =========================================================
   ACTIVITY LOGS
   ========================================================= */

builder.Services
    .AddScoped<
        IActivityLogService,
        ActivityLogService>();


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

builder.Services
    .AddScoped<
        INotificationService,
        NotificationService>();


builder.Services
    .AddScoped<
        INotificationRealtimeService,
        SignalRNotificationRealtimeService>();


/* =========================================================
   SWAGGER
   ========================================================= */

builder.Services
    .AddEndpointsApiExplorer();


builder.Services
    .AddSwaggerGen(
        options =>
        {
            options.SwaggerDoc(
                "v1",
                new OpenApiInfo
                {
                    Title =
                        "TaskManagement.API",

                    Version =
                        "v1"
                });


            options.AddSecurityDefinition(
                "Bearer",
                new OpenApiSecurityScheme
                {
                    Name =
                        "Authorization",

                    Type =
                        SecuritySchemeType.Http,

                    Scheme =
                        "Bearer",

                    BearerFormat =
                        "JWT",

                    In =
                        ParameterLocation.Header,

                    Description =
                        "Enter JWT token only."
                });


            options.AddSecurityRequirement(
                new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference =
                                new OpenApiReference
                                {
                                    Type =
                                        ReferenceType
                                            .SecurityScheme,

                                    Id =
                                        "Bearer"
                                }
                        },
                        Array.Empty<string>()
                    }
                });
        });


var app =
    builder.Build();


/* =========================================================
   DATABASE SEED
   ========================================================= */

using (
    var scope =
        app.Services.CreateScope())
{
    var dbContext =
        scope.ServiceProvider
            .GetRequiredService<
                ApplicationDbContext>();


    await DatabaseSeeder
        .SeedAsync(
            dbContext);
}


/* =========================================================
   PIPELINE
   ========================================================= */

app.UseExceptionHandler();


app.UseSwagger();

app.UseSwaggerUI();


app.UseHttpsRedirection();


app.UseCors(
    "FrontendPolicy");


app.UseAuthentication();

app.UseAuthorization();


app.MapControllers();


app.MapHub<NotificationHub>(
        "/hubs/notifications")
    .RequireCors(
        "FrontendPolicy");


app.Run();