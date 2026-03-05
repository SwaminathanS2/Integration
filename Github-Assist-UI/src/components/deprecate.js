// src/components/deprecate.js

/**
 * Utilities and API client for the "deprecate feature switch" flow.
 * Works with backend: POST /api/branch/create-deprecate
 *
 * Contract (request body):
 * {
 *   "branch": {
 *     "repoUrl": "string",
 *     "featureBranch": "string",
 *     "baseBranch": "dev",
 *     "patToken": "string"
 *   },
 *   "deprecation": {
 *     "filePaths": ["string"],
 *     "featureSwitchName": "string"
 *   }
 * }
 */

/* --------------------------- Configuration helpers --------------------------- */

/** Resolve API base URL from env; fallback to default dev port */
const resolveApiBase = () => {
  const backendPort = process.env.REACT_APP_BACKEND_PORT;
  const base =
    process.env.REACT_APP_API_BASE ||
    (backendPort ? `http://localhost:${backendPort}` : "http://localhost:5282");
  return String(base || "").replace(/\/+$/, ""); // trim trailing slash
};

/** Final endpoint to hit (path fixed by BranchController) */
export const DEPRECATE_PATH = "/api/branch/create-deprecate";

/** Default localStorage key where search step stored file paths */
export const DEFAULT_FILES_STORAGE_KEY = "foundFeatureFiles";

/** Default base branch name for deprecation flow */
export const DEFAULT_BASE_BRANCH = "dev";

/* --------------------------- Branch + Path helpers --------------------------- */

/**
 * Turn a feature switch name into a safe git branch name.
 * - Lowercase
 * - Replace non [a-z0-9-_] with '-'
 * - Trim leading/trailing '-'
 * - Max length 120
 */
export function toBranchName(raw) {
  return (
    (raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "feature-switch"
  );
}

/** Normalize any list of files into plain string paths */
export function toFilePaths(files) {
  if (!Array.isArray(files)) return [];
  return files.map((f) => (typeof f === "string" ? f : f?.path || f?.filePath || String(f)));
}

/** Read file paths captured by search step from localStorage (JSON array) */
export function getFoundFeatureFilePaths(storageKey = DEFAULT_FILES_STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(storageKey);
    const arr = JSON.parse(raw || "[]");
    return toFilePaths(arr);
  } catch {
    return [];
  }
}

/* --------------------------- Payload builder --------------------------- */

/**
 * Build request body for BranchController.CreateAndDeprecate
 */
export function buildDeprecationPayload({
  repoUrl,
  token,
  featureSwitchName,
  filePaths,
  baseBranch = DEFAULT_BASE_BRANCH,
  featureBranch, // optional; defaults to sanitized feature switch name
}) {
  if (!repoUrl) throw new Error("repoUrl is required");
  if (!token) throw new Error("token (PAT) is required");
  if (!featureSwitchName) throw new Error("featureSwitchName is required");
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error("filePaths is required (non-empty array)");
  }

  const fb = featureBranch && String(featureBranch).trim().length > 0
    ? featureBranch
    : toBranchName(featureSwitchName);

  return {
    branch: {
      repoUrl,
      featureBranch: fb,
      baseBranch,
      patToken: token,
    },
    deprecation: {
      filePaths,
      featureSwitchName,
    },
  };
}

/* --------------------------- API call --------------------------- */

/**
 * Invoke backend to create (or reuse) a branch and run deprecation batch.
 *
 * @param {object} options
 * @param {string} options.repoUrl - GitHub repo URL (e.g., https://github.com/org/repo)
 * @param {string} options.token - GitHub PAT
 * @param {string} options.featureSwitchName - The feature switch to deprecate
 * @param {string[]} [options.filePaths] - Optional explicit paths; if omitted, will be read from localStorage
 * @param {string} [options.baseBranch="dev"] - Base branch to branch off
 * @param {string} [options.featureBranch] - Optional override for branch name; defaults to sanitized featureSwitchName
 * @param {AbortSignal} [options.abortSignal] - Optional abort signal for cancellation
 * @param {string} [options.apiBase] - Optional override for base API URL; defaults from env
 * @param {string} [options.filesStorageKey="foundFeatureFiles"] - LocalStorage key for paths
 * @returns {Promise<any>} - Parsed JSON from backend on success
 */
export async function deprecateFeatureSwitch({
  repoUrl,
  token,
  featureSwitchName,
  filePaths,
  baseBranch = DEFAULT_BASE_BRANCH,
  featureBranch,
  abortSignal,
  apiBase = resolveApiBase(),
  filesStorageKey = DEFAULT_FILES_STORAGE_KEY,
} = {}) {
  // Load file paths from storage if not provided
  const paths =
    Array.isArray(filePaths) && filePaths.length > 0
      ? toFilePaths(filePaths)
      : getFoundFeatureFilePaths(filesStorageKey);

  const payload = buildDeprecationPayload({
    repoUrl,
    token,
    featureSwitchName,
    filePaths: paths,
    baseBranch,
    featureBranch,
  });

  const url = `${apiBase}${DEPRECATE_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Keep sending headers as you already do elsewhere
      "X-GitHub-Repo": repoUrl || "",
      "X-GitHub-Token": token || "",
    },
    body: JSON.stringify(payload),
    signal: abortSignal,
  });

  const text = await res.text();
  const tryJson = () => {
    try {
      return JSON.parse(text || "{}");
    } catch {
      return { message: text };
    }
  };

  if (!res.ok) {
    const data = tryJson();
    const reason =
      data?.message ||
      data?.Message ||
      text ||
      `Request failed with status ${res.status}`;
    const code = data?.errorCode || data?.ErrorCode || "DEPRECATION_REQUEST_FAILED";
    const err = new Error(reason);
    // attach extra info for callers
    err.status = res.status;
    err.code = code;
    err.data = data;
    throw err;
  }

  return tryJson();
}

/* --------------------------- Optional helpers --------------------------- */

/** Quick payload preview (helps with debugging / logging) */
export function previewDeprecationPayload(opts) {
  try {
    const payload = buildDeprecationPayload(opts);
    return JSON.stringify(payload, null, 2);
  } catch (e) {
    return `Invalid payload: ${String(e?.message || e)}`;
  }
}