using GithubAssistAPI.Models;      
using GithubAssistAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace GithubAssistAPI.Controllers;

[ApiController]
[Route("api/github")]
public sealed class GitHubController : ControllerBase
{
    private readonly IGitHubService _gitHubService;

    public GitHubController(IGitHubService gitHubService)
    {
        _gitHubService = gitHubService;
    }

    [HttpPost("connect")]
    public async Task<IActionResult> Connect([FromBody] ConnectRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Pat))
            return BadRequest(new { error = "PAT is required." });

        if (string.IsNullOrWhiteSpace(req.RepoUrl))
            return BadRequest(new { error = "Repository URL is required." });

        try
        {
            await _gitHubService.GetRepoInfoAsync(req.RepoUrl, req.Pat, ct);

            return Ok(new { message = "Connection successful" });
        }
        catch (Exception ex)
        {
            return StatusCode(400, new { error = "Connection test failed.", details = ex.Message });
        }
    }
}