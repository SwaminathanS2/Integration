using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using GithubAssistAPI.Models;

namespace GithubAssistAPI.Services
{
    public class DeprecateService : IDeprecateService
    {
        private readonly HttpClient httpClient;
        private readonly ILogger<DeprecateService> logger;

        public DeprecateService(ILogger<DeprecateService> logger)
        {
            this.logger = logger;
            httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Featurebranch-App");
        }

        public async Task<DeprecateResponse> DeprecateAsync(DeprecateRequest request)
        {
            try
            {
                httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", request.Token);

                // STEP 1: Get file from branch
                var getUrl =
                    $"https://api.github.com/repos/{request.Owner}/{request.Repo}/contents/{request.FilePath}?ref={request.BranchName}";

                var fileResponse = await httpClient.GetAsync(getUrl);

                if (fileResponse.StatusCode == HttpStatusCode.NotFound)
                    return Fail("File not found in branch", "FILE_NOT_FOUND");

                var fileJson = JsonDocument.Parse(
                    await fileResponse.Content.ReadAsStringAsync());

                string fileSha = fileJson.RootElement.GetProperty("sha").GetString()!;
                string encodedContent = fileJson.RootElement.GetProperty("content").GetString()!;

                string rawContent =
                    Encoding.UTF8.GetString(Convert.FromBase64String(encodedContent));

                // STEP 2: Apply your exact deprecation logic
                string updatedContent =
                    ApplyDeprecationLogic(rawContent, request.DeprecatedFeature);

                string updatedBase64 =
                    Convert.ToBase64String(Encoding.UTF8.GetBytes(updatedContent));

                // STEP 3: Commit back to same branch
                var updateUrl =
                    $"https://api.github.com/repos/{request.Owner}/{request.Repo}/contents/{request.FilePath}";

                var payload = new
                {
                    message = $"Deprecated feature {request.DeprecatedFeature}",
                    content = updatedBase64,
                    branch = request.BranchName,
                    sha = fileSha
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");

                var updateResponse = await httpClient.PutAsync(updateUrl, content);

                if (!updateResponse.IsSuccessStatusCode)
                {
                    var error = await updateResponse.Content.ReadAsStringAsync();
                    logger.LogError("Commit failed: {Error}", error);
                    return Fail("Commit failed", "COMMIT_FAILED");
                }

                return new DeprecateResponse
                {
                    IsSuccess = true,
                    Message = $"Feature {request.DeprecatedFeature} deprecated successfully in branch {request.BranchName}"
                };
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Deprecation error");
                return Fail("Unexpected error occurred", "UNKNOWN_ERROR");
            }
        }

        // 🔥 YOUR EXACT LOGIC MOVED HERE
        private string ApplyDeprecationLogic(string content, string DeprecatedFeature)
        {
            var lines = content.Split('\n');
            var output = new List<string>();

            string featurePattern =
                @"\b[A-Za-z_][A-Za-z0-9_]*\s*\.\s*CanExecuteAFeatureFromName\s*\(\s*" +
                Regex.Escape(DeprecatedFeature) +
                @"\s*\)";

            bool commentAdded = false;
            int i = 0;

            while (i < lines.Length)
            {
                string trimmed = lines[i].Trim();

                if (Regex.IsMatch(trimmed, @"^if\b", RegexOptions.IgnoreCase))
                {
                    bool isFeatureMatch =
                        Regex.IsMatch(trimmed, featurePattern, RegexOptions.IgnoreCase);

                    if (isFeatureMatch &&
                        trimmed.IndexOf(" and ", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        if (!commentAdded)
                        {
                            output.Add($"// Feature {DeprecatedFeature} is deprecated");
                            commentAdded = true;
                        }

                        string updatedLine = Regex.Replace(
                            lines[i],
                            featurePattern + @"\s*(and\s*)?",
                            "",
                            RegexOptions.IgnoreCase);

                        updatedLine = Regex.Replace(
                            updatedLine,
                            @"\(\s*and\s*",
                            "(",
                            RegexOptions.IgnoreCase);

                        output.Add(updatedLine);
                        i++;
                        continue;
                    }

                    if (isFeatureMatch && !commentAdded)
                    {
                        output.Add($"// Feature {DeprecatedFeature} is deprecated");
                        commentAdded = true;
                    }

                    if (isFeatureMatch)
                    {
                        i++;
                        int depth = 1;

                        while (i < lines.Length && depth > 0)
                        {
                            trimmed = lines[i].Trim();

                            if (Regex.IsMatch(trimmed, @"^if\b", RegexOptions.IgnoreCase))
                                depth++;
                            else if (trimmed.Equals("endIf", StringComparison.OrdinalIgnoreCase))
                            {
                                depth--;
                                i++;
                                continue;
                            }
                            else if (trimmed.Equals("Else", StringComparison.OrdinalIgnoreCase) && depth == 1)
                            {
                                i++;
                                int skipDepth = 1;

                                while (i < lines.Length && skipDepth > 0)
                                {
                                    trimmed = lines[i].Trim();

                                    if (Regex.IsMatch(trimmed, @"^if\b", RegexOptions.IgnoreCase))
                                        skipDepth++;
                                    else if (trimmed.Equals("endIf", StringComparison.OrdinalIgnoreCase))
                                        skipDepth--;

                                    i++;
                                }

                                break;
                            }
                            else
                            {
                                output.Add(lines[i]);
                            }

                            i++;
                        }

                        continue;
                    }
                }

                output.Add(lines[i]);
                i++;
            }

            return string.Join("\n", output);
        }

        private DeprecateResponse Fail(string message, string code)
        {
            return new DeprecateResponse
            {
                IsSuccess = false,
                Message = message,
                ErrorCode = code
            };
        }
    }
}