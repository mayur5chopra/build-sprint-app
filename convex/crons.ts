import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("send Smriti morning summaries", { hourUTC: 2, minuteUTC: 30 }, internal.smritiDaily.run, {});
crons.daily("delete expired Smriti data", { hourUTC: 3, minuteUTC: 15 }, internal.smritiDaily.cleanupCompleted, {});

export default crons;
