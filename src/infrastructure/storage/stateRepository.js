import { DEFAULT_SYNC_CONFIG, STORAGE_KEYS } from "../../constants/sync.js";

function mergeObject(base, patch) {
  const output = { ...base };
  Object.keys(patch || {}).forEach((key) => {
    const value = patch[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeObject(base[key] || {}, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  });
  return output;
}

export class StateRepository {
  constructor(storageGateway) {
    this.storageGateway = storageGateway;
  }

  async getConfig() {
    const stored = await this.storageGateway.get({ [STORAGE_KEYS.CONFIG]: DEFAULT_SYNC_CONFIG });
    return mergeObject(DEFAULT_SYNC_CONFIG, stored[STORAGE_KEYS.CONFIG] || {});
  }

  async updateConfig(patchConfig) {
    const current = await this.getConfig();
    const updated = mergeObject(current, patchConfig || {});
    await this.storageGateway.set({ [STORAGE_KEYS.CONFIG]: updated });
    return updated;
  }

  async getSessionsMap() {
    const stored = await this.storageGateway.get({ [STORAGE_KEYS.SESSIONS]: {} });
    return stored[STORAGE_KEYS.SESSIONS] || {};
  }

  async saveSessionsMap(sessionsMap) {
    await this.storageGateway.set({ [STORAGE_KEYS.SESSIONS]: sessionsMap || {} });
  }

  async saveSession(session) {
    const sessions = await this.getSessionsMap();
    sessions[session.sessionId] = session;
    await this.saveSessionsMap(sessions);
    return session;
  }

  async upsertCollectedSession(collectedSession) {
    const sessions = await this.getSessionsMap();
    const existing = sessions[collectedSession.sessionId] || {};
    const merged = {
      ...existing,
      ...collectedSession,
      updatedAt: new Date().toISOString()
    };
    sessions[collectedSession.sessionId] = merged;
    await this.saveSessionsMap(sessions);
    return merged;
  }

  async listSessions() {
    const sessions = await this.getSessionsMap();
    return Object.values(sessions).sort((left, right) => {
      const a = new Date(left.updatedAt || 0).getTime();
      const b = new Date(right.updatedAt || 0).getTime();
      return b - a;
    });
  }

  async getDedupeWindowMap() {
    const stored = await this.storageGateway.get({ [STORAGE_KEYS.DEDUPE_WINDOW]: {} });
    return stored[STORAGE_KEYS.DEDUPE_WINDOW] || {};
  }

  async saveDedupeWindowMap(dedupeWindowMap) {
    await this.storageGateway.set({ [STORAGE_KEYS.DEDUPE_WINDOW]: dedupeWindowMap || {} });
  }

  async getIndexRecords() {
    const stored = await this.storageGateway.get({ [STORAGE_KEYS.INDEX_RECORDS]: [] });
    return Array.isArray(stored[STORAGE_KEYS.INDEX_RECORDS]) ? stored[STORAGE_KEYS.INDEX_RECORDS] : [];
  }

  async saveIndexRecords(records) {
    await this.storageGateway.set({ [STORAGE_KEYS.INDEX_RECORDS]: records || [] });
  }

  async upsertIndexRecord(record) {
    const records = await this.getIndexRecords();
    records.push(record);
    await this.saveIndexRecords(records);
  }

  async saveLastSyncResult(result) {
    await this.storageGateway.set({ [STORAGE_KEYS.LAST_SYNC_RESULT]: result });
  }

  async getLastSyncResult() {
    const stored = await this.storageGateway.get({ [STORAGE_KEYS.LAST_SYNC_RESULT]: null });
    return stored[STORAGE_KEYS.LAST_SYNC_RESULT];
  }

  async getSyncLogs() {
    const stored = await this.storageGateway.get({ [STORAGE_KEYS.SYNC_LOGS]: [] });
    return Array.isArray(stored[STORAGE_KEYS.SYNC_LOGS]) ? stored[STORAGE_KEYS.SYNC_LOGS] : [];
  }

  async saveSyncLogs(logs) {
    await this.storageGateway.set({ [STORAGE_KEYS.SYNC_LOGS]: logs || [] });
  }

  async appendSyncLogs(entries, max = 300) {
    const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (list.length === 0) {
      return this.getSyncLogs();
    }

    const logs = await this.getSyncLogs();
    logs.push(...list);
    const trimmed = logs.slice(-Math.max(10, Number(max) || 300));
    await this.saveSyncLogs(trimmed);
    return trimmed;
  }

  async clearSyncLogs() {
    await this.saveSyncLogs([]);
  }
}
