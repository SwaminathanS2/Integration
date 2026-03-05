using System.ComponentModel.DataAnnotations;

namespace GithubAssistAPI.Models
{
    public class CreateBranchRequest
    {
        [Required]
        public string GithubUrl { get; set; } = string.Empty;

        [Required]
        public string BaseBranch { get; set; } = string.Empty;

        [Required]
        public string FeatureBranch { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;
    }
}