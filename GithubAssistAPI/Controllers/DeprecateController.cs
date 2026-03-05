using GithubAssistAPI.Models;
using GithubAssistAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace GithubAssistAPI.Controllers
{
    [ApiController]
    [Route("api/deprecate")]
    public class DeprecateController : ControllerBase
    {
        private readonly IDeprecateService deprecateService;

        public DeprecateController(IDeprecateService deprecateService)
        {
            this.deprecateService = deprecateService;
        }

        [HttpPost]
        public async Task<IActionResult> Deprecate(DeprecateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await deprecateService.DeprecateAsync(request);

            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }
    }
}