// src/pages/Home.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import questions from "../data/questions.json";

const getConfig = () => {
  try {
    return JSON.parse(localStorage.getItem("appConfig") || "{}");
  } catch {
    return {};
  }
};

export default function Home() {
  const location = useLocation();

  const [config, setConfig] = useState(getConfig());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [toast, setToast] = useState(null); // { text, type: 'success'|'error' }

  const scrollerRef = useRef(null);

  const isConfigured = Boolean(config?.repoUrl && config?.token);

  const FIRST_PROMPT = "Please enter the Feature Switch Name to Deprecate";

  const qList = useMemo(() => {
    if (Array.isArray(questions) && questions.length > 0) {
      const copy = [...questions];
      copy[0] = { ...(copy[0] || { id: "feature-name", text: "" }), text: FIRST_PROMPT };
      return copy;
    }
    return [{ id: "feature-name", text: FIRST_PROMPT }];
  }, []);

  const total = qList.length;
  const done = currentIndex >= total;

  const resetFlow = useCallback(() => {
    setShowWelcome(false);
    setCurrentIndex(0);
    setInput("");
    setSending(false);

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

  // Welcome / splash skip
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

  // Initialize messages
  useEffect(() => {
    if (showWelcome) return;

    if (!isConfigured) {
      setMessages([
        {
          from: "bot",
          text: "The app is not configured yet. Please open Configure and add your repository URL and token.",
          ts: Date.now(),
        },
      ]);
      setCurrentIndex(0);
      return;
    }

    setMessages([{ from: "bot", text: qList[0]?.text || FIRST_PROMPT, ts: Date.now() }]);
    setCurrentIndex(0);
  }, [showWelcome, isConfigured, qList]);

  const fromState = location.state?.skipWelcome === true;

  useEffect(() => {
    if (fromState) {
      sessionStorage.setItem("seenWelcome", "1");
      resetFlow();
    }
  }, [location.state?.resetToken, fromState, resetFlow]);

  // Auto-scroll
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (showWelcome || !isConfigured || sending || !input.trim() || done) return;

    const userMsg = input.trim();

    setMessages((m) => [
      ...m,
      { from: "user", text: userMsg, ts: Date.now() }
    ]);

    setInput("");
    setSending(true);

    try {
      const nextIndex = currentIndex + 1;

      setTimeout(() => {
        setCurrentIndex(nextIndex);

        if (nextIndex < total) {
          const nextQ = qList[nextIndex];
          setMessages((m) => [
            ...m,
            { from: "bot", text: nextQ.text, ts: Date.now() }
          ]);
        } else {
          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: "Thanks! All questions are complete. 🎉",
              ts: Date.now(),
            },
          ]);
        }
      }, 2000);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text: `⚠️ Could not submit your answer.\n${String(err?.message || err)}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

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

  // One-time connectivity success toast
  useEffect(() => {
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
  }, [config]);

  // Optional: auto-dismiss toast after a few seconds
  useEffect(() => {
    if (!toast?.text) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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
          <Link className="btn link" to="/configure">Open Configure</Link>
        </div>
      )}

      {isConfigured && (
        <div className={`chat-container ${toast?.text ? "has-toast" : ""}`}>
          {/* Toast centered at top of chat container */}
          {toast?.text && (
            <div
              className={`message-box toast-top ${toast.type || "success"}`}
              role="status"
              aria-live="polite"
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
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

          <div className="messages" ref={scrollerRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`bubble ${m.from === "user" ? "user" : "bot"}`}>
                {m.text.split("\n").map((line, i) => (<p key={i}>{line}</p>))}
              </div>
            ))}
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