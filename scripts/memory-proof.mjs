import { extractMemory, memoryFollowUp } from "../shared/memory.js";

const session1 = "kal meri presentation hai";
const savedMemory = extractMemory(session1);
const session2 = memoryFollowUp(savedMemory);

console.log(JSON.stringify({
  session1: { user: session1, savedMemory },
  session2: { companion: session2 },
}, null, 2));

if (savedMemory?.kind !== "event" || !session2.toLowerCase().includes("presentation")) {
  process.exitCode = 1;
}
