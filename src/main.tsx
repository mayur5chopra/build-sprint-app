import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import ReminderDemoStaticPreview from "./ReminderDemoStaticPreview";
import PrivacyPage from "./PrivacyPage";
import "./styles.css";

const privacyPage = window.location.pathname === "/privacy";
const offlinePreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("offline-preview");

if (privacyPage) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><PrivacyPage /></React.StrictMode>,
  );
} else if (offlinePreview) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><ReminderDemoStaticPreview /></React.StrictMode>,
  );
} else {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("CONVEX_URL is missing from .env.local");
  const convex = new ConvexReactClient(convexUrl);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    </React.StrictMode>,
  );
}
