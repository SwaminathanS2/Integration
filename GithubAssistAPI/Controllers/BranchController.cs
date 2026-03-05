using Microsoft.AspNetCore.Mvc;
using GithubAssistAPI.Models;
using GithubAssistAPI.Services;
using GithubAssistAPI.Runtime;

namespace GithubAssistAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BranchController : ControllerBase
{
    private readonly IBranchService _branchService;
    private readonly IDeprecationService _deprecationService;
    private readonly ILogger<BranchController> _logger;

    public BranchController(IBranchService branchService,
                            IDeprecationService deprecationService,
                            ILogger<BranchController> logger)
    {
        _branchService = branchService;
        _deprecationService = deprecationService;
        _logger = logger;
    }

    [HttpPost("create-deprecate")]
    public async Task<IActionResult> CreateAndDeprecate([FromBody] CreateBranchDeprecateRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        bool createdInThisCall = false;

        // Try to create branch
        var branchResp = await _branchService.CreateBranchAsync(request.Branch);
        createdInThisCall = branchResp.IsSuccess;

        // Internal branch existence check (no longer depends on request.Options)
        var canProceed = branchResp.IsSuccess ||
                         string.Equals(branchResp.ErrorCode, "BRANCH_EXISTS", StringComparison.OrdinalIgnoreCase);

        if (!canProceed)
        {
            return BadRequest(new SimpleCombinedResponse
            {
                IsSuccess = false,
                Message = $"Branch creation failed: {branchResp.Message}",
                ErrorCode = branchResp.ErrorCode ?? "BRANCH_CREATE_FAILED"
            });
        }

        // Deprecation logic
        var batch = await _deprecationService.DeprecateBatchAsync(request.Deprecation);

        if (!batch.IsSuccess)
        {
            // Always rollback if branch was created in this call
            if (createdInThisCall)
            {
                var ctx = BranchContext.Get();
                if (ctx != null)
                {
                    try
                    {
                        await _branchService.DeleteBranchAsync(ctx);
                        _logger.LogInformation("Rollback: deleted branch {Branch}", ctx.FeatureBranch);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Rollback (delete branch) failed for branch {Branch}", ctx?.FeatureBranch);
                    }
                }
            }

            var code = string.IsNullOrWhiteSpace(batch.ErrorCode) ? "DEPRECATION_FAILED" : batch.ErrorCode;

            return StatusCode(StatusCodes.Status422UnprocessableEntity, new SimpleCombinedResponse
            {
                IsSuccess = false,
                Message = batch.Message,
                ErrorCode = code
            });
        }

        return Ok(new SimpleCombinedResponse
        {
            IsSuccess = true,
            Message = "Branch created (or exists) and deprecation completed successfully.",
            ErrorCode = null
        });
    }
}
