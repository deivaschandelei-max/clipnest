import path from "node:path";
import os from "node:os";

function readPositiveInt(name, fallback) {
const raw = process.env[name];
if (raw === undefined || raw === "") return fallback;

const value = Number(raw);
if (!Number.isSafeInteger(value) || value <= 0) {
throw new Error("${name} must be a positive integer");
}

return value;
}

function readOriginList() {
const raw = process.env.CORS_ORIGINS ?? "";
return raw
.split(",")
.map((origin) => origin.trim())
.filter(Boolean);
}

export const config = Object.freeze({
port: readPositiveInt("PORT", 3000),
host: process.env.HOST || "0.0.0.0",
nodeEnv: process.env.NODE_ENV || "development",

// Public URL of the backend, used by separately hosted frontends.
publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(//+$/, ""),
contactEmail: process.env.CONTACT_EMAIL || "",

corsOrigins: readOriginList(),

maxConcurrentJobs: readPositiveInt("MAX_CONCURRENT_JOBS", 2),
maxQueuedJobs: readPositiveInt("MAX_QUEUED_JOBS", 10),
jobTimeoutMs: readPositiveInt("JOB_TIMEOUT_MS", 10 * 60 * 1000),
jobRetentionMs: readPositiveInt("JOB_RETENTION_MS", 30 * 60 * 1000),
cleanupIntervalMs: readPositiveInt("CLEANUP_INTERVAL_MS", 60 * 1000),

maxVideoDurationSeconds: readPositiveInt(
"MAX_VIDEO_DURATION_SECONDS",
60 * 60
),
maxOutputBytes: readPositiveInt(
"MAX_OUTPUT_BYTES",
1024 * 1024 * 1024
),

tempDir: process.env.TEMP_DIR || path.join(os.tmpdir(), "clipnest"),
ytdlpPath: process.env.YTDLP_PATH || "yt-dlp",
ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg"
});
