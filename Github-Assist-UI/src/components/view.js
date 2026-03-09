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
    position: "relative", // ✅ So toast can be absolutely positioned inside
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

  // Tighter style for icon-only buttons
  iconBtn: {
    padding: "6px 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
  },

  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  body: {
    flex: 1,
    minHeight: 0,
    padding: 12,
    overflow: "auto",
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
    whiteSpace: "pre",
    overflowX: "auto",
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

  // ✅ Toast styles
  // ✅ Centered toast styles
toast: (type) => ({
  position: "absolute",
  top: "4%",
  left: "75%",
  transform: "translate(-50%, -50%)",
  background: type === "error" ? COLORS.errorBg : "rgba(108,168,255,0.12)",
  border:
    type === "error"
      ? `1px solid ${COLORS.errorBorder}`
      : `1px solid ${COLORS.accentBorder}`,
  color: type === "error" ? COLORS.errorText : COLORS.accent,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  boxShadow: `0 10px 28px ${COLORS.shadow}`,
  pointerEvents: "none",          // let clicks pass through to the viewer
  opacity: 1,
  transition: "opacity 180ms ease, transform 180ms ease",
  backdropFilter: "blur(4px)",    // subtle glass effect (optional)
}),

toastHidden: {
  opacity: 0,
  transform: "translate(-50%, -55%)", // tiny lift on hide
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

  // ✅ Local toast state
  const [toast, setToast] = useState(null); // { text, type: 'success' | 'error' }
  const toastTimer = useRef(null);

  const showToast = (text, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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

  // Emit width whenever open AND width changes; cleanup emits closed
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("viewer:width", { detail: width }));
    return () => {
      window.dispatchEvent(new CustomEvent("viewer:closed"));
    };
  }, [open, width]);

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

  // ✅ Centralized copy handler that also shows a local toast
  const handleCopyClick = async () => {
    try {
      if (onCopy) {
        // Expect onCopy to return boolean; if undefined, assume success
        const result = await onCopy();
        const ok = typeof result === "boolean" ? result : true;
        if (ok) {
          showToast("Copied", "success");
        } else {
          showToast("Copy failed.", "error");
        }
      } else {
        await navigator.clipboard.writeText(content || "");
        showToast("Copied file content to clipboard.", "success");
      }
    } catch {
      showToast("Copy failed.", "error");
    }
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
        {/* ✅ Inline toast (top-right) */}
        {toast && (
          <div
            style={{
              ...viewerStyles.toast(toast.type),
              ...(toast ? {} : viewerStyles.toastHidden),
              
            }}
            role="status"
            aria-live="polite"
          >
            {toast.text}
          </div>
        )}

        <div style={viewerStyles.header}>
          <h4 style={viewerStyles.title} title={fileName || "File"}>
            {fileName || "File"}
          </h4>

          <div style={viewerStyles.actions}>
            {/* Copy Icon Button */}
            <button
              style={{
                ...viewerStyles.btn,
                ...viewerStyles.iconBtn,
                ...(content ? null : viewerStyles.btnDisabled),
              }}
              onClick={handleCopyClick}
              disabled={!content}
              aria-label="Copy"
              title="Copy"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M16 2H8a2 2 0 0 0-2 2v1H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V6a4 4 0 0 0-4-4zm-1 15v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1v8a2 2 0 0 0 2 2h7zm3-3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Close Icon Button */}
            <button
              style={{
                ...viewerStyles.btn,
                ...viewerStyles.iconBtn,
              }}
              onClick={handleClose}
              aria-label="Close"
              title="Close"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z" />
              </svg>
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