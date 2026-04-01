import { ERROR_CODE, SyncError } from "../constants/errors.js";
import { normalizeSession, getLastMessageId } from "../domain/services/normalizer.js";
import { renderSyncArtifacts } from "../domain/services/renderer.js";
import { buildIndexArtifacts } from "../domain/services/indexBuilder.js";
import { stableHash } from "../shared/hash.js";
import { nowIso } from "../shared/time.js";

function findMessagesAfterCursor(messages, lastSyncedMessageId) {
  if (!lastSyncedMessageId) {
    return messages;
  }

  const index = messages.findIndex((message) => message.id === lastSyncedMessageId);
  if (index === -1) {
    return messages;
  }
  return messages.slice(index + 1);
}

function buildMessageSignature(message) {
  return stableHash(
    `${message?.id || ""}|${message?.role || ""}|${JSON.stringify(message?.parts || [])}`
  );
}

function findAutoIncrementalMessages(messages, lastSyncedMessageId, lastSyncedMessageSignature) {
  const incremental = findMessagesAfterCursor(messages, lastSyncedMessageId);
  if (incremental.length > 0) {
    return incremental;
  }

  if (!lastSyncedMessageId || !Array.isArray(messages) || messages.length === 0) {
    return incremental;
  }

  const lastIndex = messages.findIndex((message) => message.id === lastSyncedMessageId);
  if (lastIndex === -1) {
    return incremental;
  }

  const currentMessage = messages[lastIndex];
  if (!lastSyncedMessageSignature) {
    return incremental;
  }

  const currentSignature = buildMessageSignature(currentMessage);
  if (currentSignature !== lastSyncedMessageSignature) {
    return [currentMessage];
  }

  return incremental;
}

function buildFingerprint(sessionId, message) {
  return stableHash(
    `${sessionId}|${message.id}|${message.role}|${JSON.stringify(message.parts || [])}`
  );
}

function applyDedupe(messages, sessionId, dedupeMap, dedupeWindow) {
  let outputMap = dedupeWindow.prune(dedupeMap);
  const uniqueMessages = [];

  messages.forEach((message) => {
    const fingerprint = buildFingerprint(sessionId, message);
    if (dedupeWindow.isDuplicate(outputMap, fingerprint)) {
      return;
    }
    uniqueMessages.push(message);
    outputMap = dedupeWindow.mark(outputMap, fingerprint);
  });

  return {
    messages: uniqueMessages,
    dedupeMap: outputMap
  };
}

function mergeRecords(records, record) {
  const list = Array.isArray(records) ? [...records] : [];
  list.push(record);
  return list;
}

function buildRecordIdentity(record) {
  const paths = Array.isArray(record?.paths) ? record.paths.join("|") : "";
  return [
    `${record?.sessionId || ""}`.trim(),
    `${record?.syncedAt || ""}`.trim(),
    `${record?.lastMessageId || ""}`.trim(),
    paths
  ].join("::");
}

function mergeRecordLists(...lists) {
  const merged = [];
  const seen = new Set();
  lists.flat().forEach((record) => {
    if (!record || typeof record !== "object") {
      return;
    }
    const key = buildRecordIdentity(record);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(record);
  });
  return merged;
}

export class SyncPipeline {
  constructor(dependencies) {
    this.stateRepository = dependencies.stateRepository;
    this.classifier = dependencies.classifier;
    this.publisher = dependencies.publisher;
    this.dedupeWindow = dependencies.dedupeWindow;
    this.logger = dependencies.logger;
    this.alerter = dependencies.alerter;
  }

  async run(command) {
    const syncedAt = nowIso();
    const mode = command.mode;
    const config = await this.stateRepository.getConfig();
    const sessions = await this.stateRepository.getSessionsMap();
    const existing = sessions[command.rawSession.sessionId] || {};

    try {
      const normalized = normalizeSession(command.rawSession);
      const classificationResult = await this.classifier.resolve({
        mode,
        manualSelection: command.manualSelection,
        storedSelection: existing.classification,
        session: normalized,
        autoEnabled: config.classification.autoEnabled,
        autoThreshold: config.classification.autoThreshold,
        defaultDirectory: config.classification.defaultDirectory,
        roleOptions: config.classification.roleTags,
        businessTagOptions: config.classification.businessTagOptions,
        directoryOptions: config.classification.directoryOptions
      });

      if (classificationResult.requiresManual) {
        return {
          status: "skipped",
          reason: "manual_confirmation_required",
          sessionId: normalized.sessionId
        };
      }

      const candidateMessages = mode === "auto"
        ? findAutoIncrementalMessages(
          normalized.messages,
          existing.lastSyncedMessageId,
          existing.lastSyncedMessageSignature
        )
        : normalized.messages;

      if (candidateMessages.length === 0) {
        return {
          status: "skipped",
          reason: "no_incremental_messages",
          sessionId: normalized.sessionId
        };
      }

      const dedupeMap = await this.stateRepository.getDedupeWindowMap();
      const deduped = applyDedupe(candidateMessages, normalized.sessionId, dedupeMap, this.dedupeWindow);

      if (deduped.messages.length === 0) {
        return {
          status: "skipped",
          reason: "dedupe_window_filtered_all",
          sessionId: normalized.sessionId
        };
      }

      const renderSession = {
        ...normalized,
        messages: mode === "auto" ? deduped.messages : normalized.messages
      };
      const artifacts = renderSyncArtifacts({
        session: renderSession,
        classification: classificationResult.classification,
        syncedAt,
        rootPath: config.publish.rootPath
      });

      const contentHash = stableHash(
        artifacts.files.map((file) => `${file.path}:${file.content}`).join("\n")
      );
      if (existing.lastContentHash === contentHash) {
        return {
          status: "skipped",
          reason: "idempotent_hash_match",
          sessionId: normalized.sessionId
        };
      }

      const existingRecords = await this.stateRepository.getIndexRecords();
      const remoteRecords = typeof this.publisher.getExistingIndexRecords === "function"
        ? await this.publisher.getExistingIndexRecords(config.github, config.publish.rootPath)
        : [];
      const mergedRecords = [...mergeRecordLists(remoteRecords, existingRecords), artifacts.record];
      const indexFiles = buildIndexArtifacts(mergedRecords, config.publish.rootPath);
      const publishFiles = [...artifacts.files, ...indexFiles];

      const publishResult = await this.publisher.publishBundle(
        config.github,
        publishFiles,
        `${mode}-${normalized.sessionId}-${Date.now()}`
      );

      await this.stateRepository.saveDedupeWindowMap(deduped.dedupeMap);
      await this.stateRepository.saveIndexRecords(mergedRecords);
      await this.stateRepository.saveSession({
        ...existing,
        ...normalized,
        classification: classificationResult.classification,
        lastSyncedAt: syncedAt,
        lastSyncedMessageId: getLastMessageId(normalized),
        lastSyncedMessageSignature: buildMessageSignature(
          normalized.messages[normalized.messages.length - 1] || {}
        ),
        lastContentHash: contentHash,
        updatedAt: syncedAt
      });

      const result = {
        status: "synced",
        sessionId: normalized.sessionId,
        mode,
        publishedCount: publishResult.publishedCount,
        syncedAt
      };
      await this.stateRepository.saveLastSyncResult(result);
      return result;
    } catch (error) {
      if (error instanceof SyncError && error.isDegradable) {
        this.logger.warn("Degradable sync issue", {
          sessionId: command.rawSession.sessionId,
          code: error.code,
          message: error.message
        });
        return {
          status: "skipped",
          reason: error.code,
          sessionId: command.rawSession.sessionId
        };
      }

      this.logger.error("Non-degradable sync failure", {
        sessionId: command.rawSession.sessionId,
        error: error.message
      });
      await this.alerter.send(config.alerts.webhookUrl, {
        level: "error",
        code: ERROR_CODE.PUBLISH_FAILED,
        message: error.message,
        sessionId: command.rawSession.sessionId,
        at: syncedAt
      });

      return {
        status: "failed",
        reason: error.code || ERROR_CODE.PUBLISH_FAILED,
        message: error.message,
        sessionId: command.rawSession.sessionId
      };
    }
  }
}
