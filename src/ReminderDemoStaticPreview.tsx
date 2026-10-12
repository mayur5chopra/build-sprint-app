import "./reminder-demo.css";

export default function ReminderDemoStaticPreview() {
  return <main className="demo-app-shell" data-offline-preview="true">
    <header className="demo-topbar">
      <div>
        <div className="demo-brand-row"><span className="demo-logo small">S</span><strong>Smriti</strong></div>
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
          <div className="demo-avatar">S</div>
          <div><strong>Smriti</strong><span>offline WhatsApp-style preview</span></div>
        </div>
        <div className="demo-chat">
          <article className="demo-bubble user"><p>Kal 4 PM report bhejna yaad dilana</p><time>10:02 am</time></article>
          <article className="demo-bubble assistant"><p>Saved: Send report — Wed, 14 Oct, 4:00 PM.</p><time>10:02 am</time></article>
          <article className="demo-bubble assistant"><p>⏰ Reminder: Send report{`\n`}Reply “done” to mark it complete.</p><time>scheduled delivery · 4:00 pm</time></article>
        </div>
        <form className="demo-composer">
          <label htmlFor="preview-message">Message Smriti</label>
          <div><textarea id="preview-message" rows={2} disabled placeholder="Static preview — sending is disabled" /><button disabled>Send</button></div>
        </form>
      </section>
      <aside className="demo-sidebar" aria-label="Static task preview">
        <section>
          <div className="demo-section-heading"><h2>Pending tasks</h2><span>1</span></div>
          <div className="demo-list"><article className="demo-reminder-card"><p>Send report</p><small>14 Oct, 4:00 pm · Important · scheduled</small><div><button disabled>Done</button><button disabled>Cancel</button></div></article></div>
        </section>
      </aside>
    </div>
  </main>;
}
