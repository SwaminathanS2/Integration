public class GitHubSearchResult{
    public int Total_Count { get; set; }
    public List<GitHubSearchItem> Items { get; set; }
}

public class GitHubSearchItem{
    public string Name { get; set; }
    public string Path { get; set; }

}