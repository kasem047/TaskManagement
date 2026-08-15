using System.Security.Claims;
using System.Text;
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

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Centralized model validation responses.
builder.Services
    .AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var problemDetails =
                new ValidationProblemDetails(
                    context.ModelState)
                {
                    Title = "Validation failed.",
                    Status =
                        StatusCodes.Status400BadRequest,
                    Detail =
                        "One or more validation errors occurred.",
                    Instance =
                        context.HttpContext.Request.Path
                };

            problemDetails.Extensions["traceId"] =
                context.HttpContext.TraceIdentifier;

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

// SignalR
builder.Services.AddSignalR();

// CORS
// Allows the Angular development application
// to communicate with the hosted API.
// When the final frontend domain is known,
// it can be added here as another allowed origin.
builder.Services.AddCors(options =>
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

// Task reminders
builder.Services.AddHostedService<
    TaskReminderBackgroundService>();

// Global exception handling and standardized ProblemDetails responses
builder.Services.AddExceptionHandler<
    GlobalExceptionHandler>();

builder.Services.AddProblemDetails();

// Database
builder.Services.AddDbContext<
    ApplicationDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration
                .GetConnectionString(
                    "DefaultConnection")));

builder.Services.AddScoped<
    IApplicationDbContext>(serviceProvider =>
        serviceProvider
            .GetRequiredService<
                ApplicationDbContext>());

// Required by Identity SecurityStampValidator
// in the current application setup.
builder.Services.AddSingleton(
    TimeProvider.System);

// Identity
builder.Services
    .AddIdentityCore<User>(options =>
    {
        options.Password.RequiredLength =
            6;

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
    .AddSignInManager();

// JWT configuration
var jwtKey =
    builder.Configuration["Jwt:Key"];

var jwtIssuer =
    builder.Configuration["Jwt:Issuer"];

var jwtAudience =
    builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(
        jwtKey))
{
    throw new InvalidOperationException(
        "JWT Key is not configured.");
}

// Authentication
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults
                .AuthenticationScheme;

        options.DefaultChallengeScheme =
            JwtBearerDefaults
                .AuthenticationScheme;
    })
    .AddJwtBearer(options =>
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
                        Encoding.UTF8.GetBytes(
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

                        if (!string.IsNullOrEmpty(
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

                        if (!int.TryParse(
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
                            await dbContext.Users
                                .FirstOrDefaultAsync(
                                    user =>
                                        user.Id ==
                                        userId);

                        if (user is null ||
                            !user.IsActive ||
                            user.IsDeleted)
                        {
                            context.Fail(
                                "User is inactive or deleted.");

                            return;
                        }

                        if (user.TokenVersion !=
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

// Authorization
builder.Services.AddAuthorization();

// HTTP context
builder.Services
    .AddHttpContextAccessor();

// Current user
builder.Services.AddScoped<
    ICurrentUserService,
    CurrentUserService>();

// JWT token service
builder.Services.AddScoped<
    IJwtTokenService,
    JwtTokenService>();

// Authentication service
builder.Services.AddScoped<
    IAuthService,
    AuthService>();

// System administration
builder.Services.AddScoped<
    IAdminService,
    AdminService>();

builder.Services.AddScoped<
    IAdminDashboardExportService,
    AdminDashboardExportService>();

// Workspace
builder.Services.AddScoped<
    IWorkspaceService,
    WorkspaceService>();

// Workspace members
builder.Services.AddScoped<
    IWorkspaceMemberService,
    WorkspaceMemberService>();

// Runtime permission checking
builder.Services.AddScoped<
    IPermissionService,
    PermissionService>();

// Global Role -> Permission management.
// System Administrator only.
builder.Services.AddScoped<
    IRolePermissionManagementService,
    RolePermissionManagementService>();

// Per-user permission overrides inside a workspace.
// WorkspaceOwner or SystemAdministrator.
builder.Services.AddScoped<
    IUserPermissionManagementService,
    UserPermissionManagementService>();

// Projects
builder.Services.AddScoped<
    IProjectService,
    ProjectService>();

// Tasks
builder.Services.AddScoped<
    ITaskService,
    TaskService>();

// Task assignees
builder.Services.AddScoped<
    ITaskAssigneeService,
    TaskAssigneeService>();

// Task comments
builder.Services.AddScoped<
    ITaskCommentService,
    TaskCommentService>();

// File storage
builder.Services.AddSingleton<
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

// Task attachments
builder.Services.AddScoped<
    ITaskAttachmentService,
    TaskAttachmentService>();

// Activity logging
builder.Services.AddScoped<
    IActivityLogService,
    ActivityLogService>();

// Notifications
builder.Services.AddScoped<
    INotificationService,
    NotificationService>();

// Realtime notifications
builder.Services.AddScoped<
    INotificationRealtimeService,
    SignalRNotificationRealtimeService>();

// Swagger
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(
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
                    "Enter JWT token only. Example: eyJhbGciOiJIUzI1NiIs..."
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

// Seed database
using (var scope =
       app.Services.CreateScope())
{
    var dbContext =
        scope.ServiceProvider
            .GetRequiredService<
                ApplicationDbContext>();

    await DatabaseSeeder.SeedAsync(
        dbContext);
}

// Handle all unhandled exceptions globally.
app.UseExceptionHandler();

// Swagger is enabled for the hosted API
// so it can be tested during development and project presentation.
app.UseSwagger();

app.UseSwaggerUI();

app.UseHttpsRedirection();

// CORS must run before authentication/authorization
// for requests coming from the Angular frontend.
app.UseCors(
    "FrontendPolicy");

app.UseAuthentication();

app.UseAuthorization();

// API Controllers
app.MapControllers();

// SignalR notifications hub
app.MapHub<NotificationHub>(
        "/hubs/notifications")
    .RequireCors(
        "FrontendPolicy");

app.Run();