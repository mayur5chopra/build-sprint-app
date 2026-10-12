import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./reminder-demo.css";

type SmritiTask = {
  status: "open" | "completed" | "cancelled";
  deliveryStatus: "scheduled" | "delivered" | "delivery_failed";
  urgent: boolean;
  important: boolean;
  recurrence: { kind: "none" } | { kind: "daily" | "weekly" | "monthly"; interval: number };
};

function SmritiSignIn() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    data.set("flow", mode);
    try {
      await signIn("password", data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="demo-auth-shell">
    <section className="demo-auth-card">
      <div className="demo-logo" aria-hidden="true">S</div>
      <p className="demo-eyebrow">Private first version</p>
      <h1>Smriti</h1>
      <p>Capture work tasks in English or Hinglish and keep following up until they are done.</p>
      <div className="demo-warning">Browser simulator — your dedicated WhatsApp number is connected separately.</div>
      <form onSubmit={submit} className="demo-auth-form">
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "signUp" ? "new-password" : "current-password"} required /></label>
        {error && <p className="demo-error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "Please wait…" : mode === "signUp" ? "Create account" : "Sign in"}</button>
      </form>
      <button className="demo-link-button" onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")}>
        {mode === "signUp" ? "Already have an account? Sign in" : "Need an account? Create one"}
      </button>
    </section>
  </main>;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function taskClass(task: SmritiTask) {
  if (task.urgent && task.important) return "Urgent + important";
  if (task.urgent) return "Urgent";
  if (task.important) return "Important";
  return "Routine";
}

function SmritiWorkspace() {
  const { signOut } = useAuthActions();
  const messages = useQuery(api.smriti.listConversation, {});
  const tasks = useQuery(api.smriti.listTasks, {});
  const sendMessage = useAction(api.smriti.sendSimulated);
  const completeTask = useMutation(api.smriti.completeTask);
  const cancelTask = useMutation(api.smriti.cancelTask);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, busy]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setDraft("");
    try {
      await sendMessage({ externalMessageId: crypto.randomUUID(), text });
    } catch (cause) {
      setDraft(text);
      setError(cause instanceof Error ? cause.message : "The simulated message failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runControl(work: () => Promise<unknown>) {
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action failed.");
    }
  }

  const activeTasks = tasks?.filter((task) => task.status === "open") ?? [];

  return <main className="demo-app-shell">
    <header className="demo-topbar">
      <div>
        <div className="demo-brand-row"><span className="demo-logo small">S</span><strong>Smriti</strong></div>
        <span className="demo-connection"><i /> Smriti cloud data</span>
      </div>
      <div className="demo-top-actions">
        <span className="demo-simulation-pill">Private test</span>
        <button className="demo-quiet-button" onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>

    <div className="demo-boundary" role="note">
      <strong>Browser test mode.</strong> Use this simulator while the dedicated Meta number and reminder templates are being connected.
    </div>

    <div className="demo-layout">
      <section className="demo-phone" aria-label="Smriti WhatsApp simulator">
        <div className="demo-phone-header">
          <div className="demo-avatar">S</div>
          <div><strong>Smriti</strong><span>WhatsApp task assistant</span></div>
        </div>
        <div className="demo-chat" aria-live="polite">
          {!messages?.length && <article className="demo-bubble assistant">
            <p>Hi, I’m Smriti. Send me a work task with its date and time. English aur Hinglish, dono chalega.</p>
            <time>Private test</time>
          </article>}
          {messages?.map((message) => <article key={message._id} className={`demo-bubble ${message.role}`}>
            <p>{message.text}</p>
            <time>{message.source === "scheduled" ? "scheduled delivery · " : ""}{formatTime(message.createdAt)}</time>
          </article>)}
          {busy && <article className="demo-bubble assistant"><p>Understanding your task…</p></article>}
          <div ref={endRef} />
        </div>
        {error && <div className="demo-error-strip" role="alert">{error}</div>}
        <form className="demo-composer" onSubmit={send}>
          <label htmlFor="demo-message">Message Smriti</label>
          <div>
            <textarea id="demo-message" rows={2} maxLength={500} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Try: Kal 4 PM report bhejna yaad dilana" />
            <button disabled={busy || !draft.trim()} aria-label="Send message">Send</button>
          </div>
        </form>
      </section>

      <aside className="demo-sidebar" aria-label="Smriti task data">
        <section>
          <div className="demo-section-heading"><h2>Pending tasks</h2><span>{activeTasks.length}</span></div>
          <div className="demo-list">
            {tasks === undefined ? <p>Loading…</p> : activeTasks.length === 0 ? <p>No pending tasks.</p> : activeTasks.slice(0, 12).map((task) => <article key={task._id} className="demo-reminder-card">
              <p>{task.title}</p>
              <small>{formatTime(task.dueAt)} · {taskClass(task)} · {task.deliveryStatus.replace("_", " ")}{task.recurrence.kind === "none" ? "" : ` · ${task.recurrence.kind}`}</small>
              <div>
                <button onClick={() => void runControl(() => completeTask({ taskId: task._id }))}>Done</button>
                <button onClick={() => void runControl(() => cancelTask({ taskId: task._id }))}>Cancel</button>
              </div>
            </article>)}
          </div>
        </section>
      </aside>
    </div>
  </main>;
}

export default function ReminderDemoApp() {
  return <><Unauthenticated><SmritiSignIn /></Unauthenticated><Authenticated><SmritiWorkspace /></Authenticated></>;
}
