"use node";

import { v } from "convex/values";
import { generateText } from "ai";
import { sarvam } from "sarvam-ai-sdk";
import { internalAction } from "./_generated/server";
import { parseReminderCommand } from "../shared/reminderCommands.js";
import { hasExactRelativeDuration, indiaLocalIso } from "../shared/smritiRules";

const recurrenceValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    kind: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    interval: v.number(),
  }),
);

const interpretedTaskValidator = v.object({
  title: v.optional(v.string()),
  dueAt: v.optional(v.number()),
  hasExplicitDate: v.boolean(),
  hasExplicitTime: v.boolean(),
  urgent: v.optional(v.boolean()),
  important: v.optional(v.boolean()),
  recurrence: recurrenceValidator,
});

type InterpretedTask = {
  title?: string;
  dueAt?: number;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
  urgent?: boolean;
  important?: boolean;
  recurrence: { kind: "none" } | { kind: "daily" | "weekly" | "monthly"; interval: number };
};

function deterministicFallback(text: string, now: number): InterpretedTask {
  const command = parseReminderCommand(text, now);
  if (command.kind === "create_reminder") {
    return {
      title: command.text,
      dueAt: command.dueAt,
      hasExplicitDate: true,
      hasExplicitTime: true,
      important: true,
      urgent: false,
      recurrence: { kind: "none" },
    };
  }
  const title = text
    .replace(/^(?:remind me(?: to)?|yaad dilana(?: ki)?|task\s*:?)\s*/i, "")
    .trim();
  return {
    ...(title ? { title } : {}),
    hasExplicitDate: false,
    hasExplicitTime: false,
    recurrence: { kind: "none" },
  };
}

function parseModelResult(value: unknown): InterpretedTask {
  if (!value || typeof value !== "object") throw new Error("Sarvam returned an invalid task");
  const result = value as Record<string, unknown>;
  const title = typeof result.title === "string" && result.title.trim() ? result.title.trim() : undefined;
  const dueAt = typeof result.due_at_iso === "string" ? Date.parse(result.due_at_iso) : NaN;
  const recurrenceValue = result.recurrence;
  let recurrence: InterpretedTask["recurrence"] = { kind: "none" };
  if (recurrenceValue && typeof recurrenceValue === "object") {
    const item = recurrenceValue as Record<string, unknown>;
    if (
      (item.kind === "daily" || item.kind === "weekly" || item.kind === "monthly") &&
      typeof item.interval === "number" &&
      Number.isInteger(item.interval) &&
      item.interval >= 1 &&
      item.interval <= 365
    ) {
      recurrence = { kind: item.kind, interval: item.interval };
    }
  }
  return {
    ...(title ? { title } : {}),
    ...(Number.isFinite(dueAt) ? { dueAt } : {}),
    hasExplicitDate: result.has_explicit_date === true,
    hasExplicitTime: result.has_explicit_time === true,
    ...(typeof result.urgent === "boolean" ? { urgent: result.urgent } : {}),
    ...(typeof result.important === "boolean" ? { important: result.important } : {}),
    recurrence,
  };
}

export const interpretTask = internalAction({
  args: {
    text: v.string(),
    now: v.number(),
    pendingContext: v.optional(v.string()),
  },
  returns: interpretedTaskValidator,
  handler: async (_ctx, args): Promise<InterpretedTask> => {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) return deterministicFallback(args.text, args.now);

    const nowIso = indiaLocalIso(args.now);
    const context = args.pendingContext
      ? `This message answers an earlier incomplete task. Earlier message: ${JSON.stringify(args.pendingContext)}.`
      : "This is a new task message.";
    const instructions = [
      "You extract work tasks from English or Hinglish WhatsApp messages for Smriti.",
      `Current local time in India is ${nowIso}. Use its local calendar date for today and tomorrow.`,
      "Never invent a missing calendar date or clock time.",
      "Return only one JSON object. Do not use Markdown or explanations.",
      "Use exactly these keys: title, due_at_iso, has_explicit_date, has_explicit_time, urgent, important, recurrence.",
      "title is a short action or null.",
      "has_explicit_date is true only when the combined messages provide a date, weekday, or relative date such as today or tomorrow.",
      "has_explicit_time is true only when the combined messages provide a clock time or an exact relative duration such as in 20 minutes.",
      "due_at_iso is an ISO-8601 timestamp with +05:30 when both date and time are known; otherwise null.",
      "urgent and important are booleans. If unclear, urgent is false and important is true.",
      "recurrence is an object with kind none, daily, weekly, or monthly and an integer interval of at least 1.",
      "Use recurrence {\"kind\":\"none\",\"interval\":1} when the user did not request repetition.",
      context,
    ].join("\n");
    const result = await generateText({
      model: sarvam("sarvam-105b-conversations"),
      system: instructions,
      prompt: args.text,
      maxOutputTokens: 500,
      temperature: 0,
      providerOptions: { sarvam: { reasoning_effort: "none" } },
    });
    const content = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    if (!content) return deterministicFallback(args.text, args.now);
    try {
      const parsed = parseModelResult(JSON.parse(content));
      const combinedText = args.pendingContext ? `${args.pendingContext}\n${args.text}` : args.text;
      if (parsed.dueAt !== undefined && hasExactRelativeDuration(combinedText)) {
        return { ...parsed, hasExplicitDate: true, hasExplicitTime: true };
      }
      return parsed;
    } catch {
      return deterministicFallback(args.text, args.now);
    }
  },
});
