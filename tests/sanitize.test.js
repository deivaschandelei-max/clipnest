import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeFilename } from "../server/src/validate.js";

test("removes filesystem-dangerous characters", () => {
const result = sanitizeFilename('video<>:"/\|?.mp4');
assert.equal(/[<>:"/\|?\u0000-\u001F\u007F]/.test(result), false);
});

test("removes leading and trailing dots", () => {
const result = sanitizeFilename("...example...");
assert.equal(result, "example");
});

test("limits filename length", () => {
const result = sanitizeFilename("a".repeat(500));
assert.ok(result.length <= 120);
});

test("uses a fallback for an empty filename", () => {
assert.equal(sanitizeFilename(""), "clipnest-download");
});

test("normalizes Unicode text", () => {
const result = sanitizeFilename("cafe\u0301");
assert.equal(result, "café");
});
