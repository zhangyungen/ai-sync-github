import test from "node:test";
import assert from "node:assert/strict";
import { validateInterval } from "../src/domain/policies/syncIntervalPolicy.js";
import { DedupeWindow } from "../src/domain/policies/dedupeWindow.js";
import { renderSyncArtifacts } from "../src/domain/services/renderer.js";

test("validateInterval should accept values in range", () => {
  const interval = validateInterval(15, 5, 60);
  assert.equal(interval, 15);
});

test("validateInterval should reject out-of-range values", () => {
  assert.throws(() => validateInterval(2, 5, 60));
});

test("DedupeWindow should mark and detect duplicates", () => {
  const window = new DedupeWindow(24 * 60 * 60 * 1000, () => 1000);
  const marked = window.mark({}, "fingerprint-a");
  assert.equal(window.isDuplicate(marked, "fingerprint-a"), true);
});

test("renderer should output raw timeline and categorized files", () => {
  const output = renderSyncArtifacts({
    syncedAt: "2026-03-30T00:00:00.000Z",
    rootPath: "sync-data",
    classification: {
      roles: ["资深技术架构师"],
      businessTags: ["支付链路"],
      directory: "architecture"
    },
    session: {
      sessionId: "abc",
      title: "Architecture Review",
      sourceUrl: "https://chatgpt.com/c/abc",
      capturedAt: "2026-03-30T00:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          createdAt: "2026-03-30T00:00:00.000Z",
          parts: [{ type: "text", text: "hello" }]
        }
      ]
    }
  });

  assert.equal(output.files.length >= 3, true);
  assert.equal(output.files.some((file) => file.path.includes("/raw/")), true);
  assert.equal(output.files.some((file) => file.path.includes("/timeline/")), true);
  assert.equal(output.files.some((file) => file.path.includes("/categorized/")), true);
});

test("renderer should render GitHub-friendly fenced code blocks", () => {
  const output = renderSyncArtifacts({
    syncedAt: "2026-03-30T00:00:00.000Z",
    rootPath: "sync-data",
    classification: {
      roles: ["资深技术架构师"],
      businessTags: ["支付链路"],
      directory: "architecture"
    },
    session: {
      sessionId: "code-1",
      title: "Code Session",
      sourceUrl: "https://chatgpt.com/c/code-1",
      capturedAt: "2026-03-30T00:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "assistant",
          createdAt: "2026-03-30T00:00:00.000Z",
          parts: [
            {
              type: "code",
              language: "javascript",
              text: "const x = 1;\\nconsole.log(```inside`);"
            }
          ]
        }
      ]
    }
  });

  const timeline = output.files.find((file) => file.path.includes("/timeline/"))?.content || "";
  assert.match(timeline, /````javascript/);
  assert.match(timeline, /const x = 1;/);
  assert.match(timeline, /console\.log\(```inside`\);/);
  assert.match(timeline, /````/);
});
