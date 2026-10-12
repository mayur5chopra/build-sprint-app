import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { changeReminderCore, createReminderCore } from "./lib/reminderDemoCore";

const reminderStatus = v.union(
  v.literal("scheduled"),
  v.literal("delivered"),
  v.literal("delivery_failed"),
  v.literal("completed"),
  v.literal("cancelled"),
);

const reminderResult = v.object({
  _id: v.id("reminderDemoReminders"),
  text: v.string(),
  dueAt: v.number(),
  timezone: v.string(),
  channel: v.union(v.literal("simulator"), v.literal("whatsapp")),
  status: reminderStatus,
  version: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const create = mutation({
  args: { text: v.string(), dueAt: v.number() },
  returns: v.id("reminderDemoReminders"),
  handler: async (ctx, args): Promise<Id<"reminderDemoReminders">> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    return await createReminderCore(ctx, internal.reminderWorker.deliver, userId, {
      text: args.text,
      dueAt: args.dueAt,
      channel: "simulator",
    });
  },
});

export const list = query({
  args: {},
  returns: v.array(reminderResult),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const reminders = await ctx.db
      .query("reminderDemoReminders")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return reminders.map(({ _id, text, dueAt, timezone, channel, status, version, createdAt, updatedAt }) => ({
      _id,
      text,
      dueAt,
      timezone,
      channel,
      status,
      version,
      createdAt,
      updatedAt,
    }));
  },
});

export const complete = mutation({
  args: { reminderId: v.id("reminderDemoReminders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    await changeReminderCore(ctx, internal.reminderWorker.deliver, userId, args.reminderId, { kind: "complete" });
    return null;
  },
});

export const cancel = mutation({
  args: { reminderId: v.id("reminderDemoReminders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    await changeReminderCore(ctx, internal.reminderWorker.deliver, userId, args.reminderId, { kind: "cancel" });
    return null;
  },
});

export const snooze = mutation({
  args: { reminderId: v.id("reminderDemoReminders"), delayMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    if (args.delayMs < 1_000 || args.delayMs > 365 * 86_400_000) throw new Error("Snooze duration is invalid");
    await changeReminderCore(ctx, internal.reminderWorker.deliver, userId, args.reminderId, {
      kind: "snooze",
      delayMs: args.delayMs,
    });
    return null;
  },
});

export const edit = mutation({
  args: { reminderId: v.id("reminderDemoReminders"), text: v.string(), dueAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    await changeReminderCore(ctx, internal.reminderWorker.deliver, userId, args.reminderId, {
      kind: "edit",
      text: args.text,
      dueAt: args.dueAt,
    });
    return null;
  },
});
