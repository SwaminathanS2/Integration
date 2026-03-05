using GithubAssistAPI.Models;

namespace GithubAssistAPI.Services
{
    public interface IBranchService
    {
        Task<BranchRequest> CreateBranch(CreateBranchRequest request);
    }
}