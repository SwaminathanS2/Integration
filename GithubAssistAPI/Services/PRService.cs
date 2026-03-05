using System.Text.Json.Nodes;
using GithubAssistAPI.Repositories;

namespace GithubAssistAPI.Services;

public class PRService
{
    private readonly IGitHubRepository _repo;

    public PRService(IGitHubRepository repo)
    {
        _repo = repo;
    }



    public Task<JsonNode> CreatePRAsync(string Token, string RepoUrl, string HeadBranch, string BaseBranch)
        => _repo.CreatePRAsync(Token, RepoUrl, HeadBranch, BaseBranch);
}







