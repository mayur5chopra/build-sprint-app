import { v } from "convex/values";
import { formatSmritiTime } from "../shared/smritiRules";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const internalApi = internal as any;

const deliveryResult = v.object({
  status: v.union(v.literal("sent"), v.literal("failed")),
  providerMessageId: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  retryable: v.boolean(),
  networkStarted: v.boolean(),
});

export const claim = internalMutation({
  args: {
    taskId: v.id("smritiTasks"),
    version: v.number(),
    attempt: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      attemptId: v.id("smritiDeliveryAttempts"),
      text: v.string(),
      dueText: v.string(),
      channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
      to: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (task === null) return null;
    const existing = await ctx.db
      .query("smritiDeliveryAttempts")
      .withIndex("by_task_version_attempt", (q) =>
        q.eq("taskId", args.taskId).eq("taskVersion", args.version).eq("attempt", args.attempt),
      )
      .unique();
    if (existing !== null) return null;

    const now = Date.now();
    if (task.status !== "open" || task.version !== args.version || task.dueAt > now + 1_000) {
      await ctx.db.insert("smritiDeliveryAttempts", {
        userId: task.userId,
        taskId: task._id,
        taskVersion: args.version,
        attempt: args.attempt,
        kind: "task_reminder",
        channel: task.channel,
        status: "skipped",
        errorCode: "stale_or_not_due",
        createdAt: now,
        updatedAt: now,
      });
      return null;
    }
    const user = await ctx.db.get(task.userId);
    if (user === null || user.status !== "active") return null;
    const attemptId = await ctx.db.insert("smritiDeliveryAttempts", {
      userId: task.userId,
      taskId: task._id,
      taskVersion: args.version,
      attempt: args.attempt,
      kind: "task_reminder",
      channel: task.channel,
      status: "sending",
      createdAt: now,
      updatedAt: now,
    });
    return {
      attemptId,
      text: task.title,
      dueText: formatSmritiTime(task.dueAt),
      channel: task.channel,
      ...(user.whatsappId ? { to: user.whatsappId } : {}),
    };
  },
});

export const finalize = internalMutation({
  args: {
    attemptId: v.id("smritiDeliveryAttempts"),
    taskId: v.id("smritiTasks"),
    version: v.number(),
    attempt: v.number(),
    result: deliveryResult,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    const task = await ctx.db.get(args.taskId);
    if (attempt === null || task === null) return null;
    const now = Date.now();
    const stale = task.version !== args.version || task.status !== "open";
    if (stale) {
      await ctx.db.patch(args.attemptId, {
        status: args.result.networkStarted ? "unknown" : "skipped",
        errorCode: args.result.networkStarted
          ? "state_changed_after_send_started"
          : "state_changed_before_delivery",
        updatedAt: now,
      });
      return null;
    }
    if (args.result.status === "sent") {
      await ctx.db.patch(args.attemptId, {
        status: "sent",
        providerMessageId: args.result.providerMessageId,
        updatedAt: now,
      });
      await ctx.db.patch(args.taskId, {
        deliveryStatus: "delivered",
        lastReminderAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("smritiMessages", {
        userId: task.userId,
        role: "assistant",
        text: `⏰ Reminder: ${task.title}\nReply “done” to mark it complete.`,
        source: "scheduled",
        externalMessageId: args.result.providerMessageId,
        taskId: task._id,
        createdAt: now,
      });
      return null;
    }

    await ctx.db.patch(args.attemptId, {
      status: "failed",
      errorCode: args.result.errorCode ?? "delivery_failed",
      updatedAt: now,
    });
    if (args.result.retryable && args.attempt < 3) {
      await ctx.scheduler.runAfter(60_000 * args.attempt, internalApi.smritiWorker.deliverTask, {
        taskId: args.taskId,
        version: args.version,
        attempt: args.attempt + 1,
      });
    } else {
      await ctx.db.patch(args.taskId, { deliveryStatus: "delivery_failed", updatedAt: now });
    }
    return null;
  },
});

export const deliverTask = internalAction({
  args: {
    taskId: v.id("smritiTasks"),
    version: v.number(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internalApi.smritiWorker.claim, args) as null | {
      attemptId: string;
      text: string;
      dueText: string;
      channel: "simulator" | "whatsapp";
      to?: string;
    };
    if (claimed === null) return null;
    const result = await ctx.runAction(internalApi.smritiDeliveryAdapter.send, {
      channel: claimed.channel,
      to: claimed.to,
      mode: claimed.channel === "whatsapp" ? "template" : "text",
      text: `⏰ Reminder: ${claimed.text}`,
      templateName: process.env.META_TASK_REMINDER_TEMPLATE ?? "smriti_task_due",
      templateParameters: [claimed.text, claimed.dueText],
    });
    await ctx.runMutation(internalApi.smritiWorker.finalize, {
      ...args,
      attemptId: claimed.attemptId,
      result,
    });
    return null;
  },
});
