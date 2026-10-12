import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { completeTaskCore, createTaskCore } from "./lib/reminderDemoCore";

const taskResult = v.object({
  _id: v.id("reminderDemoTasks"),
  title: v.string(),
  status: v.union(v.literal("open"), v.literal("completed")),
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});

export const create = mutation({
  args: { title: v.string() },
  returns: v.id("reminderDemoTasks"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    return await createTaskCore(ctx, userId, args.title);
  },
});

export const list = query({
  args: {},
  returns: v.array(taskResult),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const tasks = await ctx.db
      .query("reminderDemoTasks")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return tasks.map(({ _id, title, status, createdAt, updatedAt, completedAt }) => ({
      _id,
      title,
      status,
      createdAt,
      updatedAt,
      ...(completedAt === undefined ? {} : { completedAt }),
    }));
  },
});

export const complete = mutation({
  args: { taskId: v.id("reminderDemoTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    await completeTaskCore(ctx, userId, args.taskId);
    return null;
  },
});
