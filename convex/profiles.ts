import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ adultConfirmedAt: v.number() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return profile === null
      ? null
      : { adultConfirmedAt: profile.adultConfirmedAt };
  },
});

export const confirmAdult = mutation({
  args: { confirmed: v.literal(true) },
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing === null) {
      await ctx.db.insert("profiles", { userId, adultConfirmedAt: Date.now() });
    }
    return null;
  },
});
