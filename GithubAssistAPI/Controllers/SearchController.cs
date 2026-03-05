using Microsoft.AspNetCore.Mvc;
[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly ISearchService _searchService;

    public SearchController(ISearchService searchService)
    {
        _searchService = searchService;
    }

    [HttpPost]
    public async Task<IActionResult> Search([FromBody] SearchRequest request)
    {
        var results = await _searchService.SearchAsync(request);
        return Ok(results);
    }
}