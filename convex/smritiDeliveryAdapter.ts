"use node";

import { v } from "convex/values";
import { buildMetaTemplatePayload, buildMetaTextPayload } from "../shared/metaCloud.js";
import { internalAction } from "./_generated/server";

const deliveryResult = v.object({
  status: v.union(v.literal("sent"), v.literal("failed")),
  providerMessageId: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  retryable: v.boolean(),
  networkStarted: v.boolean(),
});

type DeliveryResult = {
  status: "sent" | "failed";
  providerMessageId?: string;
  errorCode?: string;
  retryable: boolean;
  networkStarted: boolean;
};

export const send = internalAction({
  args: {
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    to: v.optional(v.string()),
    mode: v.union(v.literal("text"), v.literal("template")),
    text: v.string(),
    templateName: v.optional(v.string()),
    templateParameters: v.optional(v.array(v.string())),
  },
  returns: deliveryResult,
  handler: async (_ctx, args): Promise<DeliveryResult> => {
    if (args.channel === "simulator") {
      return {
        status: "sent",
        providerMessageId: `simulated-${crypto.randomUUID()}`,
        retryable: false,
        networkStarted: false,
      };
    }

    const accessToken = process.env.META_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    if (!args.to || !accessToken || !phoneNumberId) {
      return {
        status: "failed",
        errorCode: "meta_not_configured",
        retryable: false,
        networkStarted: false,
      };
    }

    const payload = args.mode === "text"
      ? buildMetaTextPayload(args.to, args.text)
      : buildMetaTemplatePayload(
        args.to,
        args.templateName ?? process.env.META_TASK_REMINDER_TEMPLATE ?? "smriti_task_due",
        process.env.META_TEMPLATE_LANGUAGE ?? "en",
        args.templateParameters ?? [args.text],
      );
    const apiVersion = process.env.META_GRAPH_API_VERSION ?? "v23.0";
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        status: "failed",
        errorCode: "meta_network_error",
        retryable: true,
        networkStarted: true,
      };
    }
    const body = await response.json().catch(() => ({})) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; message?: string };
    };
    if (!response.ok) {
      return {
        status: "failed",
        errorCode: `meta_${body.error?.code ?? response.status}`,
        retryable: response.status === 429 || response.status >= 500,
        networkStarted: true,
      };
    }
    const providerMessageId = body.messages?.[0]?.id;
    if (!providerMessageId) {
      return {
        status: "failed",
        errorCode: "meta_missing_message_id",
        retryable: false,
        networkStarted: true,
      };
    }
    return {
      status: "sent",
      providerMessageId,
      retryable: false,
      networkStarted: true,
    };
  },
});
