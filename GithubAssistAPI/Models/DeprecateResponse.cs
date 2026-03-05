namespace GithubAssistAPI.Models
{
    public class DeprecateResponse
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? ErrorCode { get; set; }
    }
}