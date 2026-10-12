import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

const beginInbound = makeFunctionReference<"mutation">("smriti:beginInbound");
const createTask = makeFunctionReference<"mutation">("smriti:createTaskFromInterpretation");
const completeFromReply = makeFunctionReference<"mutation">("smriti:completeFromReply");
const deleteUserDataBatch = makeFunctionReference<"mutation">("smriti:deleteUserDataBatch");

async function makeSmritiUser(t: ReturnType<typeof convexTest>) {
  const ownerUserId = await t.run(async (ctx) => await ctx.db.insert("users", { email: "smriti@example.test" }));
  const begun = await t.mutation(beginInbound, {
    provider: "simulator",
    externalMessageId: "first-message",
    text: "hello",
    ownerUserId,
  });
  return { ownerUserId, smritiUserId: begun.userId };
}

describe("Smriti backend rules", () => {
  test("deduplicates inbound WhatsApp-style message IDs", async () => {
    const t = convexTest(schema, modules);
    const { ownerUserId, smritiUserId } = await makeSmritiUser(t);
    const repeated = await t.mutation(beginInbound, {
      provider: "simulator",
      externalMessageId: "first-message",
      text: "ignored duplicate",
      ownerUserId,
    });
    expect(repeated).toMatchObject({ userId: smritiUserId, duplicate: true });
    const rows = await t.run(async (ctx) =>
      await ctx.db
        .query("smritiInboundMessages")
        .withIndex("by_user_received", (q) => q.eq("userId", smritiUserId))
        .take(10),
    );
    expect(rows).toHaveLength(1);
  });

  test("completes a one-time task from the exact reminder reply and sets 15-day deletion", async () => {
    const t = convexTest(schema, modules);
    const { smritiUserId } = await makeSmritiUser(t);
    const dueAt = Date.now() + 60_000;
    const taskId = await t.mutation(createTask, {
      userId: smritiUserId,
      title: "Submit report",
      dueAt,
      urgent: false,
      important: true,
      recurrence: { kind: "none" },
      channel: "simulator",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("smritiMessages", {
        userId: smritiUserId,
        role: "assistant",
        text: "Reminder",
        source: "scheduled",
        externalMessageId: "wamid.task-one",
        taskId,
        createdAt: Date.now(),
      });
    });
    const before = Date.now();
    const result = await t.mutation(completeFromReply, {
      userId: smritiUserId,
      replyToExternalMessageId: "wamid.task-one",
    });
    const task = await t.run(async (ctx) => await ctx.db.get(taskId));
    expect(result).toMatchObject({ title: "Submit report", repeating: false, nextDueAt: null });
    expect(task?.status).toBe("completed");
    expect(task?.deleteAfter).toBeGreaterThanOrEqual(before + 15 * 24 * 60 * 60 * 1000);
  });

  test("completing a repeating task schedules its next occurrence", async () => {
    const t = convexTest(schema, modules);
    const { smritiUserId } = await makeSmritiUser(t);
    const dueAt = Date.now() + 60_000;
    const taskId = await t.mutation(createTask, {
      userId: smritiUserId,
      title: "Weekly review",
      dueAt,
      urgent: false,
      important: true,
      recurrence: { kind: "weekly", interval: 1 },
      channel: "simulator",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("smritiMessages", {
        userId: smritiUserId,
        role: "assistant",
        text: "Reminder",
        source: "scheduled",
        externalMessageId: "wamid.weekly",
        taskId,
        createdAt: Date.now(),
      });
    });
    const result = await t.mutation(completeFromReply, {
      userId: smritiUserId,
      replyToExternalMessageId: "wamid.weekly",
    });
    const task = await t.run(async (ctx) => await ctx.db.get(taskId));
    expect(result).toMatchObject({ repeating: true, nextDueAt: dueAt + 7 * 24 * 60 * 60 * 1000 });
    expect(task).toMatchObject({ status: "open", version: 2, deliveryStatus: "scheduled" });
  });

  test("deleting Smriti data does not delete the old Kamini data", async () => {
    const t = convexTest(schema, modules);
    const { ownerUserId, smritiUserId } = await makeSmritiUser(t);
    const memoryId = await t.run(async (ctx) => await ctx.db.insert("memories", {
      userId: ownerUserId,
      kind: "like",
      note: "likes chai",
      sourceText: "I like chai",
      createdAt: Date.now(),
    }));
    await expect(t.mutation(deleteUserDataBatch, { userId: smritiUserId })).resolves.toBe(true);
    const result = await t.run(async (ctx) => ({
      smritiUser: await ctx.db.get(smritiUserId),
      kaminiMemory: await ctx.db.get(memoryId),
    }));
    expect(result.smritiUser).toBeNull();
    expect(result.kaminiMemory?.note).toBe("likes chai");
  });
});
