/**
 * Extract only supported text messages from a Meta webhook payload.
 * Unknown shapes are ignored instead of being guessed.
 * @param {unknown} payload
 */
export function extractMetaTextMessages(payload) {
  if (!payload || typeof payload !== "object") return [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const result = [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        if (
          message?.type === "text" &&
          typeof message.id === "string" &&
          typeof message.from === "string" &&
          typeof message.text?.body === "string"
        ) {
          result.push({
            externalMessageId: message.id,
            externalUserId: message.from,
            text: message.text.body,
          });
        }
      }
    }
  }
  return result;
}

export function buildMetaTextPayload(to, text) {
  if (!to || !text) throw new Error("Recipient and text are required");
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  };
}

export function buildMetaTemplatePayload() {
  throw new Error("Template sending is not implemented in Reminder Demo");
}
