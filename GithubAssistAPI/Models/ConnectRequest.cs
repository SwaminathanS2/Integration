namespace GithubAssistAPI.Models;

public sealed class ConnectRequest
{
    public string RepoUrl { get; set; } = string.Empty;
    public string Pat { get; set; } = string.Empty;
}