import { describe, expect, test } from "vitest";
import {
  completedTaskDeleteAt,
  indiaLocalIso,
  hasExactRelativeDuration,
  nextOccurrenceAt,
  nextSummaryAt,
  normalizeTaskDraft,
} from "../shared/smritiRules";

describe("Smriti task rules", () => {
  test("asks for a missing date or time instead of guessing", () => {
    expect(normalizeTaskDraft({ title: "send the proposal" })).toEqual({
      kind: "needs_details",
      question: "When should I remind you? Please include a date and time.",
    });
    expect(normalizeTaskDraft({
      title: "send the proposal",
      dueAt: Date.UTC(2026, 9, 14, 10),
      hasExplicitDate: true,
      hasExplicitTime: false,
    })).toEqual({
      kind: "needs_details",
      question: "What time should I remind you?",
    });
  });

  test("accepts a complete one-time task and keeps its classification", () => {
    const dueAt = Date.UTC(2026, 9, 14, 10, 30);
    expect(normalizeTaskDraft({
      title: "send the proposal",
      dueAt,
      hasExplicitDate: true,
      hasExplicitTime: true,
      urgent: false,
      important: true,
      recurrence: { kind: "none" },
    })).toEqual({
      kind: "ready",
      task: {
        title: "send the proposal",
        dueAt,
        urgent: false,
        important: true,
        recurrence: { kind: "none" },
      },
    });
  });

  test("advances daily, weekly and monthly repeating tasks", () => {
    const dueAt = Date.UTC(2026, 0, 31, 4, 30);
    expect(nextOccurrenceAt(dueAt, { kind: "daily", interval: 1 })).toBe(Date.UTC(2026, 1, 1, 4, 30));
    expect(nextOccurrenceAt(dueAt, { kind: "weekly", interval: 2 })).toBe(Date.UTC(2026, 1, 14, 4, 30));
    expect(nextOccurrenceAt(dueAt, { kind: "monthly", interval: 1 })).toBe(Date.UTC(2026, 1, 28, 4, 30));
    expect(nextOccurrenceAt(dueAt, { kind: "none" })).toBeNull();
  });

  test("schedules the next 8 AM India summary", () => {
    expect(nextSummaryAt(Date.UTC(2026, 9, 13, 1, 0))).toBe(Date.UTC(2026, 9, 13, 2, 30));
    expect(nextSummaryAt(Date.UTC(2026, 9, 13, 3, 0))).toBe(Date.UTC(2026, 9, 14, 2, 30));
  });

  test("gives the AI the current India date instead of the UTC date", () => {
    expect(indiaLocalIso(Date.UTC(2026, 9, 12, 19, 43, 5))).toBe("2026-10-13T01:13:05+05:30");
  });

  test("deletes completed tasks after exactly 15 days", () => {
    const completedAt = Date.UTC(2026, 9, 13, 10, 0);
    expect(completedTaskDeleteAt(completedAt)).toBe(completedAt + 15 * 24 * 60 * 60 * 1000);
  });

  test("treats exact relative durations as a complete date and time", () => {
    expect(hasExactRelativeDuration("Remind me in 10 minutes to send it")).toBe(true);
    expect(hasExactRelativeDuration("Remind me tomorrow to send it")).toBe(false);
  });
});
