const MAX_TEXT_LENGTH = 500;

const cleanText = (value) => value.trim().replace(/\s+/g, " ");

/** @typedef {{ kind: "help" } | { kind: "invalid", reason: string } | { kind: "save_note", body: string } | { kind: "find_notes", query: string } | { kind: "list_notes" } | { kind: "create_task", title: string } | { kind: "list_tasks" } | { kind: "complete_task", position: number } | { kind: "create_reminder", text: string, dueAt: number } | { kind: "list_reminders" } | { kind: "complete_reminder", position: number } | { kind: "cancel_reminder", position: number } | { kind: "snooze_reminder", position: number, delayMs: number }} ReminderCommand */

/** @typedef {"second" | "seconds" | "minute" | "minutes" | "hour" | "hours" | "day" | "days"} DurationUnit */

/** @param {number} amount @param {DurationUnit} unit */
function durationMs(amount, unit) {
  const multipliers = {
    second: 1_000,
    seconds: 1_000,
    minute: 60_000,
    minutes: 60_000,
    hour: 3_600_000,
    hours: 3_600_000,
    day: 86_400_000,
    days: 86_400_000,
  };
  return amount * multipliers[unit];
}

/**
 * Deterministic command parser for the demo. It deliberately rejects
 * ambiguous dates instead of guessing and creating a wrong reminder.
 * @param {string} rawInput
 * @param {number} now
 * @returns {ReminderCommand}
 */
export function parseReminderCommand(rawInput, now = Date.now()) {
  const input = cleanText(rawInput);
  if (!input) return { kind: "invalid", reason: "Send a command or type help." };
  if (input.length > MAX_TEXT_LENGTH) {
    return { kind: "invalid", reason: `Keep messages under ${MAX_TEXT_LENGTH} characters.` };
  }

  if (/^(help|menu)$/i.test(input)) return { kind: "help" };

  const note = input.match(/^(?:note\s*:|save note\s+)(.+)$/i);
  if (note) return { kind: "save_note", body: cleanText(note[1]) };

  const findNotes = input.match(/^(?:find notes?|search notes?)(?:\s+(?:for\s+)?)?(.+)$/i);
  if (findNotes) return { kind: "find_notes", query: cleanText(findNotes[1]) };
  if (/^(?:notes|list notes)$/i.test(input)) return { kind: "list_notes" };

  const task = input.match(/^(?:task\s*:|add task\s+)(.+)$/i);
  if (task) return { kind: "create_task", title: cleanText(task[1]) };
  if (/^(?:tasks|list tasks)$/i.test(input)) return { kind: "list_tasks" };

  const completeTask = input.match(/^complete task\s+(\d+)$/i);
  if (completeTask) return { kind: "complete_task", position: Number(completeTask[1]) };

  if (/^(?:reminders|list reminders)$/i.test(input)) return { kind: "list_reminders" };

  const reminderBefore = input.match(
    /^remind me in\s+(\d+)\s+(seconds?|minutes?|hours?|days?)\s+to\s+(.+)$/i,
  );
  if (reminderBefore) {
    const amount = Number(reminderBefore[1]);
    if (amount < 1 || amount > 10_000) {
      return { kind: "invalid", reason: "Use a reminder amount from 1 to 10000." };
    }
    return {
      kind: "create_reminder",
      text: cleanText(reminderBefore[3]),
      dueAt: now + durationMs(amount, reminderBefore[2].toLowerCase()),
    };
  }

  const reminderAfter = input.match(
    /^remind me to\s+(.+?)\s+in\s+(\d+)\s+(seconds?|minutes?|hours?|days?)$/i,
  );
  if (reminderAfter) {
    const amount = Number(reminderAfter[2]);
    if (amount < 1 || amount > 10_000) {
      return { kind: "invalid", reason: "Use a reminder amount from 1 to 10000." };
    }
    return {
      kind: "create_reminder",
      text: cleanText(reminderAfter[1]),
      dueAt: now + durationMs(amount, reminderAfter[3].toLowerCase()),
    };
  }

  const completeReminder = input.match(/^complete reminder\s+(\d+)$/i);
  if (completeReminder) return { kind: "complete_reminder", position: Number(completeReminder[1]) };

  const cancelReminder = input.match(/^cancel reminder\s+(\d+)$/i);
  if (cancelReminder) return { kind: "cancel_reminder", position: Number(cancelReminder[1]) };

  const snooze = input.match(
    /^snooze reminder\s+(\d+)\s+(?:for|by)\s+(\d+)\s+(seconds?|minutes?|hours?|days?)$/i,
  );
  if (snooze) {
    const amount = Number(snooze[2]);
    if (amount < 1 || amount > 10_000) {
      return { kind: "invalid", reason: "Use a snooze amount from 1 to 10000." };
    }
    return {
      kind: "snooze_reminder",
      position: Number(snooze[1]),
      delayMs: durationMs(amount, snooze[3].toLowerCase()),
    };
  }

  return {
    kind: "invalid",
    reason: "I did not guess. Type help to see the supported commands.",
  };
}

export const reminderDemoHelp = [
  "Try one of these:",
  "• note: passport is in the blue drawer",
  "• find notes passport",
  "• task: buy milk",
  "• tasks",
  "• remind me in 10 minutes to call Mum",
  "• reminders",
  "• snooze reminder 1 for 5 minutes",
  "• complete task 1",
].join("\n");
