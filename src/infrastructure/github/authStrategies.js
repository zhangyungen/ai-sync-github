import { ERROR_CODE, SyncError } from "../../constants/errors.js";

function normalizeMode(mode) {
  return `${mode || "pat"}`.trim().toLowerCase();
}

function assertToken(token, mode) {
  if (!token || `${token}`.trim() === "") {
    throw new SyncError(
      ERROR_CODE.GITHUB_NOT_CONFIGURED,
      `GitHub token is required for auth mode: ${mode}.`
    );
  }
}

export function buildAuthHeader(githubConfig) {
  const mode = normalizeMode(githubConfig?.authMode);
  const token = `${githubConfig?.token || ""}`.trim();

  if (!githubConfig?.owner || !githubConfig?.repo) {
    throw new SyncError(
      ERROR_CODE.GITHUB_NOT_CONFIGURED,
      "GitHub owner and repo are required."
    );
  }

  if (mode === "pat" || mode === "oauth" || mode === "app") {
    assertToken(token, mode);
    return `Bearer ${token}`;
  }

  throw new SyncError(
    ERROR_CODE.GITHUB_NOT_CONFIGURED,
    `Unsupported GitHub auth mode: ${mode}`
  );
}
