import { extractMemory, memoryFollowUp } from "../shared/memory.js";

const session1 = "kal meri presentation hai";
const savedMemory = extractMemory(session1);
const session2 = memoryFollowUp(savedMemory);
const freshGreeting = memoryFollowUp(null);

console.log(JSON.stringify({
  identity: { greeting: freshGreeting },
  session1: { user: session1, savedMemory },
  session2: { companion: session2 },
}, null, 2));

if (!freshGreeting.includes("Kamini") || !freshGreeting.includes("female AI companion") || savedMemory?.kind !== "event" || !session2.toLowerCase().includes("presentation")) {
  process.exitCode = 1;
}
