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
            ...(typeof message.context?.id === "string"
              ? { replyToExternalMessageId: message.context.id }
              : {}),
          });
        }
      }
    }
  }
  return result;
}

/** Extract final delivery updates from a Meta webhook payload. */
export function extractMetaDeliveryStatuses(payload) {
  if (!payload || typeof payload !== "object") return [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const result = [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
      for (const status of statuses) {
        if (
          typeof status?.id === "string" &&
          ["sent", "delivered", "read", "failed"].includes(status.status)
        ) {
          const firstError = Array.isArray(status.errors) ? status.errors[0] : undefined;
          result.push({
            providerMessageId: status.id,
            status: status.status,
            ...(firstError?.code === undefined ? {} : { errorCode: String(firstError.code) }),
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

const META_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Free-form WhatsApp replies are allowed for 24 hours after a user messages the business. */
export function canUseMetaFreeform(lastInboundAt, now = Date.now()) {
  return Number.isFinite(lastInboundAt) &&
    lastInboundAt <= now &&
    now - lastInboundAt < META_CUSTOMER_SERVICE_WINDOW_MS;
}

export function buildMetaTemplatePayload(to, templateName, languageCode, parameters) {
  if (!to || !templateName || !languageCode) {
    throw new Error("Recipient, template name, and language are required");
  }
  const safeParameters = Array.isArray(parameters) ? parameters : [];
  if (safeParameters.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("Template parameters must be non-empty strings");
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(safeParameters.length === 0 ? {} : {
        components: [{
          type: "body",
          parameters: safeParameters.map((text) => ({ type: "text", text })),
        }],
      }),
    },
  };
}
