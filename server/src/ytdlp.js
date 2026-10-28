import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { sanitizeFilename } from "./validate.js";

function runProcess(command, args, options = {}) {
return new Promise((resolve, reject) => {
const child = spawn(command, args, {
shell: false,
windowsHide: true,
stdio: ["ignore", "pipe", "pipe"],
...options
});

let stdout = "";
let stderr = "";
const maxCapture = 1024 * 1024;

child.stdout.on("data", (chunk) => {
  if (stdout.length < maxCapture) {
    stdout += chunk.toString().slice(0, maxCapture - stdout.length);
  }
});

child.stderr.on("data", (chunk) => {
  if (stderr.length < maxCapture) {
    stderr += chunk.toString().slice(0, maxCapture - stderr.length);
  }
});

child.once("error", reject);

child.once("close", (code) => {
  if (code === 0) {
    resolve({ stdout, stderr });
  } else {
    reject(new Error("Media processing failed."));
  }
});

});
}

export async function getVideoInfo(url) {
const { stdout } = await runProcess(config.ytdlpPath, [
"--dump-single-json",
"--no-warnings",
"--no-playlist",
"--no-check-certificates",
"--socket-timeout", "15",
"--",
url
], { timeout: config.jobTimeoutMs });

let info;

try {
info = JSON.parse(stdout);
} catch {
throw new Error("Unable to read video information.");
}

if (!info || !info.id || !info.title) {
throw new Error("Video information is unavailable.");
}

if (info.is_live || info.live_status === "is_live") {
throw new Error("Live streams are not supported.");
}

if (
typeof info.duration === "number" &&
info.duration > config.maxVideoDurationSeconds
) {
throw new Error("This video exceeds the allowed duration.");
}

return {
id: info.id,
title: sanitizeFilename(info.title),
channel: String(info.channel || info.uploader || "Unknown creator").slice(0, 150),
thumbnail: typeof info.thumbnail === "string" &&
info.thumbnail.startsWith("https://")
? info.thumbnail
: null,
duration: Number.isFinite(info.duration) ? info.duration : null,
webpageUrl: url
};
}

export async function convertMedia(job, onProgress = () => {}) {
const workDir = path.join(config.tempDir, randomUUID());
await fs.mkdir(workDir, { recursive: true, mode: 0o700 });

try {
const basePath = path.join(workDir, "media");
const outputTemplate = path.join(workDir, "media.%(ext)s");
const formatArgs = job.format === "mp3"
  ? [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", `${job.bitrate || "192"}K`
    ]
  : [
      "-f",
      `bestvideo[height<=${job.quality || "720"}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${job.quality || "720"}][ext=mp4]/best`,
      "--merge-output-format", "mp4"
    ];

onProgress({ percent: 5, message: "Preparing media..." });

await runProcess(config.ytdlpPath, [
  "--no-warnings",
  "--no-playlist",
  "--no-progress",
  "--restrict-filenames",
  "--max-filesize", String(config.maxOutputBytes),
  "--socket-timeout", "20",
  "--ffmpeg-location", config.ffmpegPath,
  "-o", outputTemplate,
  ...formatArgs,
  "--",
  job.url
], { cwd: workDir, timeout: config.jobTimeoutMs });

const files = await fs.readdir(workDir);
const output = files
  .filter((name) => /\.(mp4|mp3)$/i.test(name))
  .map((name) => path.join(workDir, name))[0];

if (!output) {
  throw new Error("No supported output file was created.");
}

const stat = await fs.stat(output);

if (stat.size > config.maxOutputBytes) {
  throw new Error("The output exceeds the configured size limit.");
}

onProgress({ percent: 100, message: "Ready to download." });

return {
  filePath: output,
  filename: `${sanitizeFilename(job.title)}.${job.format}`,
  workDir
};

} catch (error) {
await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
throw error;
}
                                                                                             }
