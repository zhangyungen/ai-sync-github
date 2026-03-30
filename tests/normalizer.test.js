import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSession } from "../src/domain/services/normalizer.js";

test("normalizeSession should normalize mixed raw messages", () => {
  const normalized = normalizeSession({
    sessionId: "s1",
    title: "Demo",
    sourceUrl: "https://chatgpt.com/c/s1",
    messages: [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "hello" }]
      },
      {
        id: "m2",
        role: "assistant",
        content: "world"
      }
    ]
  });

  assert.equal(normalized.sessionId, "s1");
  assert.equal(normalized.messages.length, 2);
  assert.equal(normalized.messages[0].parts[0].type, "text");
  assert.equal(normalized.messages[1].parts[0].text, "world");
});
