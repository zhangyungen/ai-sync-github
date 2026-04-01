import { ROLE_TAGS } from "./roles.js";

export const STORAGE_KEYS = Object.freeze({
  CONFIG: "config",
  SESSIONS: "sessions",
  DEDUPE_WINDOW: "dedupeWindow",
  INDEX_RECORDS: "indexRecords",
  LAST_SYNC_RESULT: "lastSyncResult",
  SYNC_LOGS: "syncLogs"
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
    intervalMinutes: 2,
    minIntervalMinutes: 1,
    maxIntervalMinutes: 5
  },
  classification: {
    autoEnabled: false,
    autoThreshold: 0.8,
    defaultDirectory: "general",
    roleTags: [...ROLE_TAGS],
    businessTagOptions: [
      "市场调研",
      "业务分析",
      "需求设计",
      "技术方案"
    ],
    directoryOptions: [
      "general",
      "market",
      "business",
      "product",
      "architecture"
    ],
    manualSelectionMode: "multiple"
  },
  alerts: {
    webhookUrl: ""
  },
  network: {
    proxyServer: "",
    proxyPort: ""
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
