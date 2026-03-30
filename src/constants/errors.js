export const ERROR_CODE = Object.freeze({
  INVALID_INTERVAL: "INVALID_INTERVAL",
  CLASSIFICATION_REQUIRED: "CLASSIFICATION_REQUIRED",
  GITHUB_NOT_CONFIGURED: "GITHUB_NOT_CONFIGURED",
  PUBLISH_FAILED: "PUBLISH_FAILED",
  COLLECTION_FAILED: "COLLECTION_FAILED"
});

export class SyncError extends Error {
  constructor(code, message, isDegradable = false, details = undefined) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.isDegradable = isDegradable;
    this.details = details;
  }
}
