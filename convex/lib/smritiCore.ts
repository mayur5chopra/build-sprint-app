import type { FunctionReference } from "convex/server";
import { completedTaskDeleteAt, nextOccurrenceAt, nextSummaryAt } from "../../shared/smritiRules";
import type { SmritiRecurrence } from "../../shared/smritiRules";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReadCtx = Pick<QueryCtx, "db">;
type WriteCtx = Pick<MutationCtx, "db" | "scheduler">;
type TaskWorkerReference = FunctionReference<
  "action",
  "internal",
  { taskId: Id<"smritiTasks">; version: number; attempt: number },
  null
>;

export type SmritiChannel = "simulator" | "whatsapp";

export function cleanSmritiText(value: string, label: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new Error(`${label} cannot be empty`);
  if (cleaned.length > 500) throw new Error(`${label} must be 500 characters or fewer`);
  return cleaned;
}

export async function findSmritiUserByOwner(ctx: ReadCtx, ownerUserId: Id<"users">) {
  return await ctx.db
    .query("smritiUsers")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
    .unique();
}

export async function ensureSmritiUserForOwner(ctx: WriteCtx, ownerUserId: Id<"users">) {
  const existing = await findSmritiUserByOwner(ctx, ownerUserId);
  if (existing !== null) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("smritiUsers", {
    ownerUserId,
    timezone: "Asia/Kolkata",
    summaryHour: 8,
    nextSummaryAt: nextSummaryAt(now),
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureSmritiUserForWhatsApp(ctx: WriteCtx, whatsappId: string) {
  const cleanId = whatsappId.trim();
  if (!/^\d{8,20}$/.test(cleanId)) throw new Error("WhatsApp identity is invalid");
  const existing = await ctx.db
    .query("smritiUsers")
    .withIndex("by_whatsapp", (q) => q.eq("whatsappId", cleanId))
    .unique();
  if (existing !== null) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("smritiUsers", {
    whatsappId: cleanId,
    timezone: "Asia/Kolkata",
    summaryHour: 8,
    nextSummaryAt: nextSummaryAt(now),
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

export async function createSmritiTask(
  ctx: WriteCtx,
  worker: TaskWorkerReference,
  userId: Id<"smritiUsers">,
  input: {
    title: string;
    dueAt: number;
    recurrence: SmritiRecurrence;
    urgent: boolean;
    important: boolean;
    channel: SmritiChannel;
  },
) {
  const title = cleanSmritiText(input.title, "Task");
  const now = Date.now();
  if (!Number.isFinite(input.dueAt) || input.dueAt <= now) throw new Error("Task time must be in the future");
  const taskId = await ctx.db.insert("smritiTasks", {
    userId,
    title,
    dueAt: input.dueAt,
    timezone: "Asia/Kolkata",
    recurrence: input.recurrence,
    urgent: input.urgent,
    important: input.important,
    status: "open",
    deliveryStatus: "scheduled",
    channel: input.channel,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAt(input.dueAt, worker, { taskId, version: 1, attempt: 1 });
  return taskId;
}

export async function listOpenSmritiTasks(ctx: ReadCtx, userId: Id<"smritiUsers">) {
  return await ctx.db
    .query("smritiTasks")
    .withIndex("by_user_status_due", (q) => q.eq("userId", userId).eq("status", "open"))
    .order("asc")
    .take(100);
}

export async function completeSmritiTask(
  ctx: WriteCtx,
  worker: TaskWorkerReference,
  userId: Id<"smritiUsers">,
  taskId: Id<"smritiTasks">,
) {
  const task = await ctx.db.get(taskId);
  if (task === null || task.userId !== userId) throw new Error("Task not found");
  if (task.status !== "open") throw new Error("Task is no longer open");
  const now = Date.now();
  const nextDueAt = nextOccurrenceAt(task.dueAt, task.recurrence);
  const nextVersion = task.version + 1;
  if (nextDueAt !== null) {
    let futureDueAt = nextDueAt;
    while (futureDueAt <= now) {
      const following = nextOccurrenceAt(futureDueAt, task.recurrence);
      if (following === null) break;
      futureDueAt = following;
    }
    await ctx.db.patch(taskId, {
      dueAt: futureDueAt,
      deliveryStatus: "scheduled",
      version: nextVersion,
      lastReminderAt: undefined,
      lastSummaryAt: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(futureDueAt, worker, { taskId, version: nextVersion, attempt: 1 });
    return { title: task.title, repeating: true, nextDueAt: futureDueAt };
  }
  await ctx.db.patch(taskId, {
    status: "completed",
    version: nextVersion,
    completedAt: now,
    deleteAfter: completedTaskDeleteAt(now),
    updatedAt: now,
  });
  return { title: task.title, repeating: false, nextDueAt: null };
}

export async function cancelSmritiTask(
  ctx: WriteCtx,
  userId: Id<"smritiUsers">,
  taskId: Id<"smritiTasks">,
) {
  const task = await ctx.db.get(taskId);
  if (task === null || task.userId !== userId) throw new Error("Task not found");
  if (task.status !== "open") throw new Error("Task is no longer open");
  const now = Date.now();
  await ctx.db.patch(taskId, {
    status: "cancelled",
    version: task.version + 1,
    cancelledAt: now,
    updatedAt: now,
  });
  return task.title;
}

export async function moveSmritiTask(
  ctx: WriteCtx,
  worker: TaskWorkerReference,
  userId: Id<"smritiUsers">,
  taskId: Id<"smritiTasks">,
  dueAt: number,
) {
  const task = await ctx.db.get(taskId);
  if (task === null || task.userId !== userId) throw new Error("Task not found");
  const now = Date.now();
  if (task.status !== "open") throw new Error("Task is no longer open");
  if (!Number.isFinite(dueAt) || dueAt <= now) throw new Error("Task time must be in the future");
  const version = task.version + 1;
  await ctx.db.patch(taskId, {
    dueAt,
    deliveryStatus: "scheduled",
    version,
    lastReminderAt: undefined,
    updatedAt: now,
  });
  await ctx.scheduler.runAt(dueAt, worker, { taskId, version, attempt: 1 });
  return task.title;
}
