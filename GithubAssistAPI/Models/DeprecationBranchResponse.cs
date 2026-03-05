namespace GithubAssistAPI.Models
{
    public class DeprecationBatchResponse
    {
        public bool IsSuccess { get; set; }                   // true if all succeeded
        public string Message { get; set; } = string.Empty;   // summary
        public string? ErrorCode { get; set; }                // PARTIAL_FAILURE | ALL_FAILED | ...
        public List<DeprecationFileResult> Results { get; set; } = new();
    }
}