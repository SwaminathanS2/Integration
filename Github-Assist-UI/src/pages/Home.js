
// src/pages/Home.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import questions from "../data/questions.json";
import { FeatureFilesCard, searchFeatureFiles } from "../components/search";
import { FeatureFileViewer, viewRawFile } from "../components/view";
import {
  deprecateFeatureSwitch,
  toFilePaths,
  DEFAULT_FILES_STORAGE_KEY,
} from "../components/deprecate";

/* --------------------------- Config helpers --------------------------- */
const getConfig = () => {
  try {
    return JSON.parse(localStorage.getItem("appConfig") || "{}");
  } catch {
    return {};
  }
};

/* --------------------------- Helpers --------------------------- */
const isYes = (text) => /^y(?:es)?$/i.test((text || "").trim());
const isNo = (text) => /^n(?:o)?$/i.test((text || "").trim());

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

  // Domain state
  const [featureName, setFeatureName] = useState("");
  const [foundFiles, setFoundFiles] = useState([]);
  const [deprecationDone, setDeprecationDone] = useState(false);
  const [deprecationResult, setDeprecationResult] = useState(null);

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [viewerContent, setViewerContent] = useState("");

  // Track drawer width to shrink chat area
  const [viewerWidthPx, setViewerWidthPx] = useState(0);

  const scrollerRef = useRef(null);

  const isConfigured = Boolean(config?.repoUrl && config?.token);

  // ---- Questions from file, in order ----
  // We trust the file order and ids: GetFS, DeprecationConfirmation, DeprecatedList, CreatePR, ApprovePR, MergePR
  const qList = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) {
      return questions; // use as-is, do not override
    }
    // Fallback minimal set to avoid a blank screen
    return [
      { id: "GetFS", text: "Please Enter the Feature Switch Name to Deprecate" },
      { id: "DeprecationConfirmation", text: "Do you want to proceed with Deprecation" },
      { id: "DeprecatedList", text: "List of Files where the Feature Switch is Deprecrated" },
      { id: "CreatePR", text: "Do you want to create a Pull Request" },
      { id: "ApprovePR", text: "Please Approve the Pull request" },
      { id: "MergePR", text: "Do you want to Merge your Pull request" },
    ];
  }, []);

  const total = qList.length;

  // --- Reset flow ---
  const resetFlow = useCallback(() => {
    setShowWelcome(false);
    setCurrentIndex(0);
    setInput("");
    setSending(false);
    setFeatureName("");
    setFoundFiles([]);
    setDeprecationDone(false);
    setDeprecationResult(null);
    localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);

    if (isConfigured) {
      const firstQ = qList[0]?.text || "Please enter input";
      setMessages([{ from: "bot", text: firstQ, ts: Date.now() }]);
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

    setMessages([{ from: "bot", text: qList[0]?.text || "Please enter input", ts: Date.now() }]);
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

  // ------------------ API base from .env (kept for postAnswer) ------------------
  const backendPort = process.env.REACT_APP_BACKEND_PORT;
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    (backendPort ? `http://localhost:${backendPort}` : "http://localhost:5282");

  // Optional: still support posting other answers (generic questions)
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

  /* ------------------ View integration ------------------ */
  useEffect(() => {
    const onWidth = (e) => {
      const w = Number(e.detail) || 0;
      setViewerWidthPx(w);
    };
    const onClosed = () => setViewerWidthPx(0);

    window.addEventListener("viewer:width", onWidth);
    window.addEventListener("viewer:closed", onClosed);
    return () => {
      window.removeEventListener("viewer:width", onWidth);
      window.removeEventListener("viewer:closed", onClosed);
    };
  }, []);

  const handleView = async (filePath) => {
    if (!isConfigured) return;

    setViewerOpen(true);
    setViewerFile(filePath);
    setViewerContent("");
    setViewerError("");
    setViewerLoading(true);

    const result = await viewRawFile(filePath, {
      repoUrl: config.repoUrl,
      token: config.token,
      branch: "", // backend defaults to "main"
    });

    if (result.ok) {
      setViewerContent(result.content || "");
      setViewerError("");
    } else {
      setViewerContent("");
      setViewerError(result.error || "Failed to load file.");
    }
    setViewerLoading(false);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerFile("");
    setViewerLoading(false);
    setViewerError("");
    setViewerContent("");
  };

  const copyViewerContent = async () => {
    try {
      await navigator.clipboard.writeText(viewerContent || "");
      setToast({ text: "Copied file content to clipboard.", type: "success" });
    } catch {
      setToast({ text: "Copy failed.", type: "error" });
    }
  };

  /* ------------------ Sequential flow helpers ------------------ */
  const askNext = useCallback(
    (nextIndexOffset = 1) => {
      const nextIndex = currentIndex + nextIndexOffset;
      setCurrentIndex(nextIndex);
      const nextQ = qList[nextIndex];
      if (nextQ) {
        setMessages((m) => [...m, { from: "bot", text: nextQ.text, ts: Date.now() }]);
      } else {
        setMessages((m) => [
          ...m,
          { from: "bot", text: "Thanks! All questions are complete. 🎉", ts: Date.now() },
        ]);
      }
    },
    [currentIndex, qList]
  );

  const handleGetFS = async (userMsg) => {
    // Save feature switch name
    setFeatureName(userMsg);

    // Search files in repo for this feature switch
    const files = await searchFeatureFiles(userMsg, {
      repoUrl: config.repoUrl,
      token: config.token,
    });

    if (Array.isArray(files) && files.length > 0) {
      setFoundFiles(files);

      // Persist JUST the paths (backend payload requires strings)
      const paths = toFilePaths(files);
      try {
        localStorage.setItem(DEFAULT_FILES_STORAGE_KEY, JSON.stringify(paths));
      } catch {
        // ignore storage errors
      }

      // Show files UI card
      setMessages((m) => [
        ...m,
        { from: "bot-ui", type: "feature-files", files, ts: Date.now() },
      ]);

      // proceed to DeprecationConfirmation (next question)
      askNext(1);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "No files with above feature switch name.", ts: Date.now() },
      ]);

      // Restart the flow at first question
      setTimeout(() => {
        setCurrentIndex(0);
        setFeatureName("");
        setFoundFiles([]);
        localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);
        setMessages((m) => [...m, { from: "bot", text: qList[0]?.text, ts: Date.now() }]);
      }, 1200);
    }
  };

  const handleDeprecationConfirmation = async (userMsg) => {
    if (isYes(userMsg)) {
      setMessages((m) => [...m, { from: "bot", text: "Starting deprecation…", ts: Date.now() }]);

      try {
        const result = await deprecateFeatureSwitch({
          repoUrl: config.repoUrl,
          token: config.token,
          featureSwitchName: featureName,
          // filePaths optional; read from localStorage('foundFeatureFiles')
          baseBranch: "dev",
        });

        setDeprecationDone(true);
        setDeprecationResult(result || null);

        setMessages((m) => [
          ...m,
          {
            from: "bot",
            text:
              "✅ Deprecation completed." +
              (result?.message ? `\n${result.message}` : ""),
            ts: Date.now(),
          },
        ]);

        // Move to DeprecatedList
        askNext(1);
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            from: "bot",
            text: `⚠️ Deprecation failed.`,
            ts: Date.now(),
          },
        ]);
        setToast({ text: "Deprecation failed.", type: "error" });
      }
    } else if (isNo(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Okay, deprecation cancelled.", ts: Date.now() },
      ]);
      // You can either end here or restart the flow
      setTimeout(() => resetFlow(), 600);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
    }
  };

  const handleDeprecatedList = async () => {
    // Show the file paths we stored from search (and deprecation worked on)
    let paths = [];
    try {
      const raw = localStorage.getItem(DEFAULT_FILES_STORAGE_KEY);
      paths = JSON.parse(raw || "[]");
    } catch {
      paths = toFilePaths(foundFiles);
    }
    const body =
      Array.isArray(paths) && paths.length
        ? `Files deprecated:\n- ${paths.join("\n- ")}`
        : "No file paths found to list.";

    setMessages((m) => [...m, { from: "bot", text: body, ts: Date.now() }]);

    // Auto-advance to CreatePR
    askNext(1);
  };

  const handleCreatePR = async (userMsg) => {
    // TODO: If your backend creates a PR here, call it.
    // For now, we honor the Yes/No and move on with helpful messages.
    if (isYes(userMsg)) {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text:
            "📝 (Placeholder) Creating a Pull Request... " +
            "Integrate your PR creation API here if not already part of deprecation.",
          ts: Date.now(),
        },
      ]);

      // If deprecationResult carries PR info, add it:
      if (deprecationResult?.pullRequestUrl) {
        setMessages((m) => [
          ...m,
          {
            from: "bot",
            text: `PR created: ${deprecationResult.pullRequestUrl}`,
            ts: Date.now(),
          },
        ]);
      }

      askNext(1);
    } else if (isNo(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "PR creation skipped.", ts: Date.now() },
      ]);
      askNext(1); // still move forward to ApprovePR prompt (or you can end)
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
    }
  };

  const handleApprovePR = async (userMsg) => {
    // TODO: Hook to your approval mechanism if any. GitHub approvals need user action.
    if (isYes(userMsg)) {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text:
            "✅ (Placeholder) Assume PR is approved. If you need to automate, connect to your approval workflow.",
          ts: Date.now(),
        },
      ]);
      askNext(1);
    } else if (isNo(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "PR approval skipped.", ts: Date.now() },
      ]);
      askNext(1);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
    }
  };

  const handleMergePR = async (userMsg) => {
    // TODO: Hook to your merge API if you have one.
    if (isYes(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "🔀 (Placeholder) Attempting to merge the PR...", ts: Date.now() },
      ]);
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          { from: "bot", text: "🎉 (Placeholder) PR merged successfully.", ts: Date.now() },
        ]);
      }, 500);
    } else if (isNo(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Merge skipped. Flow complete.", ts: Date.now() },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
      return; // don't finish flow on invalid input
    }

    // End of flow message
    setTimeout(() => {
      setMessages((m) => [...m, { from: "bot", text: "Thanks! All questions are complete. 🎉", ts: Date.now() }]);
    }, 400);
  };

  /* ------------------ Submit handler (sequential flow) ------------------ */
  const onSubmit = async (e) => {
    e.preventDefault();
    if (showWelcome || !isConfigured || sending || !input.trim()) return;

    const userMsg = input.trim();
    const question = qList[currentIndex];

    // Echo user message
    setMessages((m) => [...m, { from: "user", text: userMsg, ts: Date.now() }]);
    setInput("");
    setSending(true);

    try {
      switch (question?.id) {
        case "GetFS": {
          await handleGetFS(userMsg);
          break;
        }

        case "DeprecationConfirmation": {
          await handleDeprecationConfirmation(userMsg);
          break;
        }

        case "DeprecatedList": {
          // No user input needed; we just show the list and continue
          await handleDeprecatedList();
          break;
        }

        case "CreatePR": {
          await handleCreatePR(userMsg);
          break;
        }

        case "ApprovePR": {
          await handleApprovePR(userMsg);
          break;
        }

        case "MergePR": {
          await handleMergePR(userMsg);
          break;
        }

        default: {
          // Generic fallback for any other ids (post and continue)
          try {
            await postAnswer({ questionId: question?.id, answer: userMsg });
          } catch {
            // no-op
          }
          askNext(1);
        }
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

      setTimeout(() => {
        setCurrentIndex(0);
        setFeatureName("");
        setFoundFiles([]);
        setDeprecationDone(false);
        setDeprecationResult(null);
        localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);
        setMessages((m) => [...m, { from: "bot", text: qList[0]?.text, ts: Date.now() }]);
      }, 1200);
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
          style={{
            position: "relative",
            // Shrink the chat area when viewer is open and add a small buffer (+12)
            paddingRight: viewerOpen ? Math.max(0, viewerWidthPx + 12) : 0,
            transition: "padding-right 180ms ease",
            boxSizing: "border-box",
          }}
        >
          {/* Toast */}
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
                zIndex: 10,
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

          {/* Messages */}
          <div
            className="messages"
            ref={scrollerRef}
            style={toast?.text ? { paddingTop: 64 } : undefined}
          >
            {messages.map((m, idx) => {
              if (m.type === "feature-files" && Array.isArray(m.files)) {
                return (
                  <div key={`ff-wrap-${idx}`}>
                    <FeatureFilesCard files={m.files} onView={(file) => handleView(file)} />
                  </div>
                );
              }

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
              disabled={sending}
            />
            <button className="send-btn" type="submit" disabled={sending}>
              {sending ? "…" : "➤"}
            </button>
          </form>

          {/* === Right-side File Viewer Drawer === */}
          <FeatureFileViewer
            open={viewerOpen}
            fileName={viewerFile}
            content={viewerContent}
            loading={viewerLoading}
            error={viewerError}
            onClose={closeViewer}
            onCopy={copyViewerContent}
          />
        </div>
      )}
    </div>
  );
}
