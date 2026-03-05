using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using GithubAssistAPI.Models;
using GithubAssistAPI.Runtime;

namespace GithubAssistAPI.Services
{
    public class BranchService : IBranchService
    {
        private readonly HttpClient _http;
        private readonly ILogger<BranchService> _logger;

        private const bool StoreContextWhenBranchExists = true;

        public BranchService(ILogger<BranchService> logger)
        {
            _logger = logger;
            _http = new HttpClient();
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("UnifiedAPI-App"); // GitHub requires a UA
        }

        public async Task<BranchResponse> CreateBranchAsync(BranchRequest request)
        {
            try
            {
                var (owner, repo) = ParseGithubUrl(request.RepoUrl);
                var featureBranch = request.FeatureBranch.Trim();

                _http.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", request.PatToken);

                var repoResponse = await _http.GetAsync($"https://api.github.com/repos/{owner}/{repo}");
                if (repoResponse.StatusCode == HttpStatusCode.NotFound)
                    return Fail("Repository or owner not found", "REPO_NOT_FOUND");

                if (repoResponse.StatusCode == HttpStatusCode.Unauthorized)
                    return Fail("Invalid GitHub token", "INVALID_TOKEN");

                var baseBranchResponse = await _http.GetAsync(
                    $"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{request.BaseBranch}");

                if (baseBranchResponse.StatusCode == HttpStatusCode.NotFound)
                    return Fail($"Base branch '{request.BaseBranch}' not found", "BASE_BRANCH_NOT_FOUND");

                if (!baseBranchResponse.IsSuccessStatusCode)
                {
                    var err = await baseBranchResponse.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get base branch ref: {Error}", err);
                    return Fail("Failed to read base branch ref", "BASE_BRANCH_READ_FAILED");
                }

                var branchCheckResponse = await _http.GetAsync(
                    $"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{featureBranch}");

                if (branchCheckResponse.StatusCode == HttpStatusCode.OK)
                {
                    string? existingSha = null;
                    try
                    {
                        var existingJson = JsonDocument.Parse(await branchCheckResponse.Content.ReadAsStringAsync());
                        existingSha = existingJson.RootElement.GetProperty("object").GetProperty("sha").GetString();
                    }
                    catch {}

                    if (StoreContextWhenBranchExists)
                    {

                        BranchContext.Set(new BranchContextData
                        {
                            RepoUrl = request.RepoUrl,
                            Owner = owner,
                            Repo = repo,
                            FeatureBranch = request.FeatureBranch,
                            BaseBranch = request.BaseBranch,
                            PatToken = request.PatToken,
                            Sha = existingSha
                        });
                    }

                    return new BranchResponse
                    {
                        IsSuccess = false,
                        Message = $"Branch '{featureBranch}' already exists.",
                        ErrorCode = "BRANCH_EXISTS",
                        BranchName = featureBranch,
                        Sha = existingSha
                    };
                }

                if (branchCheckResponse.StatusCode != HttpStatusCode.NotFound &&
                    !branchCheckResponse.IsSuccessStatusCode)
                {
                    var err = await branchCheckResponse.Content.ReadAsStringAsync();
                    _logger.LogError("Unexpected response while checking feature branch: {Error}", err);
                    return Fail("Failed to check feature branch existence", "BRANCH_CHECK_FAILED");
                }

                var baseBranchJson = await baseBranchResponse.Content.ReadAsStringAsync();
                var baseBranchData = JsonDocument.Parse(baseBranchJson);
                var sha = baseBranchData.RootElement.GetProperty("object").GetProperty("sha").GetString();

                var payload = new { @ref = $"refs/heads/{featureBranch}", sha };
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                var createResponse = await _http.PostAsync(
                    $"https://api.github.com/repos/{owner}/{repo}/git/refs", content);

                if (createResponse.StatusCode != HttpStatusCode.Created)
                {
                    var error = await createResponse.Content.ReadAsStringAsync();
                    _logger.LogError("GitHub branch creation failed: {Error}", error);
                    return Fail("Failed to create branch", "CREATION_FAILED");
                }

                BranchContext.Set(new BranchContextData
                {
                    RepoUrl = request.RepoUrl,
                    Owner = owner,
                    Repo = repo,
                    FeatureBranch = request.FeatureBranch,
                    BaseBranch = request.BaseBranch,
                    PatToken = request.PatToken,
                    Sha = sha
                });

                return new BranchResponse
                {
                    IsSuccess = true,
                    Message = "Branch created successfully",
                    BranchName = featureBranch,
                    Sha = sha
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Branch creation error");
                return Fail($"Unexpected error: {ex.Message}", "UNKNOWN_ERROR");
            }
        }
        public async Task<bool> DeleteBranchAsync(BranchContextData ctx)
        {
            try
            {
                if (ctx is null ||
                    string.IsNullOrWhiteSpace(ctx.Owner) ||
                    string.IsNullOrWhiteSpace(ctx.Repo) ||
                    string.IsNullOrWhiteSpace(ctx.FeatureBranch) ||
                    string.IsNullOrWhiteSpace(ctx.PatToken))
                {
                    _logger.LogWarning("DeleteBranchAsync: invalid context, cannot delete branch.");
                    return false;
                }

                _http.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", ctx.PatToken);

                var url = $"https://api.github.com/repos/{ctx.Owner}/{ctx.Repo}/git/refs/heads/{ctx.FeatureBranch}";
                var resp = await _http.DeleteAsync(url);

                if (resp.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Deleted branch {Branch} in {Owner}/{Repo}", ctx.FeatureBranch, ctx.Owner, ctx.Repo);
                    return true;
                }

                if (resp.StatusCode == HttpStatusCode.NotFound)
                {
                    // Already removed — treat as success for idempotency.
                    _logger.LogInformation("Branch {Branch} not found. Treating delete as success.", ctx.FeatureBranch);
                    return true;
                }

                var err = await resp.Content.ReadAsStringAsync();
                _logger.LogError("Failed to delete branch {Branch}. Status: {Status}. Error: {Error}",
                    ctx.FeatureBranch, resp.StatusCode, err);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeleteBranchAsync error");
                return false;
            }
        }


        private BranchResponse Fail(string message, string code) =>
            new BranchResponse { IsSuccess = false, Message = message, ErrorCode = code };

        private static (string owner, string repo) ParseGithubUrl(string repoUrl)
        {
            if (string.IsNullOrWhiteSpace(repoUrl))
                throw new ArgumentException("repoUrl cannot be empty", nameof(repoUrl));

            repoUrl = repoUrl.Trim();

            var ssh = Regex.Match(repoUrl, @"^git@github\.com:(?<owner>[^/]+)/(?<name>[^/\.]+)(?:\.git)?$",
                RegexOptions.IgnoreCase);
            if (ssh.Success)
                return (ssh.Groups["owner"].Value, ssh.Groups["name"].Value);


            var https = Regex.Match(repoUrl, @"^https?://github\.com/(?<owner>[^/]+)/(?<name>[^/\.]+)(?:\.git)?/?$",
                RegexOptions.IgnoreCase);
            if (https.Success)
                return (https.Groups["owner"].Value, https.Groups["name"].Value);

            var uri = new Uri(repoUrl);
            var parts = uri.AbsolutePath.Trim('/').Replace(".git", "").Split('/');
            if (parts.Length >= 2)
                return (parts[0], parts[1]);

            throw new InvalidOperationException($"Unsupported GitHub repo URL format: '{repoUrl}'");
        }
    }
}