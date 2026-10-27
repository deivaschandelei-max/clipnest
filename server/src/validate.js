import { z } from "zod";

const ALLOWED_HOSTS = new Set([
"youtube.com",
"www.youtube.com",
"m.youtube.com",
"youtu.be",
"www.youtube-nocookie.com",
"youtube-nocookie.com"
]);

export function validateYouTubeUrl(value) {
if (typeof value !== "string" || value.length > 2048) {
throw new Error("Please enter a valid YouTube URL.");
}

let parsed;

try {
parsed = new URL(value.trim());
} catch {
throw new Error("Please enter a valid YouTube URL.");
}

if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
throw new Error("Only HTTP and HTTPS URLs are accepted.");
}

if (parsed.username || parsed.password) {
throw new Error("URLs containing login credentials are not accepted.");
}

const hostname = parsed.hostname.toLowerCase();

if (!ALLOWED_HOSTS.has(hostname)) {
throw new Error("Please use a supported YouTube link.");
}

const isShortLink = hostname === "youtu.be";
const videoId = isShortLink
? parsed.pathname.split("/").filter(Boolean)[0]
: parsed.searchParams.get("v") ||
parsed.pathname.match(/^/(?:shorts|embed|live)/([^/]+)/)?.[1];

if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
throw new Error("We couldn't find a valid video ID in that link.");
}

return {
url: "https://www.youtube.com/watch?v=${videoId}",
videoId
};
}

export const jobRequestSchema = z.object({
url: z.string().min(1).max(2048),
format: z.enum(["mp4", "mp3"]),
quality: z.enum(["360", "480", "720", "1080"]).optional(),
bitrate: z.enum(["128", "192", "256", "320"]).optional(),
rightsConfirmed: z.literal(true)
}).strict();

export function sanitizeFilename(value) {
const cleaned = String(value || "clipnest-download")
.normalize("NFKC")
.replace(/[<>:"/\|?*\u0000-\u001F\u007F]/g, "")
.replace(/\s+/g, " ")
.replace(/^.+|.+$/g, "")
.trim()
.slice(0, 120);

return cleaned || "clipnest-download";
}
