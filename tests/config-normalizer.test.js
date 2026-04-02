import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBranchName, normalizeOwnerRepo } from "../src/infrastructure/github/configNormalizer.js";

test("normalizeOwnerRepo should parse https GitHub repo url", () => {
  const output = normalizeOwnerRepo({
    owner: "",
    repo: "https://github.com/gy-doc/ai-doc.git"
  });
  assert.equal(output.owner, "gy-doc");
  assert.equal(output.repo, "ai-doc");
});

test("normalizeOwnerRepo should parse git@github.com repo url", () => {
  const output = normalizeOwnerRepo({
    owner: "",
    repo: "git@github.com:gy-doc/ai-doc.git"
  });
  assert.equal(output.owner, "gy-doc");
  assert.equal(output.repo, "ai-doc");
});

test("normalizeOwnerRepo should parse ssh://git@github.com repo url", () => {
  const output = normalizeOwnerRepo({
    owner: "",
    repo: "ssh://git@github.com/gy-doc/ai-doc.git"
  });
  assert.equal(output.owner, "gy-doc");
  assert.equal(output.repo, "ai-doc");
});

test("normalizeBranchName should strip refs prefix", () => {
  assert.equal(normalizeBranchName("refs/heads/main"), "main");
  assert.equal(normalizeBranchName("heads/develop"), "develop");
  assert.equal(normalizeBranchName("feature/x"), "feature/x");
});
