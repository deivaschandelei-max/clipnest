import test from "node:test";
import assert from "node:assert/strict";
import {
validateYouTubeUrl,
jobRequestSchema
} from "../server/src/validate.js";

test("accepts a standard YouTube watch URL", () => {
const result = validateYouTubeUrl(
"https://www.youtube.com/watch?v=dQw4w9WgXcQ"
);

assert.equal(result.videoId, "dQw4w9WgXcQ");
assert.equal(
result.url,
"https://www.youtube.com/watch?v=dQw4w9WgXcQ"
);
});

test("accepts a youtu.be short URL", () => {
const result = validateYouTubeUrl("https://youtu.be/dQw4w9WgXcQ");

assert.equal(result.videoId, "dQw4w9WgXcQ");
});

test("rejects unrelated domains", () => {
assert.throws(
() => validateYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ"),
/supported YouTube link/
);
});

test("rejects credentials in URLs", () => {
assert.throws(
() => validateYouTubeUrl(
"https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ"
),
/login credentials/
);
});

test("rejects malformed video IDs", () => {
assert.throws(
() => validateYouTubeUrl("https://youtube.com/watch?v=short"),
/valid video ID/
);
});

test("rejects non-HTTP protocols", () => {
assert.throws(
() => validateYouTubeUrl("javascript:alert(1)"),
/valid YouTube URL/
);
});

test("requires rights confirmation for conversion jobs", () => {
const valid = {
url: "https://youtu.be/dQw4w9WgXcQ",
format: "mp4",
quality: "720",
rightsConfirmed: true
};

assert.equal(jobRequestSchema.safeParse(valid).success, true);
assert.equal(
jobRequestSchema.safeParse({
...valid,
rightsConfirmed: false
}).success,
false
);
});
