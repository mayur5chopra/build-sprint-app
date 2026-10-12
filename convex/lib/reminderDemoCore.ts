import type { FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type CoreCtx = Pick<MutationCtx, "db" | "scheduler">;

export type ReminderChannel = "simulator" | "whatsapp";
type ReminderWorkerReference = FunctionReference<
  "action",
  "internal",
  { reminderId: Id<"reminderDemoReminders">; version: number; attempt: number },
  null
>;

export function checkedText(value: string, label: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new Error(`${label} cannot be empty`);
  if (cleaned.length > 500) throw new Error(`${label} must be 500 characters or fewer`);
  return cleaned;
}

export async function ensureSettings(ctx: CoreCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("reminderDemoSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing !== null) return existing.timezone;
  const now = Date.now();
  await ctx.db.insert("reminderDemoSettings", {
    userId,
    timezone: "Asia/Kolkata",
    createdAt: now,
    updatedAt: now,
  });
  return "Asia/Kolkata";
}

export async function createNoteCore(ctx: CoreCtx, userId: Id<"users">, body: string) {
  const cleanBody = checkedText(body, "Note");
  const now = Date.now();
  return await ctx.db.insert("reminderDemoNotes", {
    userId,
    body: cleanBody,
    searchText: cleanBody.toLocaleLowerCase(),
    createdAt: now,
    updatedAt: now,
  });
}

export async function createTaskCore(ctx: CoreCtx, userId: Id<"users">, title: string) {
  const cleanTitle = checkedText(title, "Task");
  const now = Date.now();
  return await ctx.db.insert("reminderDemoTasks", {
    userId,
    title: cleanTitle,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

export async function createReminderCore(
  ctx: CoreCtx,
  schedulerReference: ReminderWorkerReference,
  userId: Id<"users">,
  input: { text: string; dueAt: number; channel: ReminderChannel },
) {
  const cleanText = checkedText(input.text, "Reminder");
  if (!Number.isFinite(input.dueAt)) throw new Error("Reminder time is invalid");
  if (input.dueAt < Date.now() - 1_000) throw new Error("Reminder time must be in the future");
  const timezone = await ensureSettings(ctx, userId);
  const now = Date.now();
  const reminderId = await ctx.db.insert("reminderDemoReminders", {
    userId,
    text: cleanText,
    dueAt: input.dueAt,
    timezone,
    channel: input.channel,
    status: "scheduled",
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAt(input.dueAt, schedulerReference, { reminderId, version: 1, attempt: 1 });
  return reminderId;
}

export async function listOpenTasksCore(ctx: CoreCtx, userId: Id<"users">) {
  return await ctx.db
    .query("reminderDemoTasks")
    .withIndex("by_user_status_created", (q) =>
      q.eq("userId", userId).eq("status", "open"),
    )
    .order("desc")
    .take(50);
}

export async function listActiveRemindersCore(ctx: CoreCtx, userId: Id<"users">) {
  const recent = await ctx.db
    .query("reminderDemoReminders")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("desc")
    .take(100);
  return recent.filter((item) => item.status !== "completed" && item.status !== "cancelled");
}

export async function completeTaskCore(
  ctx: CoreCtx,
  userId: Id<"users">,
  taskId: Id<"reminderDemoTasks">,
) {
  const task = await ctx.db.get(taskId);
  if (task === null || task.userId !== userId) throw new Error("Task not found");
  const now = Date.now();
  await ctx.db.patch(taskId, { status: "completed", completedAt: now, updatedAt: now });
  return task.title;
}

export async function changeReminderCore(
  ctx: CoreCtx,
  schedulerReference: ReminderWorkerReference,
  userId: Id<"users">,
  reminderId: Id<"reminderDemoReminders">,
  change:
    | { kind: "complete" }
    | { kind: "cancel" }
    | { kind: "snooze"; delayMs: number }
    | { kind: "edit"; text: string; dueAt: number },
) {
  const reminder = await ctx.db.get(reminderId);
  if (reminder === null || reminder.userId !== userId) throw new Error("Reminder not found");
  if (reminder.status === "completed" || reminder.status === "cancelled") {
    throw new Error("Reminder is no longer active");
  }
  const now = Date.now();
  const nextVersion = reminder.version + 1;
  if (change.kind === "complete") {
    await ctx.db.patch(reminderId, {
      status: "completed",
      version: nextVersion,
      completedAt: now,
      updatedAt: now,
    });
    return { text: reminder.text, dueAt: reminder.dueAt };
  }
  if (change.kind === "cancel") {
    await ctx.db.patch(reminderId, {
      status: "cancelled",
      version: nextVersion,
      cancelledAt: now,
      updatedAt: now,
    });
    return { text: reminder.text, dueAt: reminder.dueAt };
  }
  const dueAt = change.kind === "snooze" ? now + change.delayMs : change.dueAt;
  if (!Number.isFinite(dueAt) || dueAt < now) throw new Error("Reminder time must be in the future");
  const text = change.kind === "edit" ? checkedText(change.text, "Reminder") : reminder.text;
  await ctx.db.patch(reminderId, {
    text,
    dueAt,
    status: "scheduled",
    version: nextVersion,
    updatedAt: now,
    completedAt: undefined,
    cancelledAt: undefined,
  });
  await ctx.scheduler.runAt(dueAt, schedulerReference, {
    reminderId,
    version: nextVersion,
    attempt: 1,
  });
  return { text, dueAt };
}
