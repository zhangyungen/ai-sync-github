import test from "node:test";
import assert from "node:assert/strict";
import { SyncService } from "../src/application/syncService.js";
import { SyncPipeline } from "../src/application/syncPipeline.js";
import { DedupeWindow } from "../src/domain/policies/dedupeWindow.js";
import { ManualFirstClassifier } from "../src/domain/services/classifier.js";
import { Logger } from "../src/infrastructure/logging/logger.js";
import { WebhookAlerter } from "../src/infrastructure/logging/alerter.js";
import { StateRepository } from "../src/infrastructure/storage/stateRepository.js";
import { createInMemoryStorageGateway } from "../src/infrastructure/storage/storageGateway.js";

class FakePublisher {
  constructor() {
    this.calls = [];
  }

  async publishBundle(config, files, commitLabel) {
    this.calls.push({ config, files, commitLabel });
    return { publishedCount: files.length };
  }
}

test("sync service should collect and manual-sync session", async () => {
  const storage = createInMemoryStorageGateway();
  const stateRepository = new StateRepository(storage);
  const logger = new Logger("Test");
  const publisher = new FakePublisher();
  const pipeline = new SyncPipeline({
    stateRepository,
    classifier: new ManualFirstClassifier(null),
    publisher,
    dedupeWindow: new DedupeWindow(),
    logger,
    alerter: new WebhookAlerter(async () => ({ ok: true }))
  });
  const service = new SyncService({
    stateRepository,
    pipeline,
    logger
  });

  await service.updateConfig({
    github: {
      owner: "owner",
      repo: "repo",
      branch: "main",
      authMode: "pat",
      token: "token"
    }
  });

  await service.collectSession({
    sessionId: "s1",
    title: "Test Session",
    sourceUrl: "https://chatgpt.com/c/s1",
    capturedAt: "2026-03-30T00:00:00.000Z",
    messages: [
      {
        id: "m1",
        role: "user",
        createdAt: "2026-03-30T00:00:00.000Z",
        parts: [{ type: "text", text: "hello" }]
      }
    ]
  });

  const summary = await service.runManualSync({
    sessionIds: ["s1"],
    manualSelection: {
      roles: ["资深技术架构师"],
      businessTags: ["架构评审"],
      directory: "arch"
    }
  });

  assert.equal(summary.synced, 1);
  assert.equal(summary.failed, 0);
  assert.equal(publisher.calls.length, 1);
  assert.equal(publisher.calls[0].files.length > 0, true);
});
