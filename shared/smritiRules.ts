export type SmritiRecurrence =
  | { kind: "none" }
  | { kind: "daily" | "weekly" | "monthly"; interval: number };

export type SmritiTaskDraft = {
  title?: string | null;
  dueAt?: number | null;
  hasExplicitDate?: boolean;
  hasExplicitTime?: boolean;
  urgent?: boolean | null;
  important?: boolean | null;
  recurrence?: SmritiRecurrence | null;
};

export type ReadySmritiTask = {
  title: string;
  dueAt: number;
  urgent: boolean;
  important: boolean;
  recurrence: SmritiRecurrence;
};

export type NormalizedTaskDraft =
  | { kind: "needs_details"; question: string }
  | { kind: "ready"; task: ReadySmritiTask };

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeTaskDraft(draft: SmritiTaskDraft): NormalizedTaskDraft {
  const title = draft.title?.trim().replace(/\s+/g, " ") ?? "";
  if (!title) {
    return { kind: "needs_details", question: "What task should I remind you about?" };
  }
  if (!draft.hasExplicitDate && !draft.hasExplicitTime) {
    return {
      kind: "needs_details",
      question: "When should I remind you? Please include a date and time.",
    };
  }
  if (!draft.hasExplicitDate) {
    return { kind: "needs_details", question: "Which date should I remind you?" };
  }
  if (!draft.hasExplicitTime) {
    return { kind: "needs_details", question: "What time should I remind you?" };
  }
  if (!Number.isFinite(draft.dueAt)) {
    return {
      kind: "needs_details",
      question: "When should I remind you? Please include a date and time.",
    };
  }
  const recurrence = draft.recurrence ?? { kind: "none" as const };
  if (recurrence.kind !== "none" && (!Number.isInteger(recurrence.interval) || recurrence.interval < 1 || recurrence.interval > 365)) {
    return { kind: "needs_details", question: "How often should this task repeat?" };
  }
  return {
    kind: "ready",
    task: {
      title,
      dueAt: draft.dueAt as number,
      urgent: draft.urgent ?? false,
      important: draft.important ?? true,
      recurrence,
    },
  };
}

export function nextOccurrenceAt(dueAt: number, recurrence: SmritiRecurrence): number | null {
  if (recurrence.kind === "none") return null;
  if (recurrence.kind === "daily") return dueAt + recurrence.interval * DAY_MS;
  if (recurrence.kind === "weekly") return dueAt + recurrence.interval * 7 * DAY_MS;

  const current = new Date(dueAt);
  const originalDay = current.getUTCDate();
  const targetMonthStart = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth() + recurrence.interval,
    1,
    current.getUTCHours(),
    current.getUTCMinutes(),
    current.getUTCSeconds(),
    current.getUTCMilliseconds(),
  ));
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  targetMonthStart.setUTCDate(Math.min(originalDay, lastDay));
  return targetMonthStart.getTime();
}

export function nextSummaryAt(now: number): number {
  const current = new Date(now);
  let candidate = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate(),
    2,
    30,
  );
  if (candidate <= now) candidate += DAY_MS;
  return candidate;
}

export function indiaLocalIso(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+05:30`;
}

export function completedTaskDeleteAt(completedAt: number): number {
  return completedAt + 15 * DAY_MS;
}

export function hasExactRelativeDuration(text: string): boolean {
  return /\bin\s+\d+\s+(?:seconds?|minutes?|hours?|days?)\b/i.test(text);
}

export function formatSmritiTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
