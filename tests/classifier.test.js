import test from "node:test";
import assert from "node:assert/strict";
import { ManualFirstClassifier } from "../src/domain/services/classifier.js";

test("manual classifier should prioritize manual selection", async () => {
  const classifier = new ManualFirstClassifier(null);
  const result = await classifier.resolve({
    mode: "manual",
    manualSelection: {
      roles: ["资深业务架构师"],
      businessTags: ["支付重构"],
      directory: "payment"
    },
    defaultDirectory: "general"
  });

  assert.equal(result.source, "manual");
  assert.deepEqual(result.classification.roles, ["资深业务架构师"]);
  assert.deepEqual(result.classification.businessTags, ["支付重构"]);
  assert.equal(result.classification.directory, "payment");
});

test("auto mode should still produce classification when confidence is low", async () => {
  const classifier = new ManualFirstClassifier({
    classify: async () => ({
      confidence: 0.2,
      roles: ["资深技术架构师"],
      businessTags: ["技术方案"],
      directories: ["general"],
      directory: "general"
    })
  });
  const result = await classifier.resolve({
    mode: "auto",
    session: { messages: [] },
    autoEnabled: true,
    autoThreshold: 0.8,
    defaultDirectory: "general"
  });

  assert.equal(result.requiresManual, false);
  assert.equal(result.source, "auto_fallback");
  assert.deepEqual(result.classification.roles, ["资深技术架构师"]);
  assert.deepEqual(result.classification.businessTags, ["技术方案"]);
  assert.equal(result.classification.directory, "general");
});
