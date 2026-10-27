import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { getVideoInfo } from "./ytdlp.js";
import {
createJob,
getJob,
getJobEvents,
subscribeToJob
} from "./jobs.js";
import {
validateYouTubeUrl,
jobRequestSchema
} from "./validate.js";

export const router = Router();

function asyncRoute(handler) {
return (req, res, next) => {
Promise.resolve(handler(req, res, next)).catch(next);
};
}

router.get("/public-config", (_req, res) => {
res.json({
contactEmail: process.env.CONTACT_EMAIL || ""
});
});

router.post("/info", asyncRoute(async (req, res) => {
const { url } = req.body || {};
const validated = validateYouTubeUrl(url);
const video = await getVideoInfo(validated.url);

res.json({
video: {
url: validated.url,
title: video.title,
thumbnail: video.thumbnail,
duration: video.duration,
channel: video.channel
}
});
}));

router.post("/jobs", asyncRoute(async (req, res) => {
const parsed = jobRequestSchema.safeParse(req.body);

if (!parsed.success) {
return res.status(400).json({
error: "Please check your conversion settings and confirm you have permission to download this media."
});
}

const validated = validateYouTubeUrl(parsed.data.url);
const video = await getVideoInfo(validated.url);

const job = createJob({
...parsed.data,
url: validated.url
}, video);

res.status(202).json({
job: {
id: job.id,
queued: job.status === "queued"
}
});
}));

router.get("/jobs/:id/events", (req, res) => {
const job = getJob(req.params.id);

if (!job) {
return res.status(404).json({ error: "Job not found." });
}

res.set({
"Content-Type": "text/event-stream",
"Cache-Control": "no-cache, no-transform",
Connection: "keep-alive",
"X-Accel-Buffering": "no"
});
res.flushHeaders?.();

let closed = false;

const send = ({ event, data, id }) => {
if (closed) return;
res.write("id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n");
};

const unsubscribe = subscribeToJob(job, send);

for (const event of getJobEvents(job, Number(req.get("Last-Event-ID")) || 0)) {
send(event);
}

const heartbeat = setInterval(() => {
if (!closed) res.write(": heartbeat\n\n");
}, 15000);

req.on("close", () => {
closed = true;
clearInterval(heartbeat);
unsubscribe();
});
});

router.get("/jobs/:id/download", (req, res, next) => {
const job = getJob(req.params.id);

if (!job || job.status !== "complete" || !job.filePath || !job.filename) {
return res.status(404).json({ error: "The download is not ready." });
}

fs.stat(job.filePath, (error, stat) => {
if (error || !stat.isFile()) {
return res.status(404).json({ error: "The download file is unavailable." });
}

const extension = path.extname(job.filename).toLowerCase();
const contentType = extension === ".mp3"
  ? "audio/mpeg"
  : "video/mp4";

res.setHeader("Content-Type", contentType);
res.setHeader(
  "Content-Disposition",
  `attachment; filename="${job.filename.replace(/["\\\r\n]/g, "_")}"`
);
res.setHeader("Content-Length", stat.size);

res.sendFile(job.filePath, (sendError) => {
  if (sendError && !res.headersSent) next(sendError);
});

});
});
