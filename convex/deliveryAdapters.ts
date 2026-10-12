"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const deliver = internalAction({
  args: {
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    text: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    retryable: v.boolean(),
    networkStarted: v.boolean(),
  }),
  handler: async (_ctx, args) => {
    if (args.channel === "simulator") {
      return {
        status: "sent" as const,
        providerMessageId: `simulated-${crypto.randomUUID()}`,
        retryable: false,
        networkStarted: false,
      };
    }
    // Demo safety boundary: this adapter intentionally contains no fetch call.
    // A future real adapter must be reviewed separately and must add templates
    // for messages outside WhatsApp's customer-service window.
    return {
      status: "failed" as const,
      errorCode: "demo_network_disabled",
      retryable: false,
      networkStarted: false,
    };
  },
});
