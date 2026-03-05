namespace GithubAssistAPI.Models
{
    public class GitHubRequest
{
    public string Owner { get; set; } = "";
    public string Repo { get; set; } = "";
    public string FilePath { get; set; } = "";
    public string FeatureName { get; set; } = "";
    public string Token { get; set; } = "";
    public string Branch { get; set; } = "main";
}
}