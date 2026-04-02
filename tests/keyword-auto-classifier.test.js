import test from "node:test";
import assert from "node:assert/strict";
import { KeywordAutoClassifier } from "../src/domain/services/keywordAutoClassifier.js";

test("keyword auto classifier should fallback to first business tag when no hit", async () => {
  const classifier = new KeywordAutoClassifier();
  const result = await classifier.classify(
    {
      messages: [
        {
          parts: [{ text: "this conversation has no obvious domain keyword" }]
        }
      ]
    },
    {
      roleOptions: ["资深技术架构师"],
      businessTagOptions: ["需求设计", "技术方案"],
      directoryOptions: ["general", "architecture"],
      defaultDirectory: "general"
    }
  );

  assert.deepEqual(result.businessTags, ["需求设计"]);
  assert.equal(result.roles.length > 0, true);
  assert.equal(result.directories.length > 0, true);
});
