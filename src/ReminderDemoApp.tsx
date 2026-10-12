import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./reminder-demo.css";

type DemoReminder = {
  status: "scheduled" | "delivered" | "delivery_failed" | "completed" | "cancelled";
};

function DemoSignIn() {
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
      <div className="demo-logo" aria-hidden="true">RD</div>
      <p className="demo-eyebrow">Local prototype</p>
      <h1>Reminder Demo</h1>
      <p>Test private notes, tasks, and scheduled reminders through a WhatsApp-style interface.</p>
      <div className="demo-warning">Simulation only — no real WhatsApp messages are sent.</div>
      <form onSubmit={submit} className="demo-auth-form">
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "signUp" ? "new-password" : "current-password"} required /></label>
        {error && <p className="demo-error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "Please wait…" : mode === "signUp" ? "Create demo account" : "Sign in"}</button>
      </form>
      <button className="demo-link-button" onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")}>
        {mode === "signUp" ? "Already have an account? Sign in" : "Need an account? Create one"}
      </button>
    </section>
  </main>;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function reminderState(reminder: DemoReminder) {
  return reminder.status.replace("_", " ");
}

function DemoWorkspace() {
  const { signOut } = useAuthActions();
  const messages = useQuery(api.messages.listConversation, {});
  const notes = useQuery(api.notes.list, {});
  const tasks = useQuery(api.tasks.list, {});
  const reminders = useQuery(api.reminders.list, {});
  const sendMessage = useMutation(api.messages.sendSimulated);
  const completeTask = useMutation(api.tasks.complete);
  const completeReminder = useMutation(api.reminders.complete);
  const cancelReminder = useMutation(api.reminders.cancel);
  const snoozeReminder = useMutation(api.reminders.snooze);
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
  const activeReminders = reminders?.filter((reminder) =>
    reminder.status !== "completed" && reminder.status !== "cancelled",
  ) ?? [];

  return <main className="demo-app-shell">
    <header className="demo-topbar">
      <div>
        <div className="demo-brand-row"><span className="demo-logo small">RD</span><strong>Reminder Demo</strong></div>
        <span className="demo-connection"><i /> Convex development data</span>
      </div>
      <div className="demo-top-actions">
        <span className="demo-simulation-pill">Simulation only</span>
        <button className="demo-quiet-button" onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>

    <div className="demo-boundary" role="note">
      <strong>No real WhatsApp connection.</strong> Messages and reminder deliveries stay inside this demo.
    </div>

    <div className="demo-layout">
      <section className="demo-phone" aria-label="WhatsApp simulator">
        <div className="demo-phone-header">
          <div className="demo-avatar">R</div>
          <div><strong>Reminder Demo</strong><span>local WhatsApp simulation</span></div>
        </div>
        <div className="demo-chat" aria-live="polite">
          {!messages?.length && <article className="demo-bubble assistant">
            <p>Hi. I can save notes, create tasks, and schedule simulated reminders. Send <strong>help</strong> to see exact commands.</p>
            <time>Simulation</time>
          </article>}
          {messages?.map((message) => <article key={message._id} className={`demo-bubble ${message.role}`}>
            <p>{message.text}</p>
            <time>{message.source === "scheduled" ? "simulated delivery · " : ""}{formatTime(message.createdAt)}</time>
          </article>)}
          {busy && <article className="demo-bubble assistant"><p>Processing…</p></article>}
          <div ref={endRef} />
        </div>
        {error && <div className="demo-error-strip" role="alert">{error}</div>}
        <form className="demo-composer" onSubmit={send}>
          <label htmlFor="demo-message">Simulated WhatsApp message</label>
          <div>
            <textarea id="demo-message" rows={2} maxLength={500} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Try: note: passport is in the blue drawer" />
            <button disabled={busy || !draft.trim()} aria-label="Send simulated message">Send</button>
          </div>
        </form>
      </section>

      <aside className="demo-sidebar" aria-label="Saved demo data">
        <section>
          <div className="demo-section-heading"><h2>Notes</h2><span>{notes?.length ?? 0}</span></div>
          <div className="demo-list">
            {notes === undefined ? <p>Loading…</p> : notes.length === 0 ? <p>No notes yet.</p> : notes.slice(0, 6).map((note) => <article key={note._id}><p>{note.body}</p></article>)}
          </div>
        </section>

        <section>
          <div className="demo-section-heading"><h2>Open tasks</h2><span>{activeTasks.length}</span></div>
          <div className="demo-list">
            {tasks === undefined ? <p>Loading…</p> : activeTasks.length === 0 ? <p>No open tasks.</p> : activeTasks.slice(0, 8).map((task) => <article key={task._id} className="demo-item-row"><p>{task.title}</p><button onClick={() => void runControl(() => completeTask({ taskId: task._id }))}>Complete</button></article>)}
          </div>
        </section>

        <section>
          <div className="demo-section-heading"><h2>Active reminders</h2><span>{activeReminders.length}</span></div>
          <div className="demo-list">
            {reminders === undefined ? <p>Loading…</p> : activeReminders.length === 0 ? <p>No active reminders.</p> : activeReminders.slice(0, 8).map((reminder) => <article key={reminder._id} className="demo-reminder-card">
              <p>{reminder.text}</p>
              <small>{formatTime(reminder.dueAt)} · {reminderState(reminder)}</small>
              <div>
                <button onClick={() => void runControl(() => snoozeReminder({ reminderId: reminder._id, delayMs: 5 * 60_000 }))}>Snooze 5m</button>
                <button onClick={() => void runControl(() => completeReminder({ reminderId: reminder._id }))}>Complete</button>
                <button onClick={() => void runControl(() => cancelReminder({ reminderId: reminder._id }))}>Cancel</button>
              </div>
            </article>)}
          </div>
        </section>
      </aside>
    </div>
  </main>;
}

export default function ReminderDemoApp() {
  return <><Unauthenticated><DemoSignIn /></Unauthenticated><Authenticated><DemoWorkspace /></Authenticated></>;
}
