using GithubAssistAPI.Models;

namespace GithubAssistAPI.Services
{
    public interface IDeprecationService
    {   // keep for compatibility
        Task<DeprecationBatchResponse> DeprecateBatchAsync(DeprecationRequest request); // NEW
    }
}