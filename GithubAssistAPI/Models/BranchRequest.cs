namespace GithubAssistAPI.Models
{
    public class BranchRequest
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? BranchName { get; set; }
        public string? Sha { get; set; }
        public string? ErrorCode { get; set; }
    }
}