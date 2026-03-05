using System.Threading.Tasks;
using GithubAssistAPI.Models;

namespace GithubAssistAPI.Services
{
    public interface IBranchService
    {
        Task<BranchResponse> CreateBranchAsync(BranchRequest request);

        Task<bool> DeleteBranchAsync(BranchContextData ctx);
    }
}