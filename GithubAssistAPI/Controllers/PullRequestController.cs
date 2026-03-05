
using Microsoft.AspNetCore.Mvc;
using GithubAssistAPI.Models;
using GithubAssistAPI.Services;

namespace GithubAssistAPI.Controllers;

[ApiController]
[Route("api/pr")]
public class PullRequestController : ControllerBase
{
    private readonly PRService _service;

    public PullRequestController(PRService service)
    {
        _service = service;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreatePR(CreatePrDto dto)
    {
        try{
             var pr = await _service.CreatePRAsync(dto.Token, dto.RepoUrl, dto.HeadBranch, dto.BaseBranch);
            return Ok(pr);

        }
        catch(Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
        
       
    }
}

