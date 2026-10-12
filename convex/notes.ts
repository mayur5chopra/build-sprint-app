import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createNoteCore } from "./lib/reminderDemoCore";

const noteResult = v.object({
  _id: v.id("reminderDemoNotes"),
  body: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const create = mutation({
  args: { body: v.string() },
  returns: v.id("reminderDemoNotes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    return await createNoteCore(ctx, userId, args.body);
  },
});

export const list = query({
  args: {},
  returns: v.array(noteResult),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const notes = await ctx.db
      .query("reminderDemoNotes")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return notes.map(({ _id, body, createdAt, updatedAt }) => ({ _id, body, createdAt, updatedAt }));
  },
});

export const search = query({
  args: { query: v.string() },
  returns: v.array(noteResult),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const search = args.query.trim().toLocaleLowerCase();
    if (!search) return [];
    const notes = await ctx.db
      .query("reminderDemoNotes")
      .withSearchIndex("search_body", (q) => q.search("searchText", search).eq("userId", userId))
      .take(20);
    return notes.map(({ _id, body, createdAt, updatedAt }) => ({ _id, body, createdAt, updatedAt }));
  },
});
