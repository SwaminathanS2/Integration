namespace GithubAssistAPI.Models;

public class BranchContextData
{
    public string RepoUrl { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;          
    public string Repo { get; set; } = string.Empty;  
    public string FeatureBranch { get; set; } = string.Empty;
    public string BaseBranch { get; set; } = string.Empty;
    public string PatToken { get; set; } = string.Empty;
    public string? Sha { get; set; }
}