public class GitHubApiHelper{
    public static string BuildContentUrl(string owner, string repo, string path){
        return $"https://api.github.com/repos/{owner}/{repo}/contents/{path}";
    }
}