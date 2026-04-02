import test from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODE, SyncError } from "../src/constants/errors.js";
import { GitHubPublisher } from "../src/infrastructure/github/publisher.js";

class FailingGitHubClient {
  async upsertFile() {
    throw new Error("GitHub upsert failed: 404 {\"message\":\"Not Found\"}");
  }
}

class CaptureGitHubClient {
  constructor() {
    this.ensureCalls = [];
    this.upsertCalls = [];
  }

  async ensureBranch(input) {
    this.ensureCalls.push(input);
  }

  async upsertFile(input) {
    this.upsertCalls.push(input);
  }
}

class MissingBranchThenSuccessGitHubClient {
  constructor() {
    this.ensureCalls = [];
    this.upsertCalls = [];
    this.failedOnce = false;
  }

  async ensureBranch(input) {
    this.ensureCalls.push(input);
  }

  async upsertFile(input) {
    this.upsertCalls.push(input);
    if (!this.failedOnce) {
      this.failedOnce = true;
      throw new Error("GitHub upsert failed: 404 {\"message\":\"No commit found for the ref main\"}");
    }
  }
}

class NetworkFailGitHubClient {
  async ensureBranch() {}

  async upsertFile() {
    throw new Error("Failed to fetch");
  }
}

class RefPermissionDeniedGitHubClient {
  async ensureBranch() {
    throw new Error("GitHub getRef failed: 403 {\"message\":\"Resource not accessible by personal access token\"}");
  }

  async upsertFile() {
    throw new Error("GitHub upsert failed: 404 {\"message\":\"No commit found for the ref main\"}");
  }
}

class ContentsPermissionDeniedGitHubClient {
  async upsertFile() {
    throw new Error("GitHub getFileSha failed: 403 {\"message\":\"Resource not accessible by personal access token\"}");
  }
}

class ShaConflictGitHubClient {
  async upsertFile() {
    throw new Error("GitHub upsert failed: 409 {\"message\":\"sync-data/indexes/README.md does not match 1fdf4338724e827ee709fc7d3e94b3469fef5a48\"}");
  }
}

test("publisher should return actionable message for GitHub 404", async () => {
  const publisher = new GitHubPublisher(new FailingGitHubClient(), { maxAttempts: 1 });

  await assert.rejects(
    publisher.publishBundle(
      {
        owner: "alice",
        repo: "ai2git-private",
        branch: "main",
        authMode: "pat",
        token: "token"
      },
      [{ path: "sync-data/indexes/README.md", content: "# hi" }],
      "manual-s1"
    ),
    (error) => {
      assert.equal(error instanceof SyncError, true);
      assert.equal(error.code, ERROR_CODE.PUBLISH_FAILED);
      assert.match(error.message, /仓库不存在或无访问权限/);
      assert.match(error.message, /owner=alice, repo=ai2git-private, branch=main/);
      return true;
    }
  );
});

test("publisher should normalize repo url and branch ref name", async () => {
  const client = new CaptureGitHubClient();
  const publisher = new GitHubPublisher(client, { maxAttempts: 1 });

  const result = await publisher.publishBundle(
    {
      owner: "",
      repo: "https://github.com/alice/ai2git-private.git",
      branch: "refs/heads/main",
      authMode: "pat",
      token: "token"
    },
    [{ path: "sync-data/indexes/README.md", content: "# hi" }],
    "manual-s1"
  );

  assert.equal(result.owner, "alice");
  assert.equal(result.repo, "ai2git-private");
  assert.equal(result.branch, "main");
  assert.equal(client.ensureCalls.length, 0);
  assert.equal(client.upsertCalls.length, 1);
  assert.equal(client.upsertCalls[0].owner, "alice");
  assert.equal(client.upsertCalls[0].repo, "ai2git-private");
  assert.equal(client.upsertCalls[0].branch, "main");
});

test("publisher should create branch and retry when first upsert indicates missing ref", async () => {
  const client = new MissingBranchThenSuccessGitHubClient();
  const publisher = new GitHubPublisher(client, { maxAttempts: 1 });

  const result = await publisher.publishBundle(
    {
      owner: "alice",
      repo: "ai2git-private",
      branch: "main",
      authMode: "pat",
      token: "token"
    },
    [{ path: "sync-data/indexes/README.md", content: "# hi" }],
    "manual-s1"
  );

  assert.equal(result.publishedCount, 1);
  assert.equal(client.ensureCalls.length, 1);
  assert.equal(client.upsertCalls.length, 2);
  assert.equal(client.ensureCalls[0].branch, "main");
});

test("publisher should return actionable message for failed fetch", async () => {
  const publisher = new GitHubPublisher(new NetworkFailGitHubClient(), { maxAttempts: 1 });

  await assert.rejects(
    publisher.publishBundle(
      {
        owner: "alice",
        repo: "ai2git-private",
        branch: "main",
        authMode: "pat",
        token: "token"
      },
      [{ path: "sync-data/indexes/README.md", content: "# hi" }],
      "manual-s1"
    ),
    (error) => {
      assert.equal(error instanceof SyncError, true);
      assert.equal(error.code, ERROR_CODE.PUBLISH_FAILED);
      assert.match(error.message, /网络请求失败/);
      return true;
    }
  );
});

test("publisher should return actionable message for PAT ref permission denied", async () => {
  const publisher = new GitHubPublisher(new RefPermissionDeniedGitHubClient(), { maxAttempts: 1 });

  await assert.rejects(
    publisher.publishBundle(
      {
        owner: "alice",
        repo: "ai2git-private",
        branch: "main",
        authMode: "pat",
        token: "token"
      },
      [{ path: "sync-data/indexes/README.md", content: "# hi" }],
      "manual-s1"
    ),
    (error) => {
      assert.equal(error instanceof SyncError, true);
      assert.equal(error.code, ERROR_CODE.PUBLISH_FAILED);
      assert.match(error.message, /无权访问 Git refs 接口/);
      return true;
    }
  );
});

test("publisher should return actionable message for PAT contents permission denied", async () => {
  const publisher = new GitHubPublisher(new ContentsPermissionDeniedGitHubClient(), { maxAttempts: 1 });

  await assert.rejects(
    publisher.publishBundle(
      {
        owner: "alice",
        repo: "ai2git-private",
        branch: "main",
        authMode: "pat",
        token: "token"
      },
      [{ path: "sync-data/indexes/README.md", content: "# hi" }],
      "manual-s1"
    ),
    (error) => {
      assert.equal(error instanceof SyncError, true);
      assert.equal(error.code, ERROR_CODE.PUBLISH_FAILED);
      assert.match(error.message, /Contents 读写权限/);
      return true;
    }
  );
});

test("publisher should return actionable message for sha conflict 409", async () => {
  const publisher = new GitHubPublisher(new ShaConflictGitHubClient(), { maxAttempts: 1 });

  await assert.rejects(
    publisher.publishBundle(
      {
        owner: "alice",
        repo: "ai2git-private",
        branch: "main",
        authMode: "pat",
        token: "token"
      },
      [{ path: "sync-data/indexes/README.md", content: "# hi" }],
      "manual-s1"
    ),
    (error) => {
      assert.equal(error instanceof SyncError, true);
      assert.equal(error.code, ERROR_CODE.PUBLISH_FAILED);
      assert.match(error.message, /sha 不匹配/);
      return true;
    }
  );
});
