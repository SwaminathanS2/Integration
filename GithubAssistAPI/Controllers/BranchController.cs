using Microsoft.AspNetCore.Mvc;
using GithubAssistAPI.Models;
using GithubAssistAPI.Services;

namespace GithubAssistAPI.Controllers
{
    [ApiController]
    [Route("api/branch")]
    public class BranchController : ControllerBase
    {
        private readonly IBranchService branchService;

        public BranchController(IBranchService branchService)
        {
            this.branchService = branchService;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateBranch(CreateBranchRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await branchService.CreateBranch(request);

            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }
    }
}