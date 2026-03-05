// src/components/pullrequest.js

/**
 * Calls the backend to create a Pull Request.
 * Endpoint (from .NET): POST /api/pr/create
 * Body: { token, repoUrl, headBranch, baseBranch }
 */
export async function createPullRequest({
  token,
  repoUrl,
  headBranch,
  baseBranch = "dev",
  apiBase, // optional – if not provided, we resolve from env (same pattern as Home.js)
}) {
  try {
    if (!apiBase) {
      const backendPort = process.env.REACT_APP_BACKEND_PORT;
      apiBase =
        process.env.REACT_APP_API_BASE ||
        (backendPort ? `http://localhost:${backendPort}` : "http://localhost:5282");
    }

    const endpoint = `${apiBase}/api/pr/create`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        repoUrl,
        headBranch,
        baseBranch,
      }),
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const error = data?.error || text || `HTTP ${res.status}`;
      return { ok: false, error };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}