import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import ReminderDemoStaticPreview from "./ReminderDemoStaticPreview";
import "./styles.css";

const offlinePreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("offline-preview");

if (offlinePreview) {
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
