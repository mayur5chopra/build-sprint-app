import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { buildMetaTemplatePayload, buildMetaTextPayload, extractMetaTextMessages } from "../shared/metaCloud.js";
import { createMetaSignature, verifyMetaSignature } from "../shared/metaSignature.js";
import { parseReminderCommand } from "../shared/reminderCommands.js";

const modules = import.meta.glob("../convex/**/*.ts");

const createNote = makeFunctionReference<"mutation">("notes:create");
const listNotes = makeFunctionReference<"query">("notes:list");
const searchNotes = makeFunctionReference<"query">("notes:search");
const createTask = makeFunctionReference<"mutation">("tasks:create");
const completeTask = makeFunctionReference<"mutation">("tasks:complete");
const listTasks = makeFunctionReference<"query">("tasks:list");
const createReminder = makeFunctionReference<"mutation">("reminders:create");
const cancelReminder = makeFunctionReference<"mutation">("reminders:cancel");
const snoozeReminder = makeFunctionReference<"mutation">("reminders:snooze");
const listReminders = makeFunctionReference<"query">("reminders:list");
const sendSimulated = makeFunctionReference<"mutation">("messages:sendSimulated");
const claimDelivery = makeFunctionReference<"mutation">("reminderWorker:claim");

async function testUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run(async (ctx) => await ctx.db.insert("users", { email }));
}

function signedIn(t: ReturnType<typeof convexTest>, userId: string) {
  return t.withIdentity({ subject: `${userId}|test-session` });
}

describe("deterministic command parsing", () => {
  test("parses notes, tasks, reminders and snooze without AI guessing", () => {
    const now = Date.UTC(2026, 9, 13, 10, 0, 0);
    expect(parseReminderCommand("note: passport is in blue drawer", now)).toEqual({
      kind: "save_note",
      body: "passport is in blue drawer",
    });
    expect(parseReminderCommand("task: buy milk", now)).toEqual({ kind: "create_task", title: "buy milk" });
    expect(parseReminderCommand("remind me in 10 minutes to call Mum", now)).toEqual({
      kind: "create_reminder",
      text: "call Mum",
      dueAt: now + 600_000,
    });
    expect(parseReminderCommand("snooze reminder 2 for 5 minutes", now)).toEqual({
      kind: "snooze_reminder",
      position: 2,
      delayMs: 300_000,
    });
    expect(parseReminderCommand("remind me sometime tomorrow", now)).toEqual({
      kind: "invalid",
      reason: "I did not guess. Type help to see the supported commands.",
    });
  });
});

describe("Meta boundary", () => {
  test("accepts only a valid HMAC signature", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const signature = await createMetaSignature(body, "test-secret");
    await expect(verifyMetaSignature(body, signature, "test-secret")).resolves.toBe(true);
    await expect(verifyMetaSignature(`${body}x`, signature, "test-secret")).resolves.toBe(false);
    await expect(verifyMetaSignature(body, null, "test-secret")).resolves.toBe(false);
  });

  test("extracts supported text safely and keeps templates unimplemented", () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [
        { id: "wamid.1", from: "919999999999", type: "text", text: { body: "tasks" } },
        { id: "wamid.2", from: "919999999999", type: "image" },
      ] } }] }],
    };
    expect(extractMetaTextMessages(payload)).toEqual([
      { externalMessageId: "wamid.1", externalUserId: "919999999999", text: "tasks" },
    ]);
    expect(buildMetaTextPayload("919999999999", "hello")).toMatchObject({ type: "text", to: "919999999999" });
    expect(() => buildMetaTemplatePayload()).toThrow("Template sending is not implemented");
  });
});

describe("Convex ownership and message safety", () => {
  test("keeps notes and tasks private and blocks cross-user writes", async () => {
    const t = convexTest(schema, modules);
    const userA = await testUser(t, "a@example.test");
    const userB = await testUser(t, "b@example.test");
    const a = signedIn(t, userA);
    const b = signedIn(t, userB);

    await a.mutation(createNote, { body: "A private passport note" });
    const taskId = await a.mutation(createTask, { title: "A private task" });

    expect(await a.query(listNotes, {})).toHaveLength(1);
    expect(await b.query(listNotes, {})).toEqual([]);
    expect(await b.query(searchNotes, { query: "passport" })).toEqual([]);
    expect(await b.query(listTasks, {})).toEqual([]);
    await expect(b.mutation(completeTask, { taskId })).rejects.toThrow("Task not found");
    expect((await a.query(listTasks, {}))[0].status).toBe("open");
  });

  test("deduplicates inbound IDs without leaking another user's response", async () => {
    const t = convexTest(schema, modules);
    const userA = await testUser(t, "a@example.test");
    const userB = await testUser(t, "b@example.test");
    const a = signedIn(t, userA);
    const b = signedIn(t, userB);

    const first = await a.mutation(sendSimulated, { externalMessageId: "same-id", text: "note: one copy" });
    const repeated = await a.mutation(sendSimulated, { externalMessageId: "same-id", text: "note: ignored" });
    expect(first.duplicate).toBe(false);
    expect(repeated).toEqual({ ...first, duplicate: true });
    expect(await a.query(listNotes, {})).toHaveLength(1);
    await expect(
      b.mutation(sendSimulated, { externalMessageId: "same-id", text: "notes" }),
    ).rejects.toThrow("already owned by another user");
  });

  test("blocks cross-user reminder changes and skips a cancelled stale job", async () => {
    const t = convexTest(schema, modules);
    const userA = await testUser(t, "a@example.test");
    const userB = await testUser(t, "b@example.test");
    const a = signedIn(t, userA);
    const b = signedIn(t, userB);
    const dueAt = Date.now() + 60_000;
    const reminderId = await a.mutation(createReminder, { text: "private reminder", dueAt });

    expect(await b.query(listReminders, {})).toEqual([]);
    await expect(b.mutation(snoozeReminder, { reminderId, delayMs: 60_000 })).rejects.toThrow("Reminder not found");
    await a.mutation(cancelReminder, { reminderId });
    const claim = await t.mutation(claimDelivery, { reminderId, version: 1, attempt: 1 });
    expect(claim).toBeNull();
    const attempts = await t.run(async (ctx) =>
      await ctx.db
        .query("reminderDemoDeliveryAttempts")
        .withIndex("by_reminder_version_attempt", (q) =>
          q.eq("reminderId", reminderId).eq("reminderVersion", 1).eq("attempt", 1),
        )
        .unique(),
    );
    expect(attempts?.status).toBe("skipped");
  });
});
