// src/pages/Home.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import questions from "../data/questions.json";

// Pre-deprecation search + card
import { FeatureFilesCard, searchFeatureFiles } from "../components/search";

// Post-deprecation search + card
import {
  FeatureFilesCard as FeatureFilesDeprecatedCard,
  searchFeatureFiles as searchFeatureFilesDeprecated,
} from "../components/search1";

// Viewer UI + API (pre-deprecation, defaults to main via backend)
import { FeatureFileViewer, viewRawFile } from "../components/view";

// Post-deprecation viewer API (we'll pass the feature branch name)
import { viewRawFile as viewRawFileBranch } from "../components/view1";

import {
  deprecateFeatureSwitch,
  toFilePaths,
  DEFAULT_FILES_STORAGE_KEY,
} from "../components/deprecate";

// ⬇️ NEW: PR creation client
import { createPullRequest } from "../components/pullrequest";

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
  const [, setFoundFiles] = useState([]);
  const [, setDeprecationDone] = useState(false);
  const [, setDeprecationResult] = useState(null);

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
  const qList = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) {
      // Filter out DeprecatedList if present
      return questions.filter((q) => q.id !== "DeprecatedList");
    }
    // Fallback minimal set (no DeprecatedList)
    return [
      { id: "GetFS", text: "Please Enter the Feature Switch Name to Deprecate" },
      { id: "DeprecationConfirmation", text: "Do you want to proceed with Deprecation" },
      { id: "CreatePR", text: "Do you want to create a Pull Request" },
      { id: "ApprovePR", text: "Please Approve the Pull request" },
      { id: "MergePR", text: "Do you want to Merge your Pull request" },
    ];
  }, []);

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

  // ------------------ API base from .env (kept for postAnswer & PR) ------------------
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

  /* ------------------ View integration (drawer sizing events) ------------------ */
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

  // === Pre-deprecation: default backend branch (main)
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

  // === Post-deprecation: use the LOWERCASED feature switch name as branch
  const handleViewDeprecated = async (filePath) => {
    if (!isConfigured) return;

    setViewerOpen(true);
    setViewerFile(filePath);
    setViewerContent("");
    setViewerError("");
    setViewerLoading(true);

    const branchName = (featureName || "").toLowerCase(); // ⬅️ lowercased

    const result = await viewRawFileBranch(filePath, {
      repoUrl: config.repoUrl,
      token: config.token,
      branch: branchName,
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
    // Save a normalized feature switch name (trimmed)
    const normalized = (userMsg || "").trim();
    setFeatureName(normalized);

    // Search files in repo for this feature switch (pre-deprecation)
    const files = await searchFeatureFiles(normalized, {
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
        // ignore
      }

      // Show files UI card (pre-deprecation)
      setMessages((m) => [
        ...m,
        { from: "bot-ui", type: "feature-files", files, ts: Date.now() },
      ]);

      askNext(1);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "No files with above feature switch name.", ts: Date.now() },
      ]);

      // Restart the flow
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
          baseBranch: "dev", // your deprecation workflow base, unchanged
        });

        setDeprecationDone(true);
        setDeprecationResult(result || null);

        setMessages((m) => [
          ...m,
          { from: "bot", text: "✅ Deprecation completed.", ts: Date.now() },
        ]);

        // Re-run search (POST-DEPRECATION) using search1.js
        try {
          const refreshedFiles = await searchFeatureFilesDeprecated(featureName, {
            repoUrl: config.repoUrl,
            token: config.token,
          });

          if (Array.isArray(refreshedFiles) && refreshedFiles.length > 0) {
            setFoundFiles(refreshedFiles);

            const refreshedPaths = toFilePaths(refreshedFiles);
            try {
              localStorage.setItem(DEFAULT_FILES_STORAGE_KEY, JSON.stringify(refreshedPaths));
            } catch {}

            // Show files UI card again (deprecated title)
            setMessages((m) => [
              ...m,
              {
                from: "bot-ui",
                type: "feature-files-deprecated",
                files: refreshedFiles,
                ts: Date.now(),
              },
            ]);
          } else {
            setMessages((m) => [
              ...m,
              { from: "bot", text: "No files found after deprecation.", ts: Date.now() },
            ]);
            localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);
          }
        } catch {
          setMessages((m) => [
            ...m,
            { from: "bot", text: "⚠️ Could not refresh files after deprecation.", ts: Date.now() },
          ]);
        }

        // Move directly to CreatePR
        askNext(1);
      } catch (err) {
        setMessages((m) => [
          ...m,
          { from: "bot", text: `⚠️ Deprecation failed.`, ts: Date.now() },
        ]);
        setToast({ text: "Deprecation failed.", type: "error" });
      }
    } else if (isNo(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Okay, deprecation cancelled.", ts: Date.now() },
      ]);
      setTimeout(() => resetFlow(), 600);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
    }
  };

  // ⬇️ UPDATED: exact behavior requested for PR step
  const handleCreatePR = async (userMsg) => {
    if (isYes(userMsg)) {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Starting to raise pull request…", ts: Date.now() },
      ]);

      try {
        const headBranch = (featureName || "").trim().toLowerCase();
        const baseBranch = "dev";

        const result = await createPullRequest({
          token: config.token,
          repoUrl: config.repoUrl,
          headBranch,
          baseBranch,
          apiBase, // reuse same base as other calls
        });

        if (result?.ok) {
          // Try to surface a URL if the service returns one
          const prUrl =
            result.data?.html_url ||
            result.data?.url ||
            result.data?.webUrl ||
            result.data?.prUrl ||
            result.data?.pullRequestUrl ||
            null;

          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: prUrl ? `Pull request raised: ${prUrl}` : "Pull request raised.",
              ts: Date.now(),
            },
          ]);

          // Continue to next question (ApprovePR)
          askNext(1);
        } else {
          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: "Pull request failed to raise.",
              ts: Date.now(),
            },
          ]);
          setToast({
            text: result?.error ? `PR creation failed: ${result.error}` : "PR creation failed.",
            type: "error",
          });
          // stay on the same question so the user can retry or answer again
        }
      } catch (err) {
        setMessages((m) => [
          ...m,
          { from: "bot", text: "Pull request failed to raise.", ts: Date.now() },
        ]);
        setToast({
          text: err?.message || "PR creation failed.",
          type: "error",
        });
      }
    } else if (isNo(userMsg)) {
      // If user says No → reset the flow (as requested)
      setMessages((m) => [
        ...m,
        { from: "bot", text: "PR creation skipped. Resetting the flow…", ts: Date.now() },
      ]);
      setTimeout(() => resetFlow(), 600);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
    }
  };

  const handleApprovePR = async (userMsg) => {
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
      setMessages((m) => [...m, { from: "bot", text: "PR approval skipped.", ts: Date.now() }]);
      askNext(1);
    } else {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Please reply with Yes or No.", ts: Date.now() },
      ]);
    }
  };

  const handleMergePR = async (userMsg) => {
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
      return;
    }

    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Thanks! All questions are complete. 🎉", ts: Date.now() },
      ]);
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
          try {
            await postAnswer({ questionId: question?.id, answer: userMsg });
          } catch {}
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

              if (m.type === "feature-files-deprecated" && Array.isArray(m.files)) {
                return (
                  <div key={`ffd-wrap-${idx}`}>
                    <FeatureFilesDeprecatedCard
                      files={m.files}
                      onView={(file) => handleViewDeprecated(file)}
                    />
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

          {/* === Right-side File Viewer Drawer (single shared UI) === */}
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