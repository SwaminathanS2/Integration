using GithubAssistAPI.Models;

namespace GithubAssistAPI.Runtime;

public static class BranchContext
{
    private static readonly object _lock = new();
    private static BranchContextData? _last;

    public static void Set(BranchContextData data)
    {
        ArgumentNullException.ThrowIfNull(data);
        lock (_lock)
        {
            _last = data;
        }
    }

    public static BranchContextData? Get()
    {
        lock (_lock)
        {
            return _last;
        }
    }

    public static bool HasValue()
    {
        lock (_lock)
        {
            return _last is not null &&
                   !string.IsNullOrWhiteSpace(_last.RepoUrl) &&
                   !string.IsNullOrWhiteSpace(_last.FeatureBranch) &&
                   !string.IsNullOrWhiteSpace(_last.PatToken);
        }
    }
}