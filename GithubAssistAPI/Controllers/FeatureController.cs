using Microsoft.AspNetCore.Mvc;
using GithubAssistAPI.Services;
using GithubAssistAPI.Models;

namespace GithubAssistAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeatureController : ControllerBase
    {
        private readonly IGitHubService _gitHubService;

        public FeatureController(IGitHubService gitHubService)
        {
            _gitHubService = gitHubService;
        }

        [HttpPost("raw")]
public async Task<IActionResult> GetRawFileAsync([FromBody] GitHubRequest request)
{
    // Prefer Authorization header
    var authHeader = Request.Headers["Authorization"].ToString();
    string? headerToken = null;

    if (!string.IsNullOrWhiteSpace(authHeader) &&
        authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        headerToken = authHeader.Substring("Bearer ".Length).Trim();
    }

    // Choose effective token (header > body)
    var effectiveToken = !string.IsNullOrWhiteSpace(headerToken) ? headerToken : request.Token;

    // Validate required params
    if (string.IsNullOrWhiteSpace(request.Owner) ||
        string.IsNullOrWhiteSpace(request.Repo) ||
        string.IsNullOrWhiteSpace(request.FilePath))
    {
        return BadRequest("Parameters 'Owner', 'Repo', and 'FilePath' are required.");
    }

    var content = await _gitHubService.GetRawFileAsync(
        request.Owner.Trim(),
        request.Repo.Trim(),
        request.FilePath.Trim().TrimStart('/'),
        effectiveToken ?? string.Empty,
        string.IsNullOrWhiteSpace(request.Branch) ? "main" : request.Branch.Trim()
    );

    return Content(content, "text/plain");
}

    }
}