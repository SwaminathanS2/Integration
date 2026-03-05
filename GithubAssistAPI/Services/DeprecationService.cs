using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using GithubAssistAPI.Models;
using GithubAssistAPI.Runtime;

namespace GithubAssistAPI.Services
{
    public class DeprecationService : IDeprecationService
    {
        private readonly HttpClient _http;
        private readonly ILogger<DeprecationService> _logger;

        public DeprecationService(ILogger<DeprecationService> logger)
        {
            _logger = logger;
            _http = new HttpClient();
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("UnifiedAPI-App"); // GitHub requires a UA
        }

        public async Task<DeprecationBatchResponse> DeprecateBatchAsync(DeprecationRequest request)
        {
            try
            {
                if (request is null)
                {
                    return new DeprecationBatchResponse
                    {
                        IsSuccess = false,
                        Message = "Request body is required.",
                        ErrorCode = "VALIDATION_ERROR",
                        Results = new List<DeprecationFileResult>()
                    };
                }

                if (string.IsNullOrWhiteSpace(request.FeatureSwitchName))
                {
                    return new DeprecationBatchResponse
                    {
                        IsSuccess = false,
                        Message = "featureSwitchName is required.",
                        ErrorCode = "VALIDATION_ERROR",
                        Results = new List<DeprecationFileResult>()
                    };
                }

                var targets = new List<string>();
                if (request.FilePaths is not null && request.FilePaths.Count > 0)
                    targets.AddRange(request.FilePaths.Where(p => !string.IsNullOrWhiteSpace(p)));
                

                if (targets.Count == 0)
                {
                    return new DeprecationBatchResponse
                    {
                        IsSuccess = false,
                        Message = "No file paths provided.",
                        ErrorCode = "VALIDATION_ERROR",
                        Results = new List<DeprecationFileResult>()
                    };
                }

                // ---- Context
                var ctx = BranchContext.Get();
                if (ctx is null)
                {
                    return new DeprecationBatchResponse
                    {
                        IsSuccess = false,
                        Message = "No branch metadata found. Create a branch first via /api/branch/create.",
                        ErrorCode = "NO_CONTEXT",
                        Results = new List<DeprecationFileResult>()
                    };
                }

                if (string.IsNullOrWhiteSpace(ctx.Owner) || string.IsNullOrWhiteSpace(ctx.Repo))
                {
                    return new DeprecationBatchResponse
                    {
                        IsSuccess = false,
                        Message = "Context is missing owner/repo. Recreate the branch to refresh context.",
                        ErrorCode = "BAD_CONTEXT",
                        Results = new List<DeprecationFileResult>()
                    };
                }

                _http.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", ctx.PatToken);

                // ---- Process each file (sequentially; one commit per file with GitHub Contents API)
                var results = new List<DeprecationFileResult>();
                foreach (var path in targets)
                {
                    var single = await ProcessSingleFileAsync(ctx, path, request.FeatureSwitchName);
                    results.Add(single);
                }

                var anyFailed = results.Any(r => !r.IsSuccess);
                var allFailed = results.All(r => !r.IsSuccess);

                var response = new DeprecationBatchResponse
                {
                    IsSuccess = !anyFailed,
                    Results = results,
                    Message = anyFailed
                        ? (allFailed ? "Deprecation failed for all files." : "Deprecation completed with partial failures.")
                        : "Deprecation completed successfully for all files.",
                    ErrorCode = anyFailed ? (allFailed ? "ALL_FAILED" : "PARTIAL_FAILURE") : null
                };

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deprecation batch error");
                return new DeprecationBatchResponse
                {
                    IsSuccess = false,
                    Message = "Unexpected error occurred",
                    ErrorCode = "UNKNOWN_ERROR",
                    Results = new List<DeprecationFileResult>()
                };
            }
        }

        // ===============================================
        // Backward compatible: single-file deprecation API
        // ===============================================
        
        // ==========================================
        // NEW: Single-file helper used by batch flow
        // ==========================================
        private async Task<DeprecationFileResult> ProcessSingleFileAsync(BranchContextData ctx, string filePath, string featureSwitchName)
        {
            var owner = ctx.Owner;
            var repo = ctx.Repo;

            var getUrl =
                $"https://api.github.com/repos/{owner}/{repo}/contents/{filePath}?ref={ctx.FeatureBranch}";

            var fileResponse = await _http.GetAsync(getUrl);

            if (fileResponse.StatusCode == HttpStatusCode.NotFound)
            {
                return new DeprecationFileResult
                {
                    FilePath = filePath,
                    IsSuccess = false,
                    Message = $"File '{filePath}' not found in branch '{ctx.FeatureBranch}'.",
                    ErrorCode = "FILE_NOT_FOUND"
                };
            }

            if (!fileResponse.IsSuccessStatusCode)
            {
                var err = await fileResponse.Content.ReadAsStringAsync();
                _logger.LogError("GitHub get file failed ({File}): {Error}", filePath, err);
                return new DeprecationFileResult
                {
                    FilePath = filePath,
                    IsSuccess = false,
                    Message = "Failed to fetch file.",
                    ErrorCode = "GET_FAILED"
                };
            }

            var fileJson = JsonDocument.Parse(await fileResponse.Content.ReadAsStringAsync());
            string fileSha = fileJson.RootElement.GetProperty("sha").GetString()!;
            string encodedContent = fileJson.RootElement.GetProperty("content").GetString() ?? string.Empty;

            encodedContent = encodedContent.Replace("\n", "").Replace("\r", "");
            string rawContent = Encoding.UTF8.GetString(Convert.FromBase64String(encodedContent));

            string updatedContent = ApplyDeprecationLogic(rawContent, featureSwitchName);

            if (updatedContent == rawContent)
            {
                return new DeprecationFileResult
                {
                    FilePath = filePath,
                    IsSuccess = true,
                    Message = "No changes required (content unchanged after deprecation logic).",
                    ErrorCode = null,
                    CommitSha = null
                };
            }

            string updatedBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(updatedContent));
            var updateUrl = $"https://api.github.com/repos/{owner}/{repo}/contents/{filePath}";

            var payload = new
            {
                message = $"Deprecated feature {featureSwitchName}",
                content = updatedBase64,
                branch = ctx.FeatureBranch,
                sha = fileSha
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var updateResponse = await _http.PutAsync(updateUrl, content);

            if (!updateResponse.IsSuccessStatusCode)
            {
                var error = await updateResponse.Content.ReadAsStringAsync();
                _logger.LogError("Commit failed ({File}): {Error}", filePath, error);
                return new DeprecationFileResult
                {
                    FilePath = filePath,
                    IsSuccess = false,
                    Message = "Commit failed",
                    ErrorCode = "COMMIT_FAILED"
                };
            }

            string? commitSha = null;
            try
            {
                var updateJson = JsonDocument.Parse(await updateResponse.Content.ReadAsStringAsync());
                commitSha = updateJson.RootElement.GetProperty("commit").GetProperty("sha").GetString();
            }
            catch
            {
                // ignore parse error
            }

            return new DeprecationFileResult
            {
                FilePath = filePath,
                IsSuccess = true,
                Message = $"Feature {featureSwitchName} deprecated successfully in branch {ctx.FeatureBranch}.",
                ErrorCode = null,
                CommitSha = commitSha
            };
        }

        // =========================
        // Existing transformation
        // =========================
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

        private DeprecationResponse Fail(string message, string code) =>
            new DeprecationResponse { IsSuccess = false, Message = message, ErrorCode = code };
    }
}