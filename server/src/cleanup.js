import { config } from "./config.js";
import { listJobs, removeJob } from "./jobs.js";

let cleanupTimer;

export function startCleanup() {
if (cleanupTimer) return;

cleanupTimer = setInterval(async () => {
const now = Date.now();

for (const job of listJobs()) {
  const expired =
    now - job.createdAt >= config.jobRetentionMs;

  const finished =
    job.status === "complete" || job.status === "error";

  if (expired && finished) {
    await removeJob(job);
  }
}

}, config.cleanupIntervalMs);

cleanupTimer.unref?.();
}

export async function stopCleanup() {
if (cleanupTimer) {
clearInterval(cleanupTimer);
cleanupTimer = undefined;
}

for (const job of listJobs()) {
if (job.status === "complete" || job.status === "error") {
await removeJob(job);
}
}
}
