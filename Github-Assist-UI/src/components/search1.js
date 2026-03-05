// src/components/search1.js
import React from "react";

/**
 * Centralized search UI + API utilities for Feature Switch lookup (post-deprecation view).
 * - Exports <FeatureFilesCard /> UI component (title: "List of Files deprecated")
 * - Exports searchFeatureFiles() and helpers
 * - Encapsulates endpoint resolution and robust JSON parsing
 */

/* ------------------------- Inline styles for the feature files card ------------------------- */
const cardStyles = {
  wrapper: { margin: "8px 0" },
  card: {
    background: "#fff",
    border: "2px solid #1e90ff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
    overflow: "visible", // no inner scrollbars; let outer chat scroll
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  title: { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#222" },
  list: {
    listStyle: "none",
    padding: 0,
    margin: "8px 0 0 0",
    maxHeight: "none",
    overflow: "visible", // avoid nested scrollbar
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 4px",
    borderBottom: "1px dotted #d3d3d3",
  },
  lastRow: { borderBottom: "none" },
  fileName: {
    color: "#2c2c2c",
    fontSize: "0.95rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: 12,
    maxWidth: "70%",
  },
  viewBtn: {
    background: "#fff",
    color: "#1e90ff",
    border: "1px solid #cfe7ff",
    padding: "6px 12px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
  },
  footer: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
    color: "#555",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
};

/** Presentational card used inside the chat stream (post-deprecation). */
export function FeatureFilesCard({ files, onView }) {
  return (
    <div style={cardStyles.wrapper}>
      <div
        style={cardStyles.card}
        aria-label="List of Files deprecated"
      >
        <div style={cardStyles.header}>
          {/* Title only (no refresh) */}
          <h3 style={cardStyles.title}>List of Files deprecated</h3>
        </div>

        <ul style={cardStyles.list}>
          {files.map((name, i) => (
            <li
              key={`${name}-${i}`}
              style={{
                ...cardStyles.row,
                ...(i === files.length - 1 ? cardStyles.lastRow : null),
              }}
            >
              <span style={cardStyles.fileName} title={name}>
                {name}
              </span>
              <button
                type="button"
                style={cardStyles.viewBtn}
                onClick={() => onView?.(name)}
                aria-label={`View ${name}`}
                title="View"
              >
                View
              </button>
            </li>
          ))}
        </ul>

        {/* ✅ Count in footer (last) */}
        <div style={cardStyles.footer}>
          {files.length} {files.length === 1 ? "file found" : "files found"}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- API helpers --------------------------- */

// Resolve API base and search endpoint once, using the same logic as Home.js
const backendPort = process.env.REACT_APP_BACKEND_PORT;
const apiBase =
  process.env.REACT_APP_API_BASE ||
  (backendPort ? `http://localhost:${backendPort}` : "http://localhost:5282");

// Your backend endpoint is POST /api/search (SearchController)
const searchApi = process.env.REACT_APP_SEARCH_API || `${apiBase}/api/search`;

/**
 * Extracts file names from various possible JSON shapes.
 * Primary shape: { fileNames: string[] }
 * But supports several fallbacks to be defensive with backend responses.
 *
 * @param {any} json
 * @returns {string[]}
 */
export function extractFiles(json) {
  if (!json) return [];

  // ✅ Primary API shape
  if (Array.isArray(json.fileNames)) return json.fileNames;

  // Common fallbacks
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.files)) return json.files;
  if (json.data && Array.isArray(json.data.files)) return json.data.files;
  if (json.result && Array.isArray(json.result.files)) return json.result.files;

  // Nested "json" wrapper (string or object)
  if (json.json) {
    let inner = json.json;
    if (typeof inner === "string") {
      try {
        inner = JSON.parse(inner);
      } catch {
        inner = null;
      }
    }
    if (inner) {
      if (Array.isArray(inner.fileNames)) return inner.fileNames;
      if (Array.isArray(inner.files)) return inner.files;
      if (inner.data && Array.isArray(inner.data.files)) return inner.data.files;
      if (inner.result && Array.isArray(inner.result.files)) return inner.result.files;
    }
  }

  return [];
}

/**
 * Builds the payload to EXACTLY match your C# SearchRequest.
 * @param {string} featureSwitchName
 * @param {string} repoUrl
 * @param {string} token
 */
export function buildSearchRequest(featureSwitchName, repoUrl, token) {
  return {
    RepoURL: repoUrl || "",
    AccessToken: token || "",
    FeatureSwitchName: featureSwitchName,
  };
}

/**
 * Calls the backend search API and returns an array of file names.
 * Never throws—returns [] on any failure to keep the UI resilient.
 *
 * @param {string} featureSwitchName
 * @param {{ repoUrl?: string, token?: string }} cfg
 * @returns {Promise<string[]>}
 */
export async function searchFeatureFiles(featureSwitchName, { repoUrl = "", token = "" } = {}) {
  const payload = buildSearchRequest(featureSwitchName, repoUrl, token);

  try {
    const res = await fetch(searchApi, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    return extractFiles(json);
  } catch {
    return [];
  }
}

// Optional re-exports
export { apiBase, searchApi };