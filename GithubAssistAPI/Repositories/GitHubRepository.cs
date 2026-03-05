using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;

namespace GithubAssistAPI.Repositories
{
    public class GitHubRepository : IGitHubRepository
    {
        private readonly HttpClient _http;

        public GitHubRepository(HttpClient http)
        {
            _http = http ?? throw new ArgumentNullException(nameof(http));

            if (_http.BaseAddress == null)
                _http.BaseAddress = new Uri("https://api.github.com/");

            if (!_http.DefaultRequestHeaders.UserAgent.Any())
                _http.DefaultRequestHeaders.UserAgent.ParseAdd("PRModuleAPI");

            if (!_http.DefaultRequestHeaders.Accept.Any())
                _http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

            if (!_http.DefaultRequestHeaders.Contains("X-GitHub-Api-Version"))
                _http.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
        }

        public async Task<JsonNode> CreatePRAsync(
            string token,
            string repoUrl,
            string headBranch,
            string baseBranch)
        {
            if (string.IsNullOrWhiteSpace(token))
                throw new ArgumentException("Token cannot be empty.", nameof(token));
            if (string.IsNullOrWhiteSpace(repoUrl))
                throw new ArgumentException("RepoUrl cannot be empty.", nameof(repoUrl));
            if (string.IsNullOrWhiteSpace(headBranch))
                throw new ArgumentException("Head branch cannot be empty.", nameof(headBranch));
            if (string.IsNullOrWhiteSpace(baseBranch))
                throw new ArgumentException("Base branch cannot be empty.", nameof(baseBranch));
            if (string.Equals(headBranch, baseBranch, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Head and base branches must be different.");

    
            var (owner, repo) = ParseOwnerAndRepo(repoUrl);

            if (string.IsNullOrWhiteSpace(owner) || string.IsNullOrWhiteSpace(repo))
                throw new ArgumentException($"Could not extract owner/repo from {repoUrl}");

            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);

            var title = $"{headBranch} -> {baseBranch}";
            var payload = new
            {
                title,
                head = headBranch,
                @base = baseBranch
            };

            var jsonBody = System.Text.Json.JsonSerializer.Serialize(payload);
            using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var url = $"repos/{owner}/{repo}/pulls";
            var res = await _http.PostAsync(url, content);
            var responseBody = await res.Content.ReadAsStringAsync();

            if (res.StatusCode == HttpStatusCode.Created)
            {
                var full = JsonNode.Parse(responseBody)!;
                int prNumber = full["number"]!.GetValue<int>();

                return new JsonObject
                {
                    ["message"] = "Pull request created successfully",
                    ["pullRequestNumber"] = prNumber
                };
            }

            throw new Exception(
                $"Create PR failed ({(int)res.StatusCode} {res.StatusCode}): {responseBody}");
        }

        
        private static (string owner, string repo) ParseOwnerAndRepo(string repoUrl)
        {
            if (string.IsNullOrWhiteSpace(repoUrl))
                return ("", "");

            repoUrl = repoUrl.Trim();

            if (Uri.TryCreate(repoUrl, UriKind.Absolute, out var uri))
            {
                // a) Web URLs: https://github.com/owner/repo(.git)
                if (uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase))
                {
                    var path = uri.AbsolutePath.Trim('/');
                    return ExtractOwnerRepoFromPath(path);
                }

                // b) API URLs: https://api.github.com/repos/owner/repo
                if (uri.Host.Equals("api.github.com", StringComparison.OrdinalIgnoreCase))
                {
                  
                    var parts = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
                    
                    if (parts.Length >= 3 && parts[0].Equals("repos", StringComparison.OrdinalIgnoreCase))
                    {
                        var owner = parts[1];
                        var repo = parts[2];
                        if (repo.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                            repo = repo[..^4];
                        return (owner, repo);
                    }
                }
            }

            return ("", "");
        }

        private static (string owner, string repo) ExtractOwnerRepoFromPath(string path)
        {
            var parts = path.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2)
                return ("", "");

            var owner = parts[0];
            var repo = parts[1];

            if (repo.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                repo = repo[..^4];

            return (owner, repo);
        }

    }
}