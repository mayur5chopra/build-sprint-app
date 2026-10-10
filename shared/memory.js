const clean = (value) => value.trim().replace(/[.!?]+$/, "");

/** @typedef {{ kind: "name" | "event" | "like", note: string }} MemoryNote */

/** @returns {MemoryNote | null} */
export function extractMemory(text) {
  const name = text.match(/(?:mera naam|my name is)\s+([a-zA-Z][a-zA-Z ]{0,30})/i);
  if (name) {
    return { kind: "name", note: `Naam ${clean(name[1])} hai` };
  }

  const event = text.match(/\b(kal|parso|aaj|next (?:week|hafte|month|mahine))\b\s+(?:meri|mera|mere|my)?\s*([^.!?]{2,60}?)(?:\s+hai|\s+he|$)/i);
  if (event) {
    const when = clean(event[1].toLowerCase());
    const what = clean(event[2].replace(/^(meri|mera|mere|my)\s+/i, ""));
    return { kind: "event", note: `${when}: ${what}` };
  }

  const like = text.match(/(?:mujhe|i)\s+(.{2,50}?)\s+(?:pasand hai|like(?: karta| karti)?(?: hoon)?)/i);
  if (like) {
    return { kind: "like", note: `${clean(like[1])} pasand hai` };
  }

  return null;
}

/** @param {MemoryNote | null} memory */
export function memoryFollowUp(memory) {
  if (!memory) return "Hey, main Kamini hoon — tumhari female AI companion. Aaj kaisa chal raha hai?";
  if (memory.kind === "event") {
    const [when, what] = memory.note.split(": ");
    if (when === "kal") return `Kal wali ${what} ke liye tayyari kaisi chal rahi hai?`;
    return `${what} kaisa raha? Batao na.`;
  }
  if (memory.kind === "name") return `Hey ${memory.note.replace(/^Naam | hai$/g, "")}! Aaj mood kaisa hai?`;
  return `Pichli baar tumne bataya tha ki tumhe ${memory.note}. Aaj bhi uska mood hai?`;
}
