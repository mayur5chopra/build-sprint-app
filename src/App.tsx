import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

function SignIn() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    data.set("flow", mode);
    try {
      await signIn("password", data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="welcome-shell">
    <section className="welcome-card">
      <div className="brand-mark" aria-hidden="true">क</div>
      <p className="ai-label">Kamini is a female AI companion, not a real person</p>
      <h1>Aisi baat, jo yaad rahe.</h1>
      <p className="welcome-copy">A female Hinglish AI companion who listens, remembers the small things, and picks up where you left off.</p>
      <form onSubmit={submit} className="auth-form">
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "signUp" ? "new-password" : "current-password"} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "Ek second…" : mode === "signUp" ? "Create account" : "Sign in"}</button>
      </form>
      <button className="text-button" onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")}>
        {mode === "signUp" ? "Already have an account? Sign in" : "New here? Create account"}
      </button>
    </section>
  </main>;
}

function AdultGate() {
  const confirmAdult = useMutation(api.profiles.confirmAdult);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  return <main className="welcome-shell">
    <section className="age-card">
      <div className="brand-mark" aria-hidden="true">18+</div>
      <p className="ai-label">Before we start</p>
      <h1>This space is only for adults.</h1>
      <p>Kamini is a female AI companion, not a human, therapist, or emergency service. She does not allow explicit sexual content.</p>
      <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /> I confirm that I am 18 or older.</label>
      <button disabled={!checked || busy} onClick={async () => { setBusy(true); await confirmAdult({ confirmed: true }); }}>
        {busy ? "Saving…" : "I’m 18 — continue"}
      </button>
    </section>
  </main>;
}

function Chat() {
  const { signOut } = useAuthActions();
  const latest = useQuery(api.chat.latestSession);
  const startSession = useAction(api.ai.startSession);
  const sendMessage = useAction(api.ai.sendMessage);
  const [sessionId, setSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const messages = usePaginatedQuery(api.chat.listMessages, sessionId ? { sessionId } : "skip", { initialNumItems: 100 });

  useEffect(() => {
    if (latest && sessionId === null) setSessionId(latest._id);
  }, [latest, sessionId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.results.length, busy]);

  async function newSession() {
    setBusy(true);
    setNotice("");
    setDraft("");
    try {
      const result = await startSession({});
      setSessionId(result.sessionId);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not start a new chat.");
    } finally { setBusy(false); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !sessionId || busy) return;
    setDraft("");
    setBusy(true);
    setNotice("");
    try {
      const result = await sendMessage({ sessionId, text });
      if (!result.aiAvailable) {
        setNotice("Memory works. Live AI replies need the Sarvam API key in Convex.");
      } else if (result.savedMemory) {
        setNotice(`Yaad rakha: ${result.savedMemory.note}`);
      }
    } catch (cause) {
      setDraft(text);
      setNotice(cause instanceof Error ? cause.message : "Message did not send.");
    } finally { setBusy(false); }
  }

  if (latest === undefined) return <main className="loading">Kamini khul rahi hai…</main>;
  if (!sessionId) return <main className="welcome-shell"><section className="age-card"><div className="brand-mark">क</div><p className="ai-label">Your female AI companion</p><h1>Ready when you are.</h1><p>Natural Hinglish mein baat karo. Main chhoti, useful baatein yaad rakhungi.</p><button onClick={newSession} disabled={busy}>{busy ? "Starting…" : "Start talking"}</button></section></main>;

  return <main className="chat-shell">
    <header>
      <div><strong>Kamini</strong><span><i /> Female AI companion</span></div>
      <nav><button className="quiet-button" onClick={newSession} disabled={busy}>Nayi session</button><button className="quiet-button" onClick={() => void signOut()}>Sign out</button></nav>
    </header>
    {notice && <div className="memory-strip" role="status"><span>yaad hai</span>{notice}</div>}
    <section className="messages" aria-live="polite">
      {messages.results.map((message) => <article key={message._id} className={message.role === "user" ? "message user" : "message assistant"}>
        <span>{message.role === "user" ? "You" : "Kamini · AI"}</span><p>{message.text}</p>
      </article>)}
      {busy && <article className="message assistant thinking"><span>Kamini · AI</span><p>soch rahi hoon<span>…</span></p></article>}
      <div ref={endRef} />
    </section>
    <form className="composer" onSubmit={send}>
      <label htmlFor="message">Message Kamini</label>
      <div><textarea id="message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Jo mann mein hai, likho…" rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button disabled={!draft.trim() || busy}>Send</button></div>
      <small>Kamini is AI and can make mistakes.</small>
    </form>
  </main>;
}

function SignedInApp() {
  const profile = useQuery(api.profiles.current);
  if (profile === undefined) return <main className="loading">Ek second…</main>;
  return profile === null ? <AdultGate /> : <Chat />;
}

export default function App() {
  return <><Unauthenticated><SignIn /></Unauthenticated><Authenticated><SignedInApp /></Authenticated></>;
}
