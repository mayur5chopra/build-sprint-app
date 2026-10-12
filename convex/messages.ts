import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { parseReminderCommand, reminderDemoHelp } from "../shared/reminderCommands.js";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  changeReminderCore,
  createNoteCore,
  createReminderCore,
  createTaskCore,
  listActiveRemindersCore,
  listOpenTasksCore,
} from "./lib/reminderDemoCore";

const internalApi = internal as any;

const messageResult = v.object({
  _id: v.id("reminderDemoMessages"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  text: v.string(),
  source: v.union(v.literal("simulator"), v.literal("whatsapp"), v.literal("scheduled")),
  createdAt: v.number(),
});

function numbered(items: string[], empty: string) {
  if (items.length === 0) return empty;
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

async function executeCommand(
  ctx: any,
  userId: Id<"users">,
  text: string,
  channel: "simulator" | "whatsapp",
) {
  const command = parseReminderCommand(text);
  switch (command.kind) {
    case "help":
      return reminderDemoHelp;
    case "invalid":
      return command.reason;
    case "save_note":
      await createNoteCore(ctx, userId, command.body);
      return `Saved note: ${command.body}`;
    case "list_notes": {
      const notes = await ctx.db
        .query("reminderDemoNotes")
        .withIndex("by_user_created", (q: any) => q.eq("userId", userId))
        .order("desc")
        .take(20);
      return numbered(notes.map((note: any) => note.body), "No notes saved yet.");
    }
    case "find_notes": {
      const notes = await ctx.db
        .query("reminderDemoNotes")
        .withSearchIndex("search_body", (q: any) =>
          q.search("searchText", command.query.toLocaleLowerCase()).eq("userId", userId),
        )
        .take(20);
      return numbered(notes.map((note: any) => note.body), `No notes found for “${command.query}”.`);
    }
    case "create_task":
      await createTaskCore(ctx, userId, command.title);
      return `Created task: ${command.title}`;
    case "list_tasks": {
      const tasks = await listOpenTasksCore(ctx, userId);
      return numbered(tasks.map((task: any) => task.title), "No open tasks.");
    }
    case "complete_task": {
      const tasks = await listOpenTasksCore(ctx, userId);
      const task = tasks[command.position - 1];
      if (!task) return `Open task ${command.position} was not found. Send “tasks” to refresh the list.`;
      await ctx.db.patch(task._id, { status: "completed", completedAt: Date.now(), updatedAt: Date.now() });
      return `Completed task: ${task.title}`;
    }
    case "create_reminder": {
      await createReminderCore(ctx, internalApi.reminderWorker.deliver, userId, {
        text: command.text,
        dueAt: command.dueAt,
        channel,
      });
      return `Reminder set for ${new Date(command.dueAt).toISOString()}: ${command.text}`;
    }
    case "list_reminders": {
      const reminders = await listActiveRemindersCore(ctx, userId);
      return numbered(
        reminders.map((reminder: any) =>
          `${reminder.text} — ${new Date(reminder.dueAt).toISOString()} (${reminder.status})`,
        ),
        "No active reminders.",
      );
    }
    case "complete_reminder":
    case "cancel_reminder":
    case "snooze_reminder": {
      const reminders = await listActiveRemindersCore(ctx, userId);
      const reminder = reminders[command.position - 1];
      if (!reminder) return `Reminder ${command.position} was not found. Send “reminders” to refresh the list.`;
      if (command.kind === "complete_reminder") {
        await changeReminderCore(ctx, internalApi.reminderWorker.deliver, userId, reminder._id, { kind: "complete" });
        return `Completed reminder: ${reminder.text}`;
      }
      if (command.kind === "cancel_reminder") {
        await changeReminderCore(ctx, internalApi.reminderWorker.deliver, userId, reminder._id, { kind: "cancel" });
        return `Cancelled reminder: ${reminder.text}`;
      }
      const changed = await changeReminderCore(ctx, internalApi.reminderWorker.deliver, userId, reminder._id, {
        kind: "snooze",
        delayMs: command.delayMs,
      });
      return `Snoozed until ${new Date(changed.dueAt).toISOString()}: ${changed.text}`;
    }
  }
}

async function processInbound(
  ctx: any,
  input: {
    userId: Id<"users">;
    provider: "simulator" | "whatsapp";
    externalMessageId: string;
    text: string;
  },
) {
  const messageId = input.externalMessageId.trim();
  if (!messageId || messageId.length > 200) throw new Error("Message ID is invalid");
  const existing = await ctx.db
    .query("reminderDemoInboundMessages")
    .withIndex("by_provider_message", (q: any) =>
      q.eq("provider", input.provider).eq("externalMessageId", messageId),
    )
    .unique();
  if (existing !== null) {
    if (existing.userId !== input.userId) throw new Error("Message ID is already owned by another user");
    return { responseText: existing.responseText, duplicate: true };
  }

  const cleanText = input.text.trim();
  if (!cleanText || cleanText.length > 500) throw new Error("Message must be between 1 and 500 characters");
  const responseText = await executeCommand(ctx, input.userId, cleanText, input.provider);
  const now = Date.now();
  await ctx.db.insert("reminderDemoInboundMessages", {
    userId: input.userId,
    provider: input.provider,
    externalMessageId: messageId,
    text: cleanText,
    receivedAt: now,
    processedAt: now,
    responseText,
  });
  await ctx.db.insert("reminderDemoMessages", {
    userId: input.userId,
    role: "user",
    text: cleanText,
    source: input.provider,
    createdAt: now,
  });
  await ctx.db.insert("reminderDemoMessages", {
    userId: input.userId,
    role: "assistant",
    text: responseText,
    source: input.provider,
    createdAt: now + 1,
  });
  return { responseText, duplicate: false };
}

export const sendSimulated = mutation({
  args: { externalMessageId: v.string(), text: v.string() },
  returns: v.object({ responseText: v.string(), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    return await processInbound(ctx, {
      userId,
      provider: "simulator",
      externalMessageId: args.externalMessageId,
      text: args.text,
    });
  },
});

export const processWhatsApp = internalMutation({
  args: { externalMessageId: v.string(), externalUserId: v.string(), text: v.string() },
  returns: v.object({
    status: v.union(v.literal("processed"), v.literal("duplicate"), v.literal("unmapped")),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.db
      .query("reminderDemoChannelIdentities")
      .withIndex("by_provider_external", (q) =>
        q.eq("provider", "whatsapp").eq("externalUserId", args.externalUserId),
      )
      .unique();
    if (identity === null) return { status: "unmapped" as const };
    const result = await processInbound(ctx, {
      userId: identity.userId,
      provider: "whatsapp",
      externalMessageId: args.externalMessageId,
      text: args.text,
    });
    return { status: result.duplicate ? ("duplicate" as const) : ("processed" as const) };
  },
});

export const listConversation = query({
  args: {},
  returns: v.array(messageResult),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const messages = await ctx.db
      .query("reminderDemoMessages")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
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
