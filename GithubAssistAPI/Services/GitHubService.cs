using System.Net.Http.Headers;
using System.Text.Json;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;

namespace GithubAssistAPI.Services
{
    public class GitHubSearchResult
    {
        public List<GitHubSearchItem> Items { get; set; } = new();
    }

    public class GitHubSearchItem
    {
        public string Path { get; set; } = string.Empty;
    }

    public class GitHubService:IGitHubService
    {
        private readonly HttpClient _httpClient;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IHttpClientFactory _factory;

        public GitHubService(IHttpClientFactory factory, HttpClient httpClient, IHttpClientFactory httpClientFactory)
        {
            _factory = factory;
            _httpClient = httpClient;
            _httpClientFactory = httpClientFactory;
        }

        public async Task<string> GetRawFileAsync(
            string owner,
            string repo,
            string path,
            string token,
            string branch = "main")
        {
            var client = _factory.CreateClient();

            if (!string.IsNullOrWhiteSpace(token))
            {
                client.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", token);
            }

            client.DefaultRequestHeaders.UserAgent.ParseAdd("GitHubFeatureViewer");
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/vnd.github.v3.raw"));

            
        
            var url = $"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={Uri.EscapeDataString(branch)}";

            var response = await client.GetAsync(url);

            if (response.IsSuccessStatusCode)
                return await response.Content.ReadAsStringAsync();

            var body = await response.Content.ReadAsStringAsync();
            return $"GitHub Error: {(int)response.StatusCode} {response.StatusCode}. {body}";
        }

        public async Task<List<string>> SearchCodeAsync(string owner, string repo, string featureSwitch, string token)
        {
            var results = new List<string>();
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            _httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("GitHubFeatureSwitchSearchApp", "1.0"));
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));

            int page = 1;
            int perPage = 100;

            while (true)
            {
                var url = $"https://api.github.com/search/code?q={featureSwitch}+repo:{owner}/{repo}&page={page}&per_page={perPage}";
                var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"GitHub API request failed with status code: {response.StatusCode}");
                }

                var json = await response.Content.ReadAsStringAsync();
                var searchResult = JsonSerializer.Deserialize<GitHubSearchResult>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (searchResult?.Items == null || searchResult.Items.Count == 0)
                {
                    break;
                }

                results.AddRange(searchResult.Items.Select(i => i.Path));

                if (searchResult.Items.Count < perPage)
                {
                    break;
                }

                page++;
            }

            return results;
        }

        public string BuildRepoApiUrl(string repoOrUrl)
        {
            if (string.IsNullOrWhiteSpace(repoOrUrl))
                throw new ArgumentException("repoOrUrl is required.", nameof(repoOrUrl));

            static string StripGitSuffix(string s) =>
                s.EndsWith(".git", StringComparison.OrdinalIgnoreCase) ? s[..^4] : s;

            string ownerRepo;

            if (repoOrUrl.Contains("github.com", StringComparison.OrdinalIgnoreCase))
            {
                var uri = new Uri(repoOrUrl);
                var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
                if (segments.Length < 2)
                    throw new ArgumentException("Invalid GitHub repository URL.");

                ownerRepo = $"{segments[0]}/{StripGitSuffix(segments[1])}";
            }
            else
            {
                ownerRepo = StripGitSuffix(repoOrUrl.Trim());
                if (!ownerRepo.Contains('/'))
                    throw new ArgumentException("Use owner/repo or full GitHub URL.");
            }

            return $"https://api.github.com/repos/{ownerRepo}";
        }

        public async Task GetRepoInfoAsync(string repoOrUrl, string pat, CancellationToken ct = default)
        {
            var apiUrl = BuildRepoApiUrl(repoOrUrl);

            var client = _httpClientFactory.CreateClient("github");

            using var req = new HttpRequestMessage(HttpMethod.Get, apiUrl);
            req.Headers.Authorization = new AuthenticationHeaderValue("token", pat);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            req.Headers.TryAddWithoutValidation("X-GitHub-Api-Version", "2022-11-28");

            using var resp = await client.SendAsync(req, ct).ConfigureAwait(false);
            var body = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if (!resp.IsSuccessStatusCode)
                throw new InvalidOperationException($"GitHub call failed ({(int)resp.StatusCode}): {body}");
        }
    }
}
