
namespace GithubAssistAPI.Models;

public class CreatePrDto
{
   
    public string Token { get; set; } = string.Empty;
    
    public string RepoUrl { get; set; } = string.Empty;
    public string HeadBranch { get; set; } = string.Empty;
    public string BaseBranch { get; set; } = string.Empty;
  
}
