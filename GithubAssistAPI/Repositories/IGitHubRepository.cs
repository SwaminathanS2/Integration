using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace GithubAssistAPI.Repositories
{
    public interface IGitHubRepository
    {
        
        
        Task<JsonNode> CreatePRAsync(
            string token,
           
            string RepoUrl,
            string headBranch,
            string baseBranch);
    }
}
