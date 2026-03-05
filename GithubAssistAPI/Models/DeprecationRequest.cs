namespace GithubAssistAPI.Models
{
    public class DeprecationRequest
    {


        public List<string>? FilePaths { get; set; }

        public string FeatureSwitchName { get; set; } = string.Empty;
    }
}