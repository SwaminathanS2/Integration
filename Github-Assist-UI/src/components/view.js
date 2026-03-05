import React, { useRef, useState, useEffect } from "react";

/* --------------------------- Dark Theme & Layout --------------------------- */

const COLORS = {
  blackBg: "#0b0f19",
  blackBgAlt: "#0b1021",
  borderDark: "rgba(255,255,255,0.08)",
  shadow: "rgba(0,0,0,0.35)",
  text: "#e6edf3",
  textMuted: "#b8c0cc",
  accent: "#6ca8ff",
  accentBorder: "rgba(108,168,255,0.45)",
  errorBg: "rgba(255, 87, 87, 0.08)",
  errorBorder: "rgba(255, 87, 87, 0.45)",
  errorText: "#ff8f8f",
};

const viewerStyles = {
  panel: (widthPx) => ({
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: widthPx,
    minWidth: 320,
    maxWidth: 1000,
    display: "flex",
    flexDirection: "row",
    borderLeft: `1px solid ${COLORS.borderDark}`,
    background: COLORS.blackBg,
    boxShadow: `-8px 0 24px ${COLORS.shadow}`,
    zIndex: 9999,
    color: COLORS.text,
  }),

  gutter: {
    width: 8,
    cursor: "col-resize",
    background:
      "linear-gradient(to right, rgba(255,255,255,0.02), rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
  },

  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
    height: "100%",
    background: COLORS.blackBg,
  },

  header: {
    padding: "10px 12px",
    borderBottom: `1px solid ${COLORS.borderDark}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: COLORS.blackBg,
  },

  title: {
    margin: 0,
    fontSize: "0.95rem",
    fontWeight: 700,
    color: COLORS.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  actions: {
    display: "flex",
    gap: 8,
  },

  btn: {
    background: "transparent",
    border: `1px solid ${COLORS.accentBorder}`,
    color: COLORS.accent,
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  body: {
    flex: 1,
    minHeight: 0,
    padding: 12,
    overflow: "auto", // both axes
    background: COLORS.blackBg,
    display: "flex",
    flexDirection: "column",
  },

  codeWrap: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  pre: {
    margin: 0,
    whiteSpace: "pre",         // no wrapping
    overflowX: "auto",         // horizontal scroll
    overflowY: "visible",
    display: "block",
    width: "max-content",
    minWidth: "100%",
    maxWidth: "none",
    boxSizing: "border-box",

    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.45,
    background: COLORS.blackBgAlt,
    color: COLORS.text,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${COLORS.borderDark}`,
  },

  code: {
    whiteSpace: "inherit",
  },

  error: {
    background: COLORS.errorBg,
    border: `1px solid ${COLORS.errorBorder}`,
    color: COLORS.errorText,
    padding: "8px 10px",
    borderRadius: 8,
    margin: "8px 0",
  },

  loading: {
    padding: 12,
    color: COLORS.textMuted,
  },
};

/* --------------------------- Viewer Component --------------------------- */

export function FeatureFileViewer({
  open,
  fileName,
  content,
  loading,
  error,
  onClose,
  onCopy,
}) {
  const [width, setWidth] = useState(560);

  // Restore previous width
  useEffect(() => {
    try {
      const saved = localStorage.getItem("viewerWidthPx");
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num)) setWidth(Math.min(Math.max(num, 320), 1000));
      }
    } catch {}
  }, []);

  // ✅ FIX: Emit width whenever open AND width changes; cleanup emits closed
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("viewer:width", { detail: width }));
    return () => {
      window.dispatchEvent(new CustomEvent("viewer:closed"));
    };
  }, [open, width]); // <-- include 'width' to satisfy ESLint and keep state in sync

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  useEffect(() => {
    if (!open) return;

    const move = (e) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // gutter on left
      const newWidth = Math.min(Math.max(startWidth.current + delta, 320), 1000);
      setWidth(newWidth);
      window.dispatchEvent(new CustomEvent("viewer:width", { detail: newWidth }));
    };

    const stop = () => {
      if (dragging.current) {
        dragging.current = false;
        try {
          localStorage.setItem("viewerWidthPx", String(startWidth.current));
        } catch {}
      }
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, [open]);

  // Keep local ref in sync for persistence
  useEffect(() => {
    startWidth.current = width;
  }, [width]);

  const startDrag = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
  };

  if (!open) return null;

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent("viewer:closed"));
    onClose?.();
  };

  return (
    <section style={viewerStyles.panel(width)} aria-label="File viewer">
      <div
        style={viewerStyles.gutter}
        onMouseDown={startDrag}
        title="Drag to resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize viewer"
      />

      <div style={viewerStyles.container}>
        <div style={viewerStyles.header}>
          <h4 style={viewerStyles.title} title={fileName || "File"}>
            {fileName || "File"}
          </h4>

        <div style={viewerStyles.actions}>
            <button
              style={{
                ...viewerStyles.btn,
                ...(content ? null : viewerStyles.btnDisabled),
              }}
              onClick={onCopy}
              disabled={!content}
            >
              Copy
            </button>
            <button style={viewerStyles.btn} onClick={handleClose}>
              Close
            </button>
          </div>
        </div>

        <div style={viewerStyles.body}>
          {loading && <div style={viewerStyles.loading}>Loading file...</div>}
          {!loading && error && <div style={viewerStyles.error}>{error}</div>}
          {!loading && !error && (
            <div style={viewerStyles.codeWrap}>
              <pre style={viewerStyles.pre}>
                <code style={viewerStyles.code}>{content || ""}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- API Utilities --------------------------- */

const backendPort = process.env.REACT_APP_BACKEND_PORT;

const apiBase =
  process.env.REACT_APP_API_BASE ||
  (backendPort ? `http://localhost:${backendPort}` : "http://localhost:5282");

const featureRawApi = `${apiBase}/api/feature/raw`;

export function parseOwnerRepoFromUrl(repoUrl) {
  if (!repoUrl) return { owner: "", repo: "" };
  try {
    const u = new URL(repoUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    let repo = parts[1];
    if (repo?.endsWith(".git")) repo = repo.slice(0, -4);
    return { owner, repo };
  } catch {
    return { owner: "", repo: "" };
  }
}

export async function viewRawFile(
  filePath,
  { repoUrl = "", token = "", branch = "" } = {}
) {
  const { owner, repo } = parseOwnerRepoFromUrl(repoUrl);

  const body = {
    Owner: owner,
    Repo: repo,
    FilePath: filePath.replace(/^\/+/, ""),
    FeatureName: "",
    Token: "",
    Branch: branch || "",
  };

  try {
    const res = await fetch(featureRawApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) return { ok: false, error: text };
    return { ok: true, content: text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export { apiBase, featureRawApi };
