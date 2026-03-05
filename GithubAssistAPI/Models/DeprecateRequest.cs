using System.ComponentModel.DataAnnotations;

namespace GithubAssistAPI.Models
{
    public class DeprecateRequest
    {
        [Required]
        public string Owner { get; set; } = string.Empty;

        [Required]
        public string Repo { get; set; } = string.Empty;

        [Required]
        public string BranchName { get; set; } = string.Empty;

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string DeprecatedFeature { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;
    }
}