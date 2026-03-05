// src/pages/Home.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import questions from "../data/questions.json";

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

/** Presentational card used inside the chat stream. */
function FeatureFilesCard({ files, onView }) {
  return (
    <div style={cardStyles.wrapper}>
      <div style={cardStyles.card} aria-label="Files where the Feature Switch is used">
        <div style={cardStyles.header}>
          {/* Title only (no refresh) */}
          <h3 style={cardStyles.title}>List of Files where the Feature Switch is Used</h3>
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

/* --------------------------- Config helpers --------------------------- */
const getConfig = () => {
  try {
    return JSON.parse(localStorage.getItem("appConfig") || "{}");
  } catch {
    return {};
  }
};

export default function Home() {
  const location = useLocation();

  // --- State ---
  const [config, setConfig] = useState(getConfig());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [toast, setToast] = useState(null); // { text, type: 'success'|'error' }
  const [, setFeatureName] = useState("");  // setter only; avoids ESLint when unused for now

  const scrollerRef = useRef(null);

  const isConfigured = Boolean(config?.repoUrl && config?.token);

  // ---- Prompt / Questions ----
  const FIRST_PROMPT = "Please enter the Feature Switch Name to Deprecate";

  const qList = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) {
      const copy = [...questions];
      copy[0] = { ...(copy[0] || {}), id: "feature-name", text: FIRST_PROMPT };
      return copy;
    }
    return [{ id: "feature-name", text: FIRST_PROMPT }];
  }, []);

  const total = qList.length;
  const done = currentIndex >= total;

  // --- Reset flow ---
  const resetFlow = useCallback(() => {
    setShowWelcome(false);
    setCurrentIndex(0);
    setInput("");
    setSending(false);
    setFeatureName("");

    if (isConfigured) {
      setMessages([{ from: "bot", text: qList[0]?.text || FIRST_PROMPT, ts: Date.now() }]);
    } else {
      setMessages([
        {
          from: "bot",
          text:
            "The app is not configured yet. Please open Configure and add your repository URL and token.",
          ts: Date.now(),
        },
      ]);
    }
  }, [isConfigured, qList]);

  // --- Welcome / splash skip ---
  useEffect(() => {
    const fromState = location.state && location.state.skipWelcome === true;
    const urlParams = new URLSearchParams(location.search);
    const fromQuery = urlParams.get("skipWelcome") === "1";
    const seen = sessionStorage.getItem("seenWelcome") === "1";

    if (seen || fromState || fromQuery) {
      setShowWelcome(false);
      sessionStorage.setItem("seenWelcome", "1");
      return;
    }

    const t = setTimeout(() => {
      setShowWelcome(false);
      sessionStorage.setItem("seenWelcome", "1");
    }, 5000);

    return () => clearTimeout(t);
  }, [location]);

  // --- Initialize messages ---
  useEffect(() => {
    if (showWelcome) return;

    if (!isConfigured) {
      setMessages([
        {
          from: "bot",
          text:
            "The app is not configured yet. Please open Configure and add your repository URL and token.",
          ts: Date.now(),
        },
      ]);
      setCurrentIndex(0);
      return;
    }

    setMessages([{ from: "bot", text: qList[0]?.text || FIRST_PROMPT, ts: Date.now() }]);
    setCurrentIndex(0);
  }, [showWelcome, isConfigured, qList]);

  // --- Reset via location state ---
  const fromState = location.state?.skipWelcome === true;
  useEffect(() => {
    if (fromState) {
      sessionStorage.setItem("seenWelcome", "1");
      resetFlow();
    }
  }, [location.state?.resetToken, fromState, resetFlow]);

  // --- Auto-scroll on new messages ---
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Live-update config
  useEffect(() => {
    const onStorage = () => setConfig(getConfig());
    window.addEventListener("storage", onStorage);
    const t = setInterval(onStorage, 400);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  // ✅ One-time connectivity success toast
  // Trigger only after app is configured AND welcome is dismissed, so it is visible in chat.
  useEffect(() => {
    if (!isConfigured || showWelcome) return;
    try {
      const raw = localStorage.getItem("appConfig");
      if (!raw) return;
      const cfg = JSON.parse(raw);

      if (cfg?.connectivityMessage) {
        setToast({ text: cfg.connectivityMessage, type: "success" });
        delete cfg.connectivityMessage;
        localStorage.setItem("appConfig", JSON.stringify(cfg));
      }
    } catch {
      // ignore
    }
  }, [isConfigured, showWelcome]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast?.text) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ------------------ API base from .env ------------------
  const backendPort = process.env.REACT_APP_BACKEND_PORT;
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    (backendPort ? `http://localhost:${backendPort}` : "http://localhost:5282");

  // Your backend endpoint is POST /api/search (SearchController)
  const searchApi = process.env.REACT_APP_SEARCH_API || `${apiBase}/api/search`;

  // Optional: still support posting other answers
  const postAnswer = async ({ questionId, answer }) => {
    const endpoint = `${apiBase}/answers`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Repo": config.repoUrl || "",
        "X-GitHub-Token": config.token || "",
      },
      body: JSON.stringify({ questionId, answer }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to post answer");
    }
    return res.json();
  };

  // Build JSON payload EXACTLY matching your C# SearchRequest
  const buildSearchRequest = useCallback(
    (feature) => ({
      RepoURL: config.repoUrl || "",
      AccessToken: config.token || "",
      FeatureSwitchName: feature,
    }),
    [config.repoUrl, config.token]
  );

  // Helper: extract files array from your API shape and a few alternatives
  const extractFiles = (json) => {
    if (!json) return [];
    // ✅ Your API shape: { fileNames: string[] }
    if (Array.isArray(json.fileNames)) return json.fileNames;

    // Fallbacks (keep for flexibility)
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.files)) return json.files;
    if (json.data && Array.isArray(json.data.files)) return json.data.files;
    if (json.result && Array.isArray(json.result.files)) return json.result.files;

    // If nested under a "json" wrapper as a string or object
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
  };

  // Dedicated search function to reuse for Submit
  const searchFeatureFiles = useCallback(
    async (featureSwitchName) => {
      const payload = buildSearchRequest(featureSwitchName);
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
    },
    [searchApi, buildSearchRequest]
  );

  // View button behaviour (stub – hook your modal or navigation here)
  const handleView = (fileName) => {
    // TODO: Integrate your View API: send { repoUrl: config.repoUrl, token: config.token, fileName }
    // e.g., fetch(`${apiBase}/api/view`, { method: 'POST', headers: {...}, body: JSON.stringify({...}) })
    console.log("View file clicked:", { fileName });
  };

  // --- Submit handler (merged) ---
  const onSubmit = async (e) => {
    e.preventDefault();
    if (showWelcome || !isConfigured || sending || !input.trim() || done) return;

    const userMsg = input.trim();
    const question = qList[currentIndex];

    // Echo user message
    setMessages((m) => [...m, { from: "user", text: userMsg, ts: Date.now() }]);
    setInput("");
    setSending(true);

    try {
      if (question?.id === "feature-name") {
        // Persist the feature name (used later when you wire "View" API)
        setFeatureName(userMsg);

        // Search via API
        const files = await searchFeatureFiles(userMsg);

        // Display files (success) OR inform and re-ask first question (empty)
        if (Array.isArray(files) && files.length > 0) {
          // Push a special "UI" message that renders the card (no extra scrollbars inside)
          setMessages((m) => [
            ...m,
            { from: "bot-ui", type: "feature-files", files, ts: Date.now() },
          ]);

          // Proceed to next question (original flow preserved)
          const nextIndex = currentIndex + 1;
          setTimeout(() => {
            setCurrentIndex(nextIndex);
            if (nextIndex < total) {
              const nextQ = qList[nextIndex];
              setMessages((m) => [...m, { from: "bot", text: nextQ.text, ts: Date.now() }]);
            } else {
              setMessages((m) => [
                ...m,
                { from: "bot", text: "Thanks! All questions are complete. 🎉", ts: Date.now() },
              ]);
            }
          }, 400);
        } else {
          // Empty list -> Inform and re-ask first question after a short delay
          setMessages((m) => [
            ...m,
            { from: "bot", text: "No files with above feature switch name.", ts: Date.now() },
          ]);

          setTimeout(() => {
            setCurrentIndex(0);
            setFeatureName("");
            setMessages((m) => [...m, { from: "bot", text: FIRST_PROMPT, ts: Date.now() }]);
          }, 1200);
        }
      } else {
        // Optional: send other answers too
        try {
          await postAnswer({ questionId: question?.id, answer: userMsg });
        } catch {
          // Non-blocking for UX
        }

        // Default progression for other questions
        const nextIndex = currentIndex + 1;
        setTimeout(() => {
          setCurrentIndex(nextIndex);

          if (nextIndex < total) {
            const nextQ = qList[nextIndex];
            setMessages((m) => [...m, { from: "bot", text: nextQ.text, ts: Date.now() }]);
          } else {
            setMessages((m) => [
              ...m,
              { from: "bot", text: "Thanks! All questions are complete. 🎉", ts: Date.now() },
            ]);
          }
        }, 300);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text: `⚠️ Could not complete your request.\n${String(err?.message || err)}`,
          ts: Date.now(),
        },
      ]);

      // On hard error, re-ask first question after a short delay
      setTimeout(() => {
        setCurrentIndex(0);
        setFeatureName("");
        setMessages((m) => [...m, { from: "bot", text: FIRST_PROMPT, ts: Date.now() }]);
      }, 1800);
    } finally {
      setSending(false);
    }
  };

  // --- Render ---
  if (showWelcome) {
    return (
      <div className="home-wrapper">
        <div className="welcome-screen">
          <div className="welcome-card">
            <h1 className="welcome-title">Hi, what can I help you with?</h1>
            <div className="welcome-loader" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-wrapper">
      {!isConfigured && (
        <div className="banner warning">
          <div>
            <strong>Configuration required.</strong> Please add your GitHub repository and token.
          </div>
          <Link className="btn link" to="/configure">
            Open Configure
          </Link>
        </div>
      )}

      {isConfigured && (
        <div
          className={`chat-container ${toast?.text ? "has-toast" : ""}`}
          style={{ position: "relative" }}
        >
          {/* ✅ Toast centered slightly higher at top of chat container */}
          {toast?.text && (
            <div
              className={`message-box toast-top ${toast.type || "success"}`}
              role="status"
              aria-live="polite"
              style={{
                position: "absolute",
                top: "-12px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 2,
                maxWidth: "min(92%, 720px)",
                width: "max-content",
                padding: "10px 14px",
                borderRadius: 8,
                boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                background: "var(--toast-bg, #fff)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span>{toast.text}</span>
                <button
                  className="btn link"
                  type="button"
                  onClick={() => setToast(null)}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Messages (add padding when toast visible so messages don’t sit beneath it) */}
          <div
            className="messages"
            ref={scrollerRef}
            style={toast?.text ? { paddingTop: 64 } : undefined}
          >
            {messages.map((m, idx) => {
              // Render our UI card message when present (no bubble wrapper; avoids nested scrollbars)
              if (m.type === "feature-files" && Array.isArray(m.files)) {
                return (
                  <FeatureFilesCard
                    key={`ff-${idx}`}
                    files={m.files}
                    onView={(file) => handleView(file)}
                  />
                );
              }

              // Default text bubble
              return (
                <div key={`msg-${idx}`} className={`bubble ${m.from === "user" ? "user" : "bot"}`}>
                  {(m.text || "").split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="progress muted" />

          <form className="input-row" onSubmit={onSubmit}>
            <input
              type="text"
              className="chat-input"
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending || done}
            />
            <button className="send-btn" type="submit" disabled={sending || done}>
              {sending ? "…" : "➤"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}