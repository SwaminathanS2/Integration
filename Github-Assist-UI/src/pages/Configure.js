// src/pages/Configure.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const CLASSIC_PAT = /^(?:gh[pous]|ghe)_[A-Za-z0-9]{36}$/; // ghp_ + 36 chars = 40 total
const isValidToken = (value) => !!value && CLASSIC_PAT.test(value);
const GITHUB_REPO_URL = /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

const apiBase = process.env.REACT_APP_API_BASE || "";

function joinUrl(base, path) {
  if (!base) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

export default function Configure() {
  const navigate = useNavigate();

  const [repoUrl, setRepoUrl] = useState("");
  const [patToken, setPatToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [urlError, setUrlError] = useState("");
  const [connectivityError, setConnectivityError] = useState("");

  // Prefill from localStorage if available
  useEffect(() => {
    const raw = localStorage.getItem("appConfig");
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw);
      if (cfg?.repoUrl) setRepoUrl(cfg.repoUrl);
      if (cfg?.token) setPatToken(cfg.token);
    } catch {
      /* ignore */
    }
  }, []);

  const onTokenChange = (e) => {
    const v = e.target.value.trim();
    setPatToken(v);
    setTokenError(
      v ? (isValidToken(v) ? "" : "Invalid GitHub token format.") : "Token is required."
    );
  };

  const onUrlChange = (e) => {
    const v = e.target.value.trim();
    setRepoUrl(v);
    setUrlError(
      v
        ? GITHUB_REPO_URL.test(v)
          ? ""
          : "Invalid GitHub repository URL."
        : "Repository URL is required."
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setConnectivityError("");

    const url = repoUrl.trim().replace(/\/+$/, "");
    const token = patToken.trim();

    // Validate
    if (!url) {
      setUrlError("Repository URL is required.");
      setLoading(false);
      return;
    }
    if (!GITHUB_REPO_URL.test(url)) {
      setUrlError(
        "Please enter a valid GitHub repository URL, e.g., https://github.com/owner/repo"
      );
      setLoading(false);
      return;
    }
    if (!token) {
      setTokenError("Token is required.");
      setLoading(false);
      return;
    }
    if (!isValidToken(token)) {
      setTokenError("Invalid token format.");
      setLoading(false);
      return;
    }

    try {
      // Save baseline so rest of app can read if needed
      localStorage.setItem("appConfig", JSON.stringify({ repoUrl: url, token }));
      localStorage.setItem("configured", "true");

      // Call your backend: POST /api/github/connect
      const endpoint = joinUrl(apiBase, "/api/github/connect");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl: url, pat: token }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        // Always treat as connectivity failure without exposing server details
        throw new Error("CONNECTIVITY_FAILURE");
      }

      const data = await resp.json().catch(() => ({}));
      // Your controller returns { message: "Connection successful" } on 200
      const connectivityMessage = data?.message || "Connectivity check completed.";

      // Store message for Home one-time toast
      const prev = JSON.parse(localStorage.getItem("appConfig") || "{}");
      localStorage.setItem(
        "appConfig",
        JSON.stringify({
          ...prev,
          repoUrl: url,
          token,
          connectivityMessage,
          connectivityCheckedAt: new Date().toISOString(),
        })
      );

      // Prevent welcome splash
      sessionStorage.setItem("seenWelcome", "1");

      // Navigate ONLY on success
      navigate("/?skipWelcome=1", { replace: true, state: { skipWelcome: true } });
    } catch (err) {
      // Always show the same message for connectivity-related failures
      setConnectivityError("Connectivity failed. Check the PAT token and URL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content">
      <div className="configure-center">
        <div className="card wide">
          <h2 className="card-title">GitHub Repository Info</h2>
          <form className="form" onSubmit={handleSubmit} noValidate>
            <label className="label">
              GitHub Repository URL
              <input
                className="input"
                type="url"
                placeholder="Enter GitHub repo URL (e.g., https://github.com/owner/repo)"
                value={repoUrl}
                onChange={onUrlChange}
                autoComplete="off"
                required
              />
            </label>
            {urlError && <div className="error">{urlError}</div>}

            <label className="label">
              Personal Access Token
              <input
                className="input2"
                type="password"
                placeholder="Enter Personal Access Token"
                value={patToken}
                onChange={onTokenChange}
                autoComplete="off"
                required
                // React expects a string for pattern. Using the regex source string.
                pattern={CLASSIC_PAT.source}
              />
            </label>
            {tokenError && <div className="error">{tokenError}</div>}

            {connectivityError && (
              <span className="error inline" role="alert" aria-live="assertive">
                {connectivityError}
              </span>
            )}

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
