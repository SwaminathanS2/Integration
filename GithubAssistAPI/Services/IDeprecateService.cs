using GithubAssistAPI.Models;

namespace GithubAssistAPI.Services
{
    public interface IDeprecateService
    {
        Task<DeprecateResponse> DeprecateAsync(DeprecateRequest request);
    }
}