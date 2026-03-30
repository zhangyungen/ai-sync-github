export const STORAGE_KEYS = Object.freeze({
  CONFIG: "config",
  SESSIONS: "sessions",
  DEDUPE_WINDOW: "dedupeWindow",
  INDEX_RECORDS: "indexRecords",
  LAST_SYNC_RESULT: "lastSyncResult"
});

export const SYNC_MODE = Object.freeze({
  MANUAL: "manual",
  AUTO: "auto"
});

export const ALERT_LEVEL = Object.freeze({
  WARN: "warn",
  ERROR: "error"
});

export const AUTO_SYNC_ALARM_NAME = "chatgpt-auto-sync";

export const DEFAULT_SYNC_CONFIG = Object.freeze({
  github: {
    owner: "",
    repo: "",
    branch: "main",
    authMode: "pat",
    token: ""
  },
  autoSync: {
    enabled: false,
    intervalMinutes: 15,
    minIntervalMinutes: 5,
    maxIntervalMinutes: 120
  },
  classification: {
    autoEnabled: false,
    autoThreshold: 0.8,
    defaultDirectory: "general"
  },
  alerts: {
    webhookUrl: ""
  },
  publish: {
    rootPath: "sync-data"
  }
});

export const CONTENT_TYPE = Object.freeze({
  TEXT: "text",
  CODE: "code",
  MARKDOWN: "markdown",
  LINK: "link",
  IMAGE_REF: "image_ref",
  ATTACHMENT_REF: "attachment_ref"
});

export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
