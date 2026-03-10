import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import questions from "../data/questions.json";
import { useChat } from "../ChatContext";
import { FeatureFilesCard, searchFeatureFiles } from "../components/search";
import { FeatureFileViewer, viewRawFile } from "../components/view";
import {deprecateFeatureSwitch,toFilePaths,DEFAULT_FILES_STORAGE_KEY,} from "../components/deprecate";
import { createPullRequest } from "../components/pullrequest";

const getConfig = () => {
  try {
    return JSON.parse(localStorage.getItem("appConfig") || "{}");
  } catch {
    return {};
  }
};

const isYes = (text) => /^y(?:es)?$/i.test((text || "").trim());
const isNo = (text) => /^n(?:o)?$/i.test((text || "").trim());

export default function Home() {
  const { setIsChatReady } = useChat();
  const location = useLocation();
  const [config, setConfig] = useState(getConfig());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [toast, setToast] = useState(null); // { text, type: 'success'|'error' }
  const [featureName, setFeatureName] = useState("");
  const [, setFoundFiles] = useState([]);
  const [, setDeprecationDone] = useState(false);
  const [, setDeprecationResult] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [viewerContent, setViewerContent] = useState("");
  const [viewerWidthPx, setViewerWidthPx] = useState(0);
  const scrollerRef = useRef(null);
  const isConfigured = Boolean(config?.repoUrl && config?.token);

  // ---- Questions from file, in order ----
  const qList = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) {
      return questions;
    }
    return [];
  }, []);
    // --- Build a fast lookup for questions.json ---
  const qMap = React.useMemo(
    () => Object.fromEntries((qList || []).map(q => [q.id, q.text])),
    [qList]
  );
  const t = React.useCallback((id) => qMap[id] ?? id, [qMap]);
  const [stepId, setStepId] = React.useState("GetFS"); // initial question
  const addBot = React.useCallback(
    (idOrText) => {
      const text = qMap[idOrText] ?? idOrText;
      setMessages((m) => [...m, { from: "bot", text, ts: Date.now() }]);
    },
    [qMap]
  );
  const showQuestion = React.useCallback(
    (id) => {
      setStepId(id);
      setMessages((m) => [...m, { from: "bot", text: t(id), ts: Date.now() }]);
    },
    [t]
  );

  // --- Reset flow ---
  const resetFlow = useCallback(() => {
    setShowWelcome(false);
    setInput("");
    setSending(false);
    setFeatureName("");
    setFoundFiles([]);
    setDeprecationDone(false);
    setDeprecationResult(null);
    localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);

    if (isConfigured) {
      setMessages([{ from: "bot", text: t("GetFS"), ts: Date.now() }]);
      setStepId("GetFS");
      setIsChatReady(true);
    } else {
      setMessages([
        {
          from: "bot",
          text:
            "The app is not configured yet. Please open Configure and add your repository URL and token.",
          ts: Date.now(),
        },
      ]);
      setIsChatReady(false);
    }
  }, [isConfigured, t, setIsChatReady]);

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
    setMessages([{ from: "bot", text: t("GetFS"), ts: Date.now() }]);
    setStepId("GetFS");
    setIsChatReady(true);
  }, [showWelcome, isConfigured, t, setIsChatReady]);

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

  useEffect(()=>{
    return ()=>{setIsChatReady(false)}; 
  }, [setIsChatReady]);

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

    const result = await viewRawFile(filePath, {
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
      return true; 
    } catch {
      return false; 
    }
  };

/* ------------------ GetFS (Search) ------------------ */
const handleGetFS = async (userMsg) => {
  const normalized = (userMsg || "").trim();
  setFeatureName(normalized);

  const files = await searchFeatureFiles(normalized, {
    repoUrl: config.repoUrl,
    token: config.token,
  });

  if (Array.isArray(files) && files.length > 0) {
    setFoundFiles(files);

    const paths = toFilePaths(files);
    try {
      localStorage.setItem(DEFAULT_FILES_STORAGE_KEY, JSON.stringify(paths));
    } catch {}

    setMessages((m) => [
      ...m,
      {
        from: "bot-ui",
        type: "feature-files",
        files,
        ariaLabel: "Files where the Feature Switch is used",
        ts: Date.now(),
      },
    ]);

    showQuestion("DeprecationConfirmation");
  } else {
    addBot("NoFilesFound");

    setTimeout(() => {
      setFeatureName("");
      setFoundFiles([]);
      localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);
      showQuestion("GetFS");
    }, 1000);
  }
};

/* ------------------ Deprecation Confirmation ------------------ */
const handleDeprecationConfirmation = async (userMsg) => {
  if (isYes(userMsg)) {
    addBot("start"); 

    try {
      const result = await deprecateFeatureSwitch({
        repoUrl: config.repoUrl,
        token: config.token,
        featureSwitchName: featureName,
        baseBranch: "dev",
      });

      setDeprecationDone(true);
      setDeprecationResult(result || null);
      addBot("end");

      try {
        const refreshedFiles = await searchFeatureFiles(featureName, {
          repoUrl: config.repoUrl,
          token: config.token,
        });

        if (Array.isArray(refreshedFiles) && refreshedFiles.length > 0) {
          setFoundFiles(refreshedFiles);

          const refreshedPaths = toFilePaths(refreshedFiles);
          try {
            localStorage.setItem(
              DEFAULT_FILES_STORAGE_KEY,
              JSON.stringify(refreshedPaths)
            );
          } catch {}

          setMessages((m) => [
            ...m,
            {
              from: "bot-ui",
              type: "feature-files-deprecated",
              files: refreshedFiles,
              ariaLabel: "List of Files deprecated",
              ts: Date.now(),
            },
          ]);
        } else {
          addBot("NoFilesAfterDeprecation");
          localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);
        }
      } catch {
        addBot("RefreshFailed");
      }
      showQuestion("CreatePR");
    } catch (err) {
      addBot("DeprecationFailed");
      setToast({ text: t("DeprecationFailed"), type: "error" });
    }
  } else if (isNo(userMsg)) {
    addBot("DeprecationCancelled");
    setTimeout(() => {
      showQuestion("Complete");
    }, 600);
  } else {
    addBot("YesNo");
  }
};

/* ------------------ Create PR ------------------ */
const handleCreatePR = async (userMsg) => {
  if (isYes(userMsg)) {
    addBot("PRStart");

    try {
      const headBranch = (featureName || "").trim().toLowerCase();
      const baseBranch = "dev";

      const result = await createPullRequest({
        token: config.token,
        repoUrl: config.repoUrl,
        headBranch,
        baseBranch,
        apiBase,
      });

      if (result?.ok) {
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
            text: prUrl ? `${t("PRSuccess")} ${prUrl}` : t("PRSuccess"),
            ts: Date.now(),
          },
        ]);
        showQuestion("ApprovePR");
      } else {
        addBot("PRFailed");
        setToast({
          text: result?.error ? `PR creation failed: ${result.error}` : t("PRFailed"),
          type: "error",
        });
        showQuestion("ApprovePR");
      }
    } catch (err) {
      addBot("PRFailed");
      setToast({ text: err?.message || t("PRFailed"), type: "error" });
    }
  } else if (isNo(userMsg)) {
    addBot("PRSkipped");
    setTimeout(() => {
      showQuestion("Complete");
    }, 600);
  } else {
    addBot("YesNo");
  }
};

/* ------------------ Approve PR ------------------ */
const handleApprovePR = async (userMsg) => {
  if (isYes(userMsg)) {
    addBot("ApproveSuccess");
    showQuestion("MergePR");
  } else if (isNo(userMsg)) {
    addBot("ApproveSkipped");
    showQuestion("MergePR");
  } else {
    addBot("YesNo");
  }
};

/* ------------------ Merge PR ------------------ */
const handleMergePR = async (userMsg) => {
  if (isYes(userMsg)) {
    addBot("MergeStart");

    // call merge API 

    addBot("MergeSuccess");

    setTimeout(() => {
      addBot("Complete");
      setStepId(null); 
    }, 300);
  } else if (isNo(userMsg)) {
    addBot("MergeSkipped");
    setTimeout(() => {
      addBot("Complete");
      setStepId(null);
    }, 300);
  } else {
    addBot("YesNo");
  }
};

/* ------------------ Submit handler (ID-driven) ------------------ */
const onSubmit = async (e) => {
  e.preventDefault();
  if (showWelcome || !isConfigured || sending || !input.trim()) return;

  const userMsg = input.trim();

  setMessages((m) => [...m, { from: "user", text: userMsg, ts: Date.now() }]);
  setInput("");
  setSending(true);

  try {
    switch (stepId) {
      case "GetFS":
        await handleGetFS(userMsg);
        break;
      case "DeprecationConfirmation":
        await handleDeprecationConfirmation(userMsg);
        break;
      case "CreatePR":
        await handleCreatePR(userMsg);
        break;
      case "ApprovePR":
        await handleApprovePR(userMsg);
        break;
      case "MergePR":
        await handleMergePR(userMsg);
        break;
      default:
        break;
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
      setFeatureName("");
      setFoundFiles([]);
      setDeprecationDone(false);
      setDeprecationResult(null);
      localStorage.removeItem(DEFAULT_FILES_STORAGE_KEY);


      showQuestion("GetFS");
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
          style={{paddingRight: viewerOpen ? Math.max(0, viewerWidthPx + 12) : 0,}}>
          {toast?.text && (
            <div
              className={`message-box toast-top ${toast.type || "success"}`}
              role="status"
              aria-live="polite"
            >
              <div
                style={{display: "flex",justifyContent: "space-between",gap: 12,alignItems: "center", }}
              >
                <span>{toast.text}</span>
                <button className="btn link" type="button" onClick={() => setToast(null)}aria-label="Dismiss">
                  ✕
                </button>
              </div>
            </div>
          )}
          <div
            className="messages"
            ref={scrollerRef}
            style={toast?.text ? { paddingTop: 64 } : undefined}
          >
            {messages.map((m, idx) => {
              if (m.type === "feature-files" && Array.isArray(m.files)) {
                return (
                  <div key={`ff-wrap-${idx}`}>
                    <FeatureFilesCard files={m.files} onView={(file) => handleView(file)} ariaLabel={"Files where the Feature Switch is used"} />
                  </div>
                );
              }

              if (m.type === "feature-files-deprecated" && Array.isArray(m.files)) {
                return (
                  <div key={`ffd-wrap-${idx}`}>
                    <FeatureFilesCard
                      files={m.files}
                      onView={(file) => handleViewDeprecated(file)}
                      ariaLabel={"List of Files deprecated"}
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
          <form className="input-row" onSubmit={onSubmit}>
            <input type="text" className="chat-input" placeholder="Type your message…" value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}/>
            <button className="send-btn" type="submit" disabled={sending}>
              {sending ? "…" : "➤"}
            </button>
          </form>
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