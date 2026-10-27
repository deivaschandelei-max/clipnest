import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { config } from "./config.js";
import { router } from "./routes.js";
import { startCleanup, stopCleanup } from "./cleanup.js";

const app = express();
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const webDir = path.resolve(currentDir, "../../web");

await fs.mkdir(config.tempDir, { recursive: true });

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
crossOriginResourcePolicy: { policy: "cross-origin" },
contentSecurityPolicy: {
directives: {
defaultSrc: ["'self'"],
scriptSrc: ["'self'"],
styleSrc: ["'self'"],
imgSrc: ["'self'", "https:", "data:"],
connectSrc: ["'self'"],
objectSrc: ["'none'"],
baseUri: ["'self'"],
frameAncestors: ["'none'"]
}
}
}));

app.use(cors({
origin(origin, callback) {
if (!origin || config.corsOrigins.includes(origin)) {
return callback(null, true);
}
return callback(new Error("Origin not allowed by CORS."));
}
}));

app.use(express.json({ limit: "16kb" }));

app.use("/api", rateLimit({
windowMs: 60 * 1000,
limit: 30,
standardHeaders: "draft-7",
legacyHeaders: false
}));

app.get("/health", (_req, res) => {
res.json({ status: "ok" });
});

app.use("/api", router);

app.use(express.static(webDir, {
index: "index.html",
dotfiles: "deny",
fallthrough: true
}));

app.get("*", (req, res, next) => {
if (req.path.startsWith("/api/")) {
return res.status(404).json({ error: "API endpoint not found." });
}
res.sendFile(path.join(webDir, "index.html"), (error) => {
if (error) next(error);
});
});

app.use((error, _req, res, _next) => {
console.error("Request failed:", error.message);
if (res.headersSent) return;

const status = error.status || 500;
res.status(status).json({
error: status >= 500
? "Something went wrong. Please try again later."
: error.message
});
});

startCleanup();

const server = app.listen(config.port, config.host, () => {
console.log("ClipNest listening on ${config.host}:${config.port}");
});

async function shutdown() {
server.close(async () => {
await stopCleanup();
process.exit(0);
});

setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
