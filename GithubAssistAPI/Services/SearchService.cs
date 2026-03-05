public class SearchService : ISearchService
{
    private readonly IGitHubService _gitHubService;

    public SearchService(IGitHubService gitHubService)
    {
        _gitHubService = gitHubService;
    }

    public async Task<SearchResponse> SearchAsync(SearchRequest request)
    {
        const string prefix = "https://github.com/";

        string trimmed = request.RepoURL.Replace(prefix, "");

        var parts = trimmed.Split('/');
        string owner = parts[0];
        string repo = parts[1].Replace(".git", "");
        var files = await _gitHubService.SearchCodeAsync(owner, repo, request.FeatureSwitchName, request.AccessToken);
        return new SearchResponse
        {
            FileNames = files
        };
    }
}