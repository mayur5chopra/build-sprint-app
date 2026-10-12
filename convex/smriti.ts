import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { formatSmritiTime, normalizeTaskDraft } from "../shared/smritiRules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  cancelSmritiTask,
  completeSmritiTask,
  createSmritiTask,
  ensureSmritiUserForOwner,
  ensureSmritiUserForWhatsApp,
  findSmritiUserByOwner,
  listOpenSmritiTasks,
  moveSmritiTask,
} from "./lib/smritiCore";

const internalApi = internal as any;
const recurrenceValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    kind: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    interval: v.number(),
  }),
);

const taskResult = v.object({
  _id: v.id("smritiTasks"),
  title: v.string(),
  dueAt: v.number(),
  recurrence: recurrenceValidator,
  urgent: v.boolean(),
  important: v.boolean(),
  status: v.union(v.literal("open"), v.literal("completed"), v.literal("cancelled")),
  deliveryStatus: v.union(v.literal("scheduled"), v.literal("delivered"), v.literal("delivery_failed")),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const messageResult = v.object({
  _id: v.id("smritiMessages"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  text: v.string(),
  source: v.union(v.literal("simulator"), v.literal("whatsapp"), v.literal("scheduled")),
  createdAt: v.number(),
});

function taskLine(task: { title: string; dueAt: number; urgent: boolean; important: boolean }, index: number) {
  const quadrant = task.urgent && task.important
    ? "urgent + important"
    : task.urgent
      ? "urgent"
      : task.important
        ? "important"
        : "routine";
  return `${index + 1}. ${task.title} — ${formatSmritiTime(task.dueAt)} · ${quadrant}`;
}

export const listTasks = query({
  args: {},
  returns: v.array(taskResult),
  handler: async (ctx) => {
    const ownerUserId = await getAuthUserId(ctx);
    if (ownerUserId === null) throw new Error("Sign in required");
    const user = await findSmritiUserByOwner(ctx, ownerUserId);
    if (user === null) return [];
    const tasks = await ctx.db
      .query("smritiTasks")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    return tasks.map((task) => ({
      _id: task._id,
      title: task.title,
      dueAt: task.dueAt,
      recurrence: task.recurrence,
      urgent: task.urgent,
      important: task.important,
      status: task.status,
      deliveryStatus: task.deliveryStatus,
      ...(task.completedAt === undefined ? {} : { completedAt: task.completedAt }),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  },
});

export const listConversation = query({
  args: {},
  returns: v.array(messageResult),
  handler: async (ctx) => {
    const ownerUserId = await getAuthUserId(ctx);
    if (ownerUserId === null) throw new Error("Sign in required");
    const user = await findSmritiUserByOwner(ctx, ownerUserId);
    if (user === null) return [];
    const messages = await ctx.db
      .query("smritiMessages")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    return messages.reverse().map(({ _id, role, text, source, createdAt }) => ({
      _id,
      role,
      text,
      source,
      createdAt,
    }));
  },
});

export const completeTask = mutation({
  args: { taskId: v.id("smritiTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerUserId = await getAuthUserId(ctx);
    if (ownerUserId === null) throw new Error("Sign in required");
    const user = await findSmritiUserByOwner(ctx, ownerUserId);
    if (user === null) throw new Error("Smriti profile not found");
    await completeSmritiTask(ctx, internalApi.smritiWorker.deliverTask, user._id, args.taskId);
    return null;
  },
});

export const cancelTask = mutation({
  args: { taskId: v.id("smritiTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerUserId = await getAuthUserId(ctx);
    if (ownerUserId === null) throw new Error("Sign in required");
    const user = await findSmritiUserByOwner(ctx, ownerUserId);
    if (user === null) throw new Error("Smriti profile not found");
    await cancelSmritiTask(ctx, user._id, args.taskId);
    return null;
  },
});

export const beginInbound = internalMutation({
  args: {
    provider: v.union(v.literal("simulator"), v.literal("whatsapp")),
    externalMessageId: v.string(),
    replyToExternalMessageId: v.optional(v.string()),
    text: v.string(),
    ownerUserId: v.optional(v.id("users")),
    whatsappId: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("smritiUsers"),
    duplicate: v.boolean(),
    responseText: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const externalMessageId = args.externalMessageId.trim();
    const text = args.text.trim();
    if (!externalMessageId || externalMessageId.length > 200) throw new Error("Message ID is invalid");
    if (!text || text.length > 500) throw new Error("Message must be between 1 and 500 characters");
    const userId = args.provider === "simulator"
      ? await ensureSmritiUserForOwner(ctx, args.ownerUserId as Id<"users">)
      : await ensureSmritiUserForWhatsApp(ctx, args.whatsappId ?? "");
    const existing = await ctx.db
      .query("smritiInboundMessages")
      .withIndex("by_provider_message", (q) =>
        q.eq("provider", args.provider).eq("externalMessageId", externalMessageId),
      )
      .unique();
    if (existing !== null) {
      if (existing.userId !== userId) throw new Error("Message ID is already owned by another user");
      return {
        userId,
        duplicate: true,
        ...(existing.responseText ? { responseText: existing.responseText } : {}),
      };
    }
    const now = Date.now();
    await ctx.db.insert("smritiInboundMessages", {
      userId,
      provider: args.provider,
      externalMessageId,
      ...(args.replyToExternalMessageId
        ? { replyToExternalMessageId: args.replyToExternalMessageId }
        : {}),
      text,
      status: "processing",
      receivedAt: now,
    });
    await ctx.db.insert("smritiMessages", {
      userId,
      role: "user",
      text,
      source: args.provider,
      externalMessageId,
      createdAt: now,
    });
    return { userId, duplicate: false };
  },
});

export const getPending = internalQuery({
  args: { userId: v.id("smritiUsers") },
  returns: v.union(v.null(), v.object({
    kind: v.union(v.literal("task_details"), v.literal("delete_confirmation")),
    rawText: v.string(),
  })),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("smritiPendingInputs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (pending === null || pending.expiresAt <= Date.now()) return null;
    return { kind: pending.kind, rawText: pending.rawText };
  },
});

export const savePending = internalMutation({
  args: {
    userId: v.id("smritiUsers"),
    kind: v.union(v.literal("task_details"), v.literal("delete_confirmation")),
    rawText: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("smritiPendingInputs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing !== null) await ctx.db.delete(existing._id);
    const now = Date.now();
    await ctx.db.insert("smritiPendingInputs", {
      userId: args.userId,
      kind: args.kind,
      rawText: args.rawText,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    });
    return null;
  },
});

export const clearPending = internalMutation({
  args: { userId: v.id("smritiUsers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("smritiPendingInputs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing !== null) await ctx.db.delete(existing._id);
    return null;
  },
});

export const createTaskFromInterpretation = internalMutation({
  args: {
    userId: v.id("smritiUsers"),
    title: v.string(),
    dueAt: v.number(),
    urgent: v.boolean(),
    important: v.boolean(),
    recurrence: recurrenceValidator,
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
  },
  returns: v.id("smritiTasks"),
  handler: async (ctx, args) => await createSmritiTask(
    ctx,
    internalApi.smritiWorker.deliverTask,
    args.userId,
    args,
  ),
});

export const listOpenForMessage = internalQuery({
  args: { userId: v.id("smritiUsers") },
  returns: v.array(v.object({
    _id: v.id("smritiTasks"),
    title: v.string(),
    dueAt: v.number(),
    urgent: v.boolean(),
    important: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const tasks = await listOpenSmritiTasks(ctx, args.userId);
    return tasks.map(({ _id, title, dueAt, urgent, important }) => ({
      _id,
      title,
      dueAt,
      urgent,
      important,
    }));
  },
});

async function taskFromReply(ctx: any, userId: Id<"smritiUsers">, externalMessageId: string) {
  const message = await ctx.db
    .query("smritiMessages")
    .withIndex("by_external_message", (q: any) => q.eq("externalMessageId", externalMessageId))
    .unique();
  if (message === null || message.userId !== userId || !message.taskId) throw new Error("Reply to a task reminder so I know which task you mean.");
  return message.taskId as Id<"smritiTasks">;
}

export const completeFromReply = internalMutation({
  args: { userId: v.id("smritiUsers"), replyToExternalMessageId: v.string() },
  returns: v.object({ title: v.string(), repeating: v.boolean(), nextDueAt: v.union(v.null(), v.number()) }),
  handler: async (ctx, args) => {
    const taskId = await taskFromReply(ctx, args.userId, args.replyToExternalMessageId);
    return await completeSmritiTask(ctx, internalApi.smritiWorker.deliverTask, args.userId, taskId);
  },
});

export const cancelFromReply = internalMutation({
  args: { userId: v.id("smritiUsers"), replyToExternalMessageId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const taskId = await taskFromReply(ctx, args.userId, args.replyToExternalMessageId);
    return await cancelSmritiTask(ctx, args.userId, taskId);
  },
});

export const moveFromReply = internalMutation({
  args: { userId: v.id("smritiUsers"), replyToExternalMessageId: v.string(), dueAt: v.number() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const taskId = await taskFromReply(ctx, args.userId, args.replyToExternalMessageId);
    return await moveSmritiTask(
      ctx,
      internalApi.smritiWorker.deliverTask,
      args.userId,
      taskId,
      args.dueAt,
    );
  },
});

export const classifyFromReply = internalMutation({
  args: {
    userId: v.id("smritiUsers"),
    replyToExternalMessageId: v.string(),
    urgent: v.boolean(),
    important: v.boolean(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const taskId = await taskFromReply(ctx, args.userId, args.replyToExternalMessageId);
    const task = await ctx.db.get(taskId);
    if (task === null || task.userId !== args.userId || task.status !== "open") {
      throw new Error("Task not found");
    }
    await ctx.db.patch(taskId, {
      urgent: args.urgent,
      important: args.important,
      updatedAt: Date.now(),
    });
    return task.title;
  },
});

export const finishInbound = internalMutation({
  args: {
    provider: v.union(v.literal("simulator"), v.literal("whatsapp")),
    externalMessageId: v.string(),
    userId: v.id("smritiUsers"),
    responseText: v.string(),
    responseExternalMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inbound = await ctx.db
      .query("smritiInboundMessages")
      .withIndex("by_provider_message", (q) =>
        q.eq("provider", args.provider).eq("externalMessageId", args.externalMessageId),
      )
      .unique();
    if (inbound === null || inbound.userId !== args.userId) throw new Error("Inbound message not found");
    const now = Date.now();
    await ctx.db.patch(inbound._id, {
      status: "processed",
      responseText: args.responseText,
      processedAt: now,
    });
    await ctx.db.insert("smritiMessages", {
      userId: args.userId,
      role: "assistant",
      text: args.responseText,
      source: args.provider,
      externalMessageId: args.responseExternalMessageId,
      createdAt: now,
    });
    return null;
  },
});

export const recordReplyDelivery = internalMutation({
  args: {
    userId: v.id("smritiUsers"),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("smritiDeliveryAttempts", {
      userId: args.userId,
      attempt: 1,
      kind: "freeform_reply",
      channel: args.channel,
      status: args.status,
      providerMessageId: args.providerMessageId,
      errorCode: args.errorCode,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const recordMetaDeliveryStatus = internalMutation({
  args: {
    providerMessageId: v.string(),
    status: v.union(v.literal("sent"), v.literal("delivered"), v.literal("read"), v.literal("failed")),
    errorCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db
      .query("smritiDeliveryAttempts")
      .withIndex("by_provider_message", (q) => q.eq("providerMessageId", args.providerMessageId))
      .unique();
    if (attempt === null) return null;
    await ctx.db.patch(attempt._id, {
      status: args.status,
      errorCode: args.errorCode,
      updatedAt: Date.now(),
    });
    if (attempt.taskId) {
      const task = await ctx.db.get(attempt.taskId);
      if (task !== null && task.status === "open") {
        await ctx.db.patch(task._id, {
          deliveryStatus: args.status === "failed" ? "delivery_failed" : "delivered",
          updatedAt: Date.now(),
        });
      }
    }
    return null;
  },
});

export const deleteUserDataBatch = internalMutation({
  args: { userId: v.id("smritiUsers") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const [tasks, pending, inbound, messages, attempts] = await Promise.all([
      ctx.db.query("smritiTasks").withIndex("by_user_created", (q) => q.eq("userId", args.userId)).take(500),
      ctx.db.query("smritiPendingInputs").withIndex("by_user", (q) => q.eq("userId", args.userId)).take(500),
      ctx.db.query("smritiInboundMessages").withIndex("by_user_received", (q) => q.eq("userId", args.userId)).take(500),
      ctx.db.query("smritiMessages").withIndex("by_user_created", (q) => q.eq("userId", args.userId)).take(500),
      ctx.db.query("smritiDeliveryAttempts").withIndex("by_user_created", (q) => q.eq("userId", args.userId)).take(500),
    ]);
    for (const item of [...attempts, ...messages, ...inbound, ...pending, ...tasks]) {
      await ctx.db.delete(item._id);
    }
    const more = [tasks, pending, inbound, messages, attempts].some((items) => items.length === 500);
    if (more) {
      await ctx.scheduler.runAfter(0, internalApi.smriti.deleteUserDataBatch, { userId: args.userId });
      return false;
    }
    await ctx.db.delete(args.userId);
    return true;
  },
});

async function respondToInbound(
  ctx: any,
  input: {
    provider: "simulator" | "whatsapp";
    externalMessageId: string;
    externalUserId?: string;
    replyToExternalMessageId?: string;
    text: string;
    ownerUserId?: Id<"users">;
  },
) {
  const begun = await ctx.runMutation(internalApi.smriti.beginInbound, {
    provider: input.provider,
    externalMessageId: input.externalMessageId,
    replyToExternalMessageId: input.replyToExternalMessageId,
    text: input.text,
    ownerUserId: input.ownerUserId,
    whatsappId: input.externalUserId,
  }) as { userId: Id<"smritiUsers">; duplicate: boolean; responseText?: string };
  if (begun.duplicate) return { responseText: begun.responseText ?? "Already processing.", duplicate: true };

  const clean = input.text.trim();
  const lower = clean.toLocaleLowerCase();
  const pending = await ctx.runQuery(internalApi.smriti.getPending, { userId: begun.userId }) as null | {
    kind: "task_details" | "delete_confirmation";
    rawText: string;
  };
  let responseText: string;
  let deleteAfterReply = false;

  if (pending?.kind === "delete_confirmation") {
    if (/^(confirm delete|yes,? delete|haan,? delete)$/i.test(clean)) {
      responseText = "Your Smriti tasks and message history have been deleted.";
      deleteAfterReply = true;
    } else {
      await ctx.runMutation(internalApi.smriti.clearPending, { userId: begun.userId });
      responseText = "Data deletion cancelled.";
    }
  } else if (/^(help|menu)$/i.test(clean)) {
    responseText = "Send a task with its date and time. You can also send “tasks”, reply “done” to a reminder, or reply “cancel” to cancel it.";
  } else if (/^(tasks|list tasks|pending tasks|mere tasks)$/i.test(clean)) {
    const tasks = await ctx.runQuery(internalApi.smriti.listOpenForMessage, { userId: begun.userId }) as Array<{
      title: string;
      dueAt: number;
      urgent: boolean;
      important: boolean;
    }>;
    responseText = tasks.length === 0
      ? "You have no pending tasks."
      : `Pending tasks:\n${tasks.map(taskLine).join("\n")}`;
  } else if (/^delete my data$/i.test(clean)) {
    await ctx.runMutation(internalApi.smriti.savePending, {
      userId: begun.userId,
      kind: "delete_confirmation",
      rawText: clean,
    });
    responseText = "This will permanently delete all your Smriti tasks and message history. Reply “confirm delete” to continue.";
  } else if (/^(done|complete)$/i.test(clean)) {
    if (!input.replyToExternalMessageId) {
      responseText = "Reply “done” directly to the task reminder so I know which task you completed.";
    } else {
      const completed = await ctx.runMutation(internalApi.smriti.completeFromReply, {
        userId: begun.userId,
        replyToExternalMessageId: input.replyToExternalMessageId,
      }) as { title: string; repeating: boolean; nextDueAt: number | null };
      responseText = completed.repeating && completed.nextDueAt
        ? `Done: ${completed.title}. Next reminder: ${formatSmritiTime(completed.nextDueAt)}.`
        : `Done: ${completed.title}.`;
    }
  } else if (/^cancel$/i.test(clean) && input.replyToExternalMessageId) {
    const title = await ctx.runMutation(internalApi.smriti.cancelFromReply, {
      userId: begun.userId,
      replyToExternalMessageId: input.replyToExternalMessageId,
    });
    responseText = `Cancelled: ${title}.`;
  } else if (
    input.replyToExternalMessageId &&
    /\b(?:urgent|important)\b/i.test(clean) &&
    /^(?:make|mark|change|this|it|urgent|important|not)/i.test(clean)
  ) {
    const urgent = /\burgent\b/i.test(clean) && !/\bnot\s+urgent\b/i.test(clean);
    const important = /\bimportant\b/i.test(clean) && !/\bnot\s+important\b/i.test(clean);
    const title = await ctx.runMutation(internalApi.smriti.classifyFromReply, {
      userId: begun.userId,
      replyToExternalMessageId: input.replyToExternalMessageId,
      urgent,
      important,
    });
    const label = urgent && important
      ? "urgent and important"
      : urgent
        ? "urgent, not important"
        : important
          ? "important, not urgent"
          : "not urgent and not important";
    responseText = `Updated: ${title} is ${label}.`;
  } else {
    let interpreted;
    try {
      interpreted = await ctx.runAction(internalApi.smritiAi.interpretTask, {
        text: clean,
        now: Date.now(),
        ...(pending?.kind === "task_details" ? { pendingContext: pending.rawText } : {}),
      });
    } catch {
      interpreted = {
        title: clean,
        hasExplicitDate: false,
        hasExplicitTime: false,
        recurrence: { kind: "none" as const },
      };
    }
    const normalized = normalizeTaskDraft(interpreted);
    if (normalized.kind === "needs_details") {
      await ctx.runMutation(internalApi.smriti.savePending, {
        userId: begun.userId,
        kind: "task_details",
        rawText: pending?.kind === "task_details" ? `${pending.rawText}\n${clean}` : clean,
      });
      responseText = normalized.question;
    } else if (normalized.task.dueAt <= Date.now()) {
      await ctx.runMutation(internalApi.smriti.savePending, {
        userId: begun.userId,
        kind: "task_details",
        rawText: pending?.kind === "task_details" ? `${pending.rawText}\n${clean}` : clean,
      });
      responseText = "That time has already passed. What future date and time should I use?";
    } else if (/^(move|reschedule|change)/i.test(clean) && input.replyToExternalMessageId) {
      const title = await ctx.runMutation(internalApi.smriti.moveFromReply, {
        userId: begun.userId,
        replyToExternalMessageId: input.replyToExternalMessageId,
        dueAt: normalized.task.dueAt,
      });
      await ctx.runMutation(internalApi.smriti.clearPending, { userId: begun.userId });
      responseText = `Changed: ${title} — ${formatSmritiTime(normalized.task.dueAt)}.`;
    } else {
      await ctx.runMutation(internalApi.smriti.createTaskFromInterpretation, {
        userId: begun.userId,
        ...normalized.task,
        channel: input.provider,
      });
      await ctx.runMutation(internalApi.smriti.clearPending, { userId: begun.userId });
      const repeat = normalized.task.recurrence.kind === "none"
        ? ""
        : ` · repeats ${normalized.task.recurrence.kind}`;
      responseText = `Saved: ${normalized.task.title} — ${formatSmritiTime(normalized.task.dueAt)}${repeat}.`;
    }
  }

  let responseExternalMessageId: string | undefined;
  if (input.provider === "whatsapp") {
    const delivery = await ctx.runAction(internalApi.smritiDeliveryAdapter.send, {
      channel: "whatsapp",
      to: input.externalUserId,
      mode: "text",
      text: responseText,
    });
    responseExternalMessageId = delivery.providerMessageId;
    await ctx.runMutation(internalApi.smriti.recordReplyDelivery, {
      userId: begun.userId,
      channel: "whatsapp",
      status: delivery.status,
      providerMessageId: delivery.providerMessageId,
      errorCode: delivery.errorCode,
    });
  }
  await ctx.runMutation(internalApi.smriti.finishInbound, {
    provider: input.provider,
    externalMessageId: input.externalMessageId,
    userId: begun.userId,
    responseText,
    responseExternalMessageId,
  });
  if (deleteAfterReply) {
    await ctx.runMutation(internalApi.smriti.deleteUserDataBatch, { userId: begun.userId });
  }
  return { responseText, duplicate: false };
}

export const sendSimulated = action({
  args: { externalMessageId: v.string(), text: v.string() },
  returns: v.object({ responseText: v.string(), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const ownerUserId = await getAuthUserId(ctx);
    if (ownerUserId === null) throw new Error("Sign in required");
    return await respondToInbound(ctx, {
      provider: "simulator",
      ownerUserId,
      externalMessageId: args.externalMessageId,
      text: args.text,
    });
  },
});

export const processWhatsApp = internalAction({
  args: {
    externalMessageId: v.string(),
    externalUserId: v.string(),
    replyToExternalMessageId: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.object({ responseText: v.string(), duplicate: v.boolean() }),
  handler: async (ctx, args) => await respondToInbound(ctx, {
    provider: "whatsapp",
    ...args,
  }),
});
