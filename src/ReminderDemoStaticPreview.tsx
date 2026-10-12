import "./reminder-demo.css";

export default function ReminderDemoStaticPreview() {
  return <main className="demo-app-shell" data-offline-preview="true">
    <header className="demo-topbar">
      <div>
        <div className="demo-brand-row"><span className="demo-logo small">RD</span><strong>Reminder Demo</strong></div>
        <span className="demo-connection"><i /> Offline static preview</span>
      </div>
      <div className="demo-top-actions"><span className="demo-simulation-pill">Simulation only</span></div>
    </header>
    <div className="demo-boundary" role="note">
      <strong>No Convex or WhatsApp connection.</strong> This development-only page contains fixed sample text for visual checks.
    </div>
    <div className="demo-layout">
      <section className="demo-phone" aria-label="Static WhatsApp simulator preview">
        <div className="demo-phone-header">
          <div className="demo-avatar">R</div>
          <div><strong>Reminder Demo</strong><span>offline WhatsApp-style preview</span></div>
        </div>
        <div className="demo-chat">
          <article className="demo-bubble user"><p>note: passport is in the blue drawer</p><time>10:02 am</time></article>
          <article className="demo-bubble assistant"><p>Saved note: passport is in the blue drawer</p><time>10:02 am</time></article>
          <article className="demo-bubble user"><p>remind me in 10 minutes to call Mum</p><time>10:03 am</time></article>
          <article className="demo-bubble assistant"><p>Reminder set for 10:13 am: call Mum</p><time>10:03 am</time></article>
          <article className="demo-bubble assistant"><p>⏰ Reminder: call Mum</p><time>simulated delivery · 10:13 am</time></article>
        </div>
        <form className="demo-composer">
          <label htmlFor="preview-message">Simulated WhatsApp message</label>
          <div><textarea id="preview-message" rows={2} disabled placeholder="Static preview — sending is disabled" /><button disabled>Send</button></div>
        </form>
      </section>
      <aside className="demo-sidebar" aria-label="Static saved data preview">
        <section>
          <div className="demo-section-heading"><h2>Notes</h2><span>1</span></div>
          <div className="demo-list"><article><p>passport is in the blue drawer</p></article></div>
        </section>
        <section>
          <div className="demo-section-heading"><h2>Open tasks</h2><span>1</span></div>
          <div className="demo-list"><article className="demo-item-row"><p>Buy milk</p><button disabled>Complete</button></article></div>
        </section>
        <section>
          <div className="demo-section-heading"><h2>Active reminders</h2><span>1</span></div>
          <div className="demo-list"><article className="demo-reminder-card"><p>Call Mum</p><small>10:13 am · delivered</small><div><button disabled>Snooze 5m</button><button disabled>Complete</button><button disabled>Cancel</button></div></article></div>
        </section>
      </aside>
    </div>
  </main>;
}
