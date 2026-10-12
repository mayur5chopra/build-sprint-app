import { v } from "convex/values";
import { extractMetaTextMessages } from "../shared/metaCloud.js";
import { verifyMetaSignature } from "../shared/metaSignature.js";
import { internal } from "./_generated/api";
import { httpAction, internalAction } from "./_generated/server";

const internalApi = internal as any;

export const verify = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (!expectedToken || mode !== "subscribe" || token !== expectedToken || challenge === null) {
    return new Response("Webhook verification unavailable", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
});

export const receive = httpAction(async (ctx, request) => {
  const appSecret = process.env.META_APP_SECRET;
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!appSecret || !(await verifyMetaSignature(rawBody, signature, appSecret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const messages = extractMetaTextMessages(payload).slice(0, 20);
  const results = [];
  for (const message of messages) {
    results.push(await ctx.runMutation(internalApi.messages.processWhatsApp, message));
  }
  return Response.json({ accepted: true, processed: results.length, results });
});

export const adapterStatus = internalAction({
  args: {},
  returns: v.object({ networkEnabled: v.literal(false), templateSending: v.literal(false) }),
  handler: async () => ({ networkEnabled: false as const, templateSending: false as const }),
});
