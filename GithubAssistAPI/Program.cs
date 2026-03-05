using GithubAssistAPI.Services;
using GithubAssistAPI.Services;   // <-- your services namespace
using GithubAssistAPI.Repositories;
using Microsoft.AspNetCore.HttpOverrides;
// using Microsoft.AspNetCore.CookiePolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Http;
using System.Net.Http.Headers;


var builder = WebApplication.CreateBuilder(args);

// Register controllers
builder.Services.AddControllers();

// Register your services
builder.Services.AddScoped<IDeprecationService, DeprecationService>();
builder.Services.AddScoped<IBranchService, BranchService>();
builder.Services.AddScoped<ISearchService, SearchService>();
builder.Services.AddScoped<IGitHubService, GitHubService>();
builder.Services.AddScoped<PRService>();

// Register repositories
builder.Services.AddHttpClient<IGitHubRepository, GitHubRepository>();

// HttpClient for GitHub API
builder.Services.AddHttpClient("github", client =>
{
    client.BaseAddress = new Uri("https://api.github.com/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("ConnectivityApp/1.0");
    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
});

builder.Services.AddScoped<IGitHubService, GitHubService>();
// Swagger setup
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Github Assist API",
        Version = "v1",
        Description = "API for GitHub branch creation and deprecation"
    });
});

const string FrontendCorsPolicy = "FrontendOnly";
var allowedOrigins = new[]
{
    "http://localhost:3000",
    // "https://localhost:3000",
};

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: FrontendCorsPolicy, policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .WithHeaders(
                "Content-Type",
                "Authorization",
                "X-Pat-Token",
                "X-GitHub-Token",
                "X-GitHub-Repo"
            )
            .WithExposedHeaders("Location", "X-RateLimit-Remaining");
    });
});

builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Github Assist API v1");
    });
}
app.UseForwardedHeaders();
app.UseCors(FrontendCorsPolicy);
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.MapControllers();

app.Run();
