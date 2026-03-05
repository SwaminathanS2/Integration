using System.ComponentModel.DataAnnotations;

namespace GithubAssistAPI.Models
{
    // public class OrchestrationOptions
    // {

    //     public bool ProceedIfBranchExists { get; set; } = true;

    //     public bool RollbackOnFailure { get; set; } = false;
    // }

    public class CreateBranchDeprecateRequest
    {
        [Required]
        public BranchRequest Branch { get; set; } = new();

        [Required]
        public DeprecationRequest Deprecation { get; set; } = new();

        //public OrchestrationOptions Options { get; set; } = new();
    }

    public class CreateBranchDeprecateResponse
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public BranchResponse? Branch { get; set; }
        public DeprecationResponse? Deprecation { get; set; }
        public string? ErrorCode { get; set; }
    }
}