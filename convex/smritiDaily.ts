import { v } from "convex/values";
import { canUseMetaFreeform } from "../shared/metaCloud.js";
import { nextSummaryAt } from "../shared/smritiRules";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { listOpenSmritiTasks } from "./lib/smritiCore";

const internalApi = internal as any;
const deliveryResult = v.object({
  status: v.union(v.literal("sent"), v.literal("failed")),
  providerMessageId: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  retryable: v.boolean(),
  networkStarted: v.boolean(),
});

export const claimDueUsers = internalMutation({
  args: { now: v.number() },
  returns: v.array(v.object({
    userId: v.id("smritiUsers"),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    mode: v.union(v.literal("text"), v.literal("template")),
    to: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("smritiUsers")
      .withIndex("by_status_summary", (q) =>
        q.eq("status", "active").lte("nextSummaryAt", args.now),
      )
      .take(50);
    for (const user of users) {
      await ctx.db.patch(user._id, {
        nextSummaryAt: nextSummaryAt(args.now + 1_000),
        updatedAt: args.now,
      });
    }
    return users.map((user) => ({
      userId: user._id,
      channel: user.whatsappId ? ("whatsapp" as const) : ("simulator" as const),
      mode: user.whatsappId && !canUseMetaFreeform(user.lastInboundAt, args.now)
        ? ("template" as const)
        : ("text" as const),
      ...(user.whatsappId ? { to: user.whatsappId } : {}),
    }));
  },
});

export const summaryTasks = internalQuery({
  args: { userId: v.id("smritiUsers") },
  returns: v.array(v.object({
    taskId: v.id("smritiTasks"),
    title: v.string(),
    dueAt: v.number(),
    urgent: v.boolean(),
    important: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const tasks = await listOpenSmritiTasks(ctx, args.userId);
    return tasks.slice(0, 20).map((task) => ({
      taskId: task._id,
      title: task.title,
      dueAt: task.dueAt,
      urgent: task.urgent,
      important: task.important,
    }));
  },
});

export const recordSummary = internalMutation({
  args: {
    userId: v.id("smritiUsers"),
    taskIds: v.array(v.id("smritiTasks")),
    channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
    text: v.string(),
    result: deliveryResult,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("smritiDeliveryAttempts", {
      userId: args.userId,
      attempt: 1,
      kind: "daily_summary",
      channel: args.channel,
      status: args.result.status,
      providerMessageId: args.result.providerMessageId,
      errorCode: args.result.errorCode,
      createdAt: now,
      updatedAt: now,
    });
    if (args.result.status === "sent") {
      await ctx.db.insert("smritiMessages", {
        userId: args.userId,
        role: "assistant",
        text: args.text,
        source: "scheduled",
        externalMessageId: args.result.providerMessageId,
        createdAt: now,
      });
      for (const taskId of args.taskIds) {
        const task = await ctx.db.get(taskId);
        if (task !== null && task.userId === args.userId && task.status === "open") {
          await ctx.db.patch(taskId, { lastSummaryAt: now, updatedAt: now });
        }
      }
    }
    return null;
  },
});

export const run = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.runMutation(internalApi.smritiDaily.claimDueUsers, { now: Date.now() }) as Array<{
      userId: string;
      channel: "simulator" | "whatsapp";
      mode: "text" | "template";
      to?: string;
    }>;
    for (const user of users) {
      const tasks = await ctx.runQuery(internalApi.smritiDaily.summaryTasks, { userId: user.userId }) as Array<{
        taskId: string;
        title: string;
        dueAt: number;
        urgent: boolean;
        important: boolean;
      }>;
      if (tasks.length === 0) continue;
      const text = [
        "Good morning. Your pending work tasks:",
        ...tasks.map((task, index) => `${index + 1}. ${task.title}${task.dueAt < Date.now() ? " — overdue" : ""}`),
      ].join("\n");
      const result = await ctx.runAction(internalApi.smritiDeliveryAdapter.send, {
        channel: user.channel,
        to: user.to,
        mode: user.mode,
        text,
        templateName: process.env.META_DAILY_SUMMARY_TEMPLATE ?? "smriti_daily_summary",
        templateParameters: [text.slice(0, 900)],
      });
      await ctx.runMutation(internalApi.smritiDaily.recordSummary, {
        userId: user.userId,
        taskIds: tasks.map((task) => task.taskId),
        channel: user.channel,
        text,
        result,
      });
    }
    return null;
  },
});

export const cleanupCompleted = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const tasks = await ctx.db
      .query("smritiTasks")
      .withIndex("by_status_delete_after", (q) =>
        q.eq("status", "completed").lte("deleteAfter", now),
      )
      .take(100);
    for (const task of tasks) {
      const [messages, attempts] = await Promise.all([
        ctx.db.query("smritiMessages").withIndex("by_task", (q) => q.eq("taskId", task._id)).take(100),
        ctx.db.query("smritiDeliveryAttempts").withIndex("by_task", (q) => q.eq("taskId", task._id)).take(100),
      ]);
      for (const message of messages) await ctx.db.delete(message._id);
      for (const attempt of attempts) await ctx.db.delete(attempt._id);
      await ctx.db.delete(task._id);
    }
    const expiredPending = await ctx.db
      .query("smritiPendingInputs")
      .withIndex("by_expires", (q) => q.lte("expiresAt", now))
      .take(100);
    for (const pending of expiredPending) await ctx.db.delete(pending._id);
    return tasks.length + expiredPending.length;
  },
});
