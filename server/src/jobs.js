import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { config } from "./config.js";
import { convertMedia } from "./ytdlp.js";

const jobs = new Map();
const queue = [];
let running = 0;

function emit(job, event, data = {}) {
job.events.push({ event, data, id: ++job.lastEventId });
if (job.events.length > 100) job.events.shift();

for (const listener of job.listeners) {
try {
listener({ event, data, id: job.lastEventId });
} catch {
job.listeners.delete(listener);
}
}
}

function publicJob(job) {
return {
id: job.id,
status: job.status,
percent: job.percent,
message: job.message,
filename: job.filename || null,
error: job.error || null
};
}

async function execute(job) {
running++;
job.status = "processing";
job.message = "Starting conversion...";
emit(job, "progress", publicJob(job));

try {
const result = await convertMedia(job, (progress) => {
job.percent = progress.percent;
job.message = progress.message;
emit(job, "progress", publicJob(job));
});

job.filePath = result.filePath;
job.workDir = result.workDir;
job.filename = result.filename;
job.status = "complete";
job.percent = 100;
job.message = "Your file is ready.";
emit(job, "complete", publicJob(job));

} catch {
job.status = "error";
job.error = "Conversion failed. Please try another supported video.";
job.message = job.error;
emit(job, "job-error", { message: job.error });
} finally {
running--;
processQueue();
}
}

function processQueue() {
while (running < config.maxConcurrentJobs && queue.length > 0) {
const id = queue.shift();
const job = jobs.get(id);

if (!job || job.status !== "queued") continue;

void execute(job);

}
}

export function createJob(input, video) {
if (queue.length >= config.maxQueuedJobs) {
throw new Error("The conversion queue is full. Please try again later.");
}

const job = {
id: randomUUID(),
url: input.url,
format: input.format,
quality: input.quality,
bitrate: input.bitrate,
title: video.title,
status: "queued",
percent: 0,
message: "Waiting in the queue...",
createdAt: Date.now(),
lastEventId: 0,
events: [],
listeners: new Set(),
filePath: null,
workDir: null,
filename: null,
error: null
};

jobs.set(job.id, job);
queue.push(job.id);
emit(job, "queued", publicJob(job));
processQueue();

return publicJob(job);
}

export function getJob(id) {
return jobs.get(id) || null;
}

export function subscribeToJob(job, listener) {
job.listeners.add(listener);
return () => job.listeners.delete(listener);
}

export function getJobEvents(job, lastEventId = 0) {
return job.events.filter((event) => event.id > lastEventId);
}

export async function removeJob(job) {
jobs.delete(job.id);

if (job.workDir) {
await fs.rm(job.workDir, { recursive: true, force: true }).catch(() => {});
}

job.listeners.clear();
}

export function listJobs() {
return [...jobs.values()];
}

export function getQueueStats() {
return {
running,
queued: queue.length,
maxConcurrentJobs: config.maxConcurrentJobs,
maxQueuedJobs: config.maxQueuedJobs
};
}
