import { SyncPipeline } from "../../application/syncPipeline.js";
import { SyncService } from "../../application/syncService.js";
import { DedupeWindow } from "../../domain/policies/dedupeWindow.js";
import { ManualFirstClassifier } from "../../domain/services/classifier.js";
import { KeywordAutoClassifier } from "../../domain/services/keywordAutoClassifier.js";
import { GitHubClient } from "../../infrastructure/github/client.js";
import { GitHubPublisher } from "../../infrastructure/github/publisher.js";
import { WebhookAlerter } from "../../infrastructure/logging/alerter.js";
import { Logger } from "../../infrastructure/logging/logger.js";
import { StateRepository } from "../../infrastructure/storage/stateRepository.js";
import { createStorageGateway } from "../../infrastructure/storage/storageGateway.js";

let runtimeSingleton = null;

function createRuntime(chromeApi) {
  const logger = new Logger("ChatSync");
  const stateRepository = new StateRepository(createStorageGateway(chromeApi.storage.local));
  const publisher = new GitHubPublisher(new GitHubClient(fetch));
  const classifier = new ManualFirstClassifier(new KeywordAutoClassifier());
  const dedupeWindow = new DedupeWindow();
  const alerter = new WebhookAlerter(fetch);
  const pipeline = new SyncPipeline({
    stateRepository,
    classifier,
    publisher,
    dedupeWindow,
    logger,
    alerter
  });
  const syncService = new SyncService({
    stateRepository,
    pipeline,
    logger
  });

  return {
    logger,
    stateRepository,
    syncService,
    alerter
  };
}

export function getRuntime(chromeApi = chrome) {
  if (!runtimeSingleton) {
    runtimeSingleton = createRuntime(chromeApi);
  }
  return runtimeSingleton;
}
