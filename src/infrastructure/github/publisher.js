import { ERROR_CODE, SyncError } from "../../constants/errors.js";
import { buildAuthHeader } from "./authStrategies.js";

export class GitHubPublisher {
  constructor(gitHubClient, retryOptions = {}) {
    this.gitHubClient = gitHubClient;
    this.maxAttempts = retryOptions.maxAttempts || 3;
    this.baseDelayMs = retryOptions.baseDelayMs || 300;
  }

  async upsertWithRetry(input) {
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxAttempts) {
      try {
        await this.gitHubClient.upsertFile(input);
        return;
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt >= this.maxAttempts) {
          break;
        }
        const delay = this.baseDelayMs * (2 ** (attempt - 1));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async publishBundle(config, files, commitLabel) {
    const owner = `${config?.owner || ""}`.trim();
    const repo = `${config?.repo || ""}`.trim();
    const branch = `${config?.branch || "main"}`.trim() || "main";
    const authHeader = buildAuthHeader(config);

    if (!owner || !repo) {
      throw new SyncError(
        ERROR_CODE.GITHUB_NOT_CONFIGURED,
        "GitHub owner/repo must be configured before publishing."
      );
    }

    try {
      for (const file of files) {
        await this.upsertWithRetry({
          owner,
          repo,
          branch,
          path: file.path,
          content: file.content,
          message: `sync: ${commitLabel}`,
          authHeader
        });
      }
    } catch (error) {
      throw new SyncError(
        ERROR_CODE.PUBLISH_FAILED,
        `Publish failed: ${error.message}`,
        false,
        { owner, repo, branch }
      );
    }

    return {
      owner,
      repo,
      branch,
      publishedCount: files.length
    };
  }
}
