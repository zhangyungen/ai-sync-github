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

  const logs = await stateRepository.getSyncLogs();
  assert.equal(logs.length > 0, true);
  assert.equal(logs.some((item) => item.type === "summary"), true);
});

test("index records should keep incremental history for same session", async () => {
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

  const manualSelection = {
    roles: ["资深技术架构师"],
    businessTags: ["架构评审"],
    directory: "arch"
  };

  const first = await service.runManualSync({
    sessionIds: ["s1"],
    manualSelection
  });
  assert.equal(first.synced, 1);

  await service.collectSession({
    sessionId: "s1",
    title: "Test Session",
    sourceUrl: "https://chatgpt.com/c/s1",
    capturedAt: "2026-03-30T00:01:00.000Z",
    messages: [
      {
        id: "m1",
        role: "user",
        createdAt: "2026-03-30T00:00:00.000Z",
        parts: [{ type: "text", text: "hello" }]
      },
      {
        id: "m2",
        role: "assistant",
        createdAt: "2026-03-30T00:01:00.000Z",
        parts: [{ type: "text", text: "world" }]
      }
    ]
  });

  const second = await service.runManualSync({
    sessionIds: ["s1"],
    manualSelection
  });
  assert.equal(second.synced, 1);
  assert.equal(publisher.calls.length, 2);

  const secondPublishFiles = publisher.calls[1].files;
  const indexJson = secondPublishFiles.find((file) => file.path.endsWith("/indexes/index.json"));
  assert.ok(indexJson);

  const records = JSON.parse(indexJson.content);
  assert.equal(records.length, 2);
  assert.equal(records[0].sessionId, "s1");
  assert.equal(records[1].sessionId, "s1");
  assert.notEqual(records[0].lastMessageId, records[1].lastMessageId);
});

test("index records should append when message id is stable but content changes", async () => {
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

  const manualSelection = {
    roles: ["资深技术架构师"],
    businessTags: ["架构评审"],
    directory: "arch"
  };

  await service.collectSession({
    sessionId: "qianwen-s1",
    title: "Qianwen Session",
    sourceUrl: "https://www.qianwen.com/",
    capturedAt: "2026-03-30T00:00:00.000Z",
    messages: [
      {
        id: "m-1",
        role: "assistant",
        createdAt: "2026-03-30T00:00:00.000Z",
        parts: [{ type: "text", text: "版本 A" }]
      }
    ]
  });

  const first = await service.runManualSync({
    sessionIds: ["qianwen-s1"],
    manualSelection
  });
  assert.equal(first.synced, 1);

  await service.collectSession({
    sessionId: "qianwen-s1",
    title: "Qianwen Session",
    sourceUrl: "https://www.qianwen.com/",
    capturedAt: "2026-03-30T00:02:00.000Z",
    messages: [
      {
        id: "m-1",
        role: "assistant",
        createdAt: "2026-03-30T00:02:00.000Z",
        parts: [{ type: "text", text: "版本 B（同一 message id）" }]
      }
    ]
  });

  const second = await service.runManualSync({
    sessionIds: ["qianwen-s1"],
    manualSelection
  });
  assert.equal(second.synced, 1);
  assert.equal(publisher.calls.length, 2);

  const indexJson = publisher.calls[1].files.find((file) => file.path.endsWith("/indexes/index.json"));
  assert.ok(indexJson);
  const records = JSON.parse(indexJson.content);
  assert.equal(records.length, 2);
  assert.equal(records[0].sessionId, "qianwen-s1");
  assert.equal(records[1].sessionId, "qianwen-s1");
});
