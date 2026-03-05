using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using GithubAssistAPI.Models;

namespace GithubAssistAPI.Services
{
    public class BranchService : IBranchService
    {
        private readonly HttpClient httpClient;
        private readonly ILogger<BranchService> logger;

        public BranchService(ILogger<BranchService> logger)
        {
            this.logger = logger;

            httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Featurebranch-App");
        }

        public async Task<BranchRequest> CreateBranch(CreateBranchRequest request)
        {
            try
            {
                var (owner, repo) = ParseGithubUrl(request.GithubUrl);
                var featureBranch = request.FeatureBranch.Trim();

                httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", request.Token);

                var repoResponse = await httpClient.GetAsync(
                    $"https://api.github.com/repos/{owner}/{repo}");

                if (repoResponse.StatusCode == HttpStatusCode.NotFound)
                    return Fail("Repository or Owner not found", "REPO_NOT_FOUND");

                if (repoResponse.StatusCode == HttpStatusCode.Unauthorized)
                    return Fail("Invalid GitHub token", "INVALID_TOKEN");

                var baseBranchResponse = await httpClient.GetAsync(
                    $"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{request.BaseBranch}");

                if (baseBranchResponse.StatusCode == HttpStatusCode.NotFound)
                    return Fail($"Base branch '{request.BaseBranch}' not found", "BASE_BRANCH_NOT_FOUND");

                var branchCheckResponse = await httpClient.GetAsync(
                    $"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{featureBranch}");

                if (branchCheckResponse.StatusCode == HttpStatusCode.OK)
                    return Fail($"Branch '{featureBranch}' already exists", "BRANCH_EXISTS");

                var baseBranchJson = await baseBranchResponse.Content.ReadAsStringAsync();
                var baseBranchData = JsonDocument.Parse(baseBranchJson);

                var sha = baseBranchData.RootElement
                    .GetProperty("object")
                    .GetProperty("sha")
                    .GetString();

                var payload = new
                {
                    @ref = $"refs/heads/{featureBranch}",
                    sha = sha
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");

                var createResponse = await httpClient.PostAsync(
                    $"https://api.github.com/repos/{owner}/{repo}/git/refs",
                    content);

                if (createResponse.StatusCode != HttpStatusCode.Created)
                {
                    var error = await createResponse.Content.ReadAsStringAsync();
                    logger.LogError("GitHub branch creation failed: {Error}", error);

                    return Fail("Failed to create branch", "CREATION_FAILED");
                }

                return new BranchRequest
                {
                    IsSuccess = true,
                    Message = "Branch created successfully",
                    BranchName = featureBranch,
                    Sha = sha
                };
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Branch creation error");

                return Fail(
                    $"Unexpected error: {ex.Message}",
                    "UNKNOWN_ERROR");
            }
        }

        private (string owner, string repo) ParseGithubUrl(string url)
        {
            var uri = new Uri(url);

            var parts = uri.AbsolutePath
                .Trim('/')
                .Replace(".git", "")
                .Split('/');

            if (parts.Length < 2)
                throw new Exception("Invalid GitHub URL format");

            return (parts[0], parts[1]);
        }

        private BranchRequest Fail(string message, string code)
        {
            return new BranchRequest
            {
                IsSuccess = false,
                Message = message,
                ErrorCode = code
            };
        }
    }
}