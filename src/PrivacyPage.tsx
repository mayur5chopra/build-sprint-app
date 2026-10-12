import "./reminder-demo.css";

export default function PrivacyPage() {
  return <main className="smriti-policy-shell">
    <article className="smriti-policy-card">
      <a className="smriti-policy-brand" href="/"><span className="demo-logo small">S</span> Smriti</a>
      <p className="demo-eyebrow">Effective 13 October 2026</p>
      <h1>Privacy policy</h1>
      <p>Smriti is a WhatsApp task-reminder assistant. This policy explains the limited information used to provide reminders.</p>

      <h2>Information Smriti uses</h2>
      <p>Smriti stores your WhatsApp identifier, task messages, task dates and times, urgency and importance labels, completion status, and message-delivery results. The browser test may also use an email address for sign-in.</p>

      <h2>Why it is used</h2>
      <p>This information is used only to understand your task, schedule reminders, send the 8 AM summary, follow up on unfinished work, and prevent duplicate messages.</p>

      <h2>Service providers</h2>
      <p>Meta carries WhatsApp messages, Convex stores and processes Smriti’s data, and Sarvam processes task text so English and Hinglish instructions can be understood. Smriti does not sell your information.</p>

      <h2>Retention and deletion</h2>
      <p>Completed tasks are kept for 15 days and then deleted automatically. Send <strong>delete my data</strong> to Smriti and confirm the request to delete all Smriti tasks and message history.</p>

      <h2>Your choices</h2>
      <p>You can stop using Smriti at any time. You can review pending tasks by sending <strong>tasks</strong>, correct a task, cancel it, or request deletion.</p>

      <h2>Contact</h2>
      <p>For privacy help, message the official Smriti WhatsApp number and write <strong>privacy help</strong>.</p>

      <p className="smriti-policy-note">Smriti is in private testing. This policy will be updated before features such as voice notes, calendar access, or payments are introduced.</p>
    </article>
  </main>;
}
