using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Application.DTOs.Projects;
using TaskManagement.Application.Interfaces;

namespace TaskManagement.API.Controllers;

[ApiController]
[Authorize]
[Route("api/workspaces/{workspaceId:int}/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectService _projectService;

    public ProjectsController(
        IProjectService projectService)
    {
        _projectService = projectService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectResponse>>> GetProjects(
        int workspaceId)
    {
        var response =
            await _projectService.GetProjectsAsync(
                workspaceId);

        return Ok(response);
    }

    [HttpGet("{projectId:int}")]
    public async Task<ActionResult<ProjectResponse>> GetProjectById(
        int workspaceId,
        int projectId)
    {
        var response =
            await _projectService.GetProjectByIdAsync(
                workspaceId,
                projectId);

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> CreateProject(
        int workspaceId,
        CreateProjectRequest request)
    {
        var response =
            await _projectService.CreateProjectAsync(
                workspaceId,
                request);

        return Ok(response);
    }

    [HttpPut("{projectId:int}")]
    public async Task<ActionResult<ProjectResponse>> UpdateProject(
        int workspaceId,
        int projectId,
        UpdateProjectRequest request)
    {
        var response =
            await _projectService.UpdateProjectAsync(
                workspaceId,
                projectId,
                request);

        return Ok(response);
    }

    [HttpPut("{projectId:int}/archive")]
    public async Task<IActionResult> ArchiveProject(
        int workspaceId,
        int projectId)
    {
        await _projectService.ArchiveProjectAsync(
            workspaceId,
            projectId);

        return Ok(new
        {
            message = "Project archived successfully.",
            workspaceId,
            projectId
        });
    }

    [HttpDelete("{projectId:int}")]
    public async Task<IActionResult> DeleteProject(
        int workspaceId,
        int projectId)
    {
        await _projectService.DeleteProjectAsync(
            workspaceId,
            projectId);

        return Ok(new
        {
            message = "Project deleted successfully.",
            workspaceId,
            projectId
        });
    }

    [HttpGet("{projectId:int}/members")]
    public async Task<ActionResult<List<ProjectMemberResponse>>>
        GetProjectMembers(
            int workspaceId,
            int projectId)
    {
        var response =
            await _projectService.GetProjectMembersAsync(
                workspaceId,
                projectId);

        return Ok(response);
    }

    [HttpPost("{projectId:int}/members")]
    public async Task<ActionResult<ProjectMemberResponse>>
        AddProjectMember(
            int workspaceId,
            int projectId,
            AddProjectMemberRequest request)
    {
        var response =
            await _projectService.AddProjectMemberAsync(
                workspaceId,
                projectId,
                request);

        return Ok(response);
    }

    [HttpDelete("{projectId:int}/members/{userId:int}")]
    public async Task<IActionResult> RemoveProjectMember(
        int workspaceId,
        int projectId,
        int userId)
    {
        await _projectService.RemoveProjectMemberAsync(
            workspaceId,
            projectId,
            userId);

        return Ok(new
        {
            message = "Project member removed successfully.",
            workspaceId,
            projectId,
            userId
        });
    }
}