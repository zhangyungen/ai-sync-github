import { ERROR_CODE, SyncError } from "../../constants/errors.js";
import { buildAuthHeader } from "./authStrategies.js";
import { normalizeBranchName, normalizeOwnerRepo } from "./configNormalizer.js";

function formatPublishErrorMessage(errorMessage, owner, repo, branch) {
  const message = `${errorMessage || ""}`;
  if (message.includes("Failed to fetch")) {
    return "发布失败：网络请求失败（Failed to fetch）。请检查代理配置、网络连通性和 GitHub 域名访问。";
  }
  if (
    message.includes("GitHub getRef failed: 403")
    && message.includes("Resource not accessible by personal access token")
  ) {
    return [
      `发布失败：当前 Token 无权访问 Git refs 接口，无法自动创建分支 ${branch}。`,
      "请手动在 GitHub 创建该分支，或更换具备更高仓库权限的 Token。"
    ].join(" ");
  }
  if (message.includes("Resource not accessible by personal access token")) {
    return [
      "发布失败：当前 Token 对目标仓库权限不足。",
      `owner=${owner}, repo=${repo}, branch=${branch}。`,
      "请在 PAT 配置中授权该仓库并授予 Contents 读写权限；如为组织仓库，请额外完成 SSO 授权。"
    ].join(" ");
  }
  if (message.includes("GitHub createBranch failed")) {
    return `发布失败：无法自动创建分支 ${branch}。${message.replace("GitHub createBranch failed: ", "")}`;
  }
  if (message.includes("GitHub upsert failed: 409") && message.includes("does not match")) {
    return [
      "发布失败：GitHub 文件版本冲突（sha 不匹配）。",
      "目标文件可能被其他提交刚刚更新，系统已尝试自动重试仍未成功。",
      "请稍后重试，或避免多个实例同时同步同一仓库。"
    ].join(" ");
  }
  if (
    message.includes("GitHub getRepo failed: 404")
    || message.includes("GitHub createRef failed: 404")
    || message.includes("GitHub getFileSha failed: 404")
    || message.includes("GitHub upsert failed: 404")
  ) {
    return [
      "发布失败：GitHub 仓库不存在或无访问权限。",
      `owner=${owner}, repo=${repo}, branch=${branch}。`,
      "请检查仓库路径、分支名称，以及 Token 对该仓库的读写权限。"
    ].join(" ");
  }
  if (message.includes("GitHub upsert failed: 401") || message.includes("GitHub upsert failed: 403")) {
    return "发布失败：GitHub 鉴权失败，请检查 Token 是否有效、是否具备仓库写入权限。";
  }
  return `Publish failed: ${message}`;
}

function shouldTryCreateBranch(errorMessage) {
  const message = `${errorMessage || ""}`;
  return (
    message.includes("GitHub upsert failed: 404")
    || message.includes("No commit found for the ref")
    || message.includes("Branch not found")
  );
}

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
    const { owner, repo } = normalizeOwnerRepo(config);
    const branch = normalizeBranchName(config?.branch);
    const authHeader = buildAuthHeader({
      ...config,
      owner,
      repo
    });

    if (!owner || !repo) {
      throw new SyncError(
        ERROR_CODE.GITHUB_NOT_CONFIGURED,
        "GitHub owner/repo must be configured before publishing."
      );
    }

    const publishFiles = async () => {
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
    };

    try {
      try {
        await publishFiles();
      } catch (error) {
        if (!shouldTryCreateBranch(error.message) || typeof this.gitHubClient.ensureBranch !== "function") {
          throw error;
        }
        await this.gitHubClient.ensureBranch({
          owner,
          repo,
          branch,
          authHeader
        });
        await publishFiles();
      }
    } catch (error) {
      throw new SyncError(
        ERROR_CODE.PUBLISH_FAILED,
        formatPublishErrorMessage(error.message, owner, repo, branch),
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
