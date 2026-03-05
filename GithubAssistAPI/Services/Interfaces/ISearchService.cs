public interface ISearchService{
    Task<SearchResponse> SearchAsync(SearchRequest request);
}