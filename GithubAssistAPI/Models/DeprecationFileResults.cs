namespace GithubAssistAPI.Models
{
    public class DeprecationFileResult
    {
        public string FilePath { get; set; } = string.Empty;
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? ErrorCode { get; set; }
        public string? CommitSha { get; set; } // optional; leave null if unchanged or commit not made
    }
}