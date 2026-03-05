public interface IGitHubService
{
    Task<string> GetRawFileAsync(string owner, string repo, string path, string token, string branch = "main");
    string BuildRepoApiUrl(string repoOrUrl);
    Task GetRepoInfoAsync(string repoOrUrl, string pat, CancellationToken ct = default);
    Task<List<string>> SearchCodeAsync(string owner, string repo, string featureSwitch, string token);
}