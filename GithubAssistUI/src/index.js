import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./App.css";

// Clear persisted app configuration on cold start so nothing is stored between
// app restarts (no cache/localStorage persistence). This keeps in-memory
// behavior during a session but removes saved config when the app is closed
// and reopened — per user's request to avoid caching for now.
try {
  localStorage.removeItem("appConfig");
} catch (e) {
  // ignore (e.g., server-side rendering or restricted environments)
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
