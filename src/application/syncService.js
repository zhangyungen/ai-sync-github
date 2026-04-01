import { SYNC_MODE } from "../constants/sync.js";
import { normalizeSession } from "../domain/services/normalizer.js";
import { validateInterval } from "../domain/policies/syncIntervalPolicy.js";

function mergeConfig(current, patch) {
  const output = { ...current };
  Object.keys(patch || {}).forEach((key) => {
    const value = patch[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeConfig(current[key] || {}, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  });
  return output;
}

function summarize(results) {
  const summary = {
    synced: 0,
    skipped: 0,
    failed: 0,
    results
  };

  results.forEach((result) => {
    if (result.status === "synced") {
      summary.synced += 1;
    } else if (result.status === "failed") {
      summary.failed += 1;
    } else {
      summary.skipped += 1;
    }
  });

  return summary;
}

function buildRunLogEntries(mode, results, summary) {
  const now = new Date().toISOString();
  const detailLogs = (results || []).map((result) => ({
    at: now,
    mode,
    level: result.status === "failed" ? "error" : result.status === "skipped" ? "warn" : "info",
    type: "session",
    sessionId: result.sessionId || "",
    status: result.status || "unknown",
    reason: result.reason || "",
    message: result.message || ""
  }));

  const summaryLog = {
    at: now,
    mode,
    level: summary.failed > 0 ? "warn" : "info",
    type: "summary",
    sessionId: "",
    status: "completed",
    reason: "",
    message: `同步完成：成功 ${summary.synced}，跳过 ${summary.skipped}，失败 ${summary.failed}`
  };

  return [...detailLogs, summaryLog];
}

export class SyncService {
  constructor(dependencies) {
    this.stateRepository = dependencies.stateRepository;
    this.pipeline = dependencies.pipeline;
    this.logger = dependencies.logger;
  }

  async getConfig() {
    return this.stateRepository.getConfig();
  }

  async updateConfig(patchConfig) {
    const current = await this.stateRepository.getConfig();
    const merged = mergeConfig(current, patchConfig || {});
    validateInterval(
      merged.autoSync.intervalMinutes,
      merged.autoSync.minIntervalMinutes,
      merged.autoSync.maxIntervalMinutes
    );
    return this.stateRepository.updateConfig(patchConfig);
  }

  async collectSession(rawSession) {
    const normalized = normalizeSession(rawSession);
    const merged = await this.stateRepository.upsertCollectedSession({
      ...normalized,
      updatedAt: new Date().toISOString()
    });
    return merged;
  }

  async listSessions() {
    return this.stateRepository.listSessions();
  }

  async runManualSync(command) {
    const sessionsMap = await this.stateRepository.getSessionsMap();
    const sessionIds = Array.from(new Set(command.sessionIds || []));
    const results = [];

    for (const sessionId of sessionIds) {
      const snapshot = sessionsMap[sessionId];
      if (!snapshot) {
        results.push({
          status: "failed",
          sessionId,
          reason: "session_not_found"
        });
        continue;
      }

      const result = await this.pipeline.run({
        mode: SYNC_MODE.MANUAL,
        rawSession: snapshot,
        manualSelection: command.manualSelection
      });
      results.push(result);
    }

    const summary = summarize(results);
    await this.stateRepository.saveLastSyncResult(summary);
    await this.stateRepository.appendSyncLogs(buildRunLogEntries(SYNC_MODE.MANUAL, results, summary));
    return summary;
  }

  async runAutoSync() {
    const config = await this.stateRepository.getConfig();
    validateInterval(
      config.autoSync.intervalMinutes,
      config.autoSync.minIntervalMinutes,
      config.autoSync.maxIntervalMinutes
    );

    const sessions = await this.stateRepository.listSessions();
    const results = [];

    for (const snapshot of sessions) {
      const result = await this.pipeline.run({
        mode: SYNC_MODE.AUTO,
        rawSession: snapshot,
        manualSelection: null
      });
      results.push(result);
    }

    const summary = summarize(results);
    await this.stateRepository.saveLastSyncResult(summary);
    await this.stateRepository.appendSyncLogs(buildRunLogEntries(SYNC_MODE.AUTO, results, summary));
    this.logger.info("Auto sync run completed", summary);
    return summary;
  }
}
