import { toBase64 } from "../../shared/base64.js";
import { fromBase64 } from "../../shared/base64.js";

function encodePath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function encodeRefName(refName) {
  return encodeURIComponent(`${refName || ""}`.trim());
}

function collectErrorHints(rawPayload) {
  const normalizedRaw = `${rawPayload || ""}`.toLowerCase();
  const normalizedUnescapedRaw = normalizedRaw.replace(/\\\"/g, "\"");
  let parsed = null;

  try {
    parsed = JSON.parse(rawPayload);
  } catch {}

  const messages = [];
  if (normalizedRaw) {
    messages.push(normalizedRaw);
  }
  if (normalizedUnescapedRaw) {
    messages.push(normalizedUnescapedRaw);
  }
  if (parsed?.message) {
    messages.push(`${parsed.message}`.toLowerCase());
  }
  if (Array.isArray(parsed?.errors)) {
    parsed.errors.forEach((entry) => {
      if (typeof entry === "string") {
        messages.push(entry.toLowerCase());
        return;
      }
      if (entry && typeof entry === "object") {
        if (entry.message) {
          messages.push(`${entry.message}`.toLowerCase());
        }
        if (entry.field) {
          messages.push(`${entry.field}`.toLowerCase());
        }
        if (entry.code) {
          messages.push(`${entry.code}`.toLowerCase());
        }
      }
    });
  }

  return messages;
}

function isMissingShaErrorPayload(rawPayload) {
  const messages = collectErrorHints(rawPayload);
  return messages.some((item) => {
    if (!item) {
      return false;
    }
    if (item.includes("missing_field") && item.includes("sha")) {
      return true;
    }
    return /["']?sha["']?\s+wasn'?t supplied/.test(item);
  });
}

function isShaConflictPayload(rawPayload) {
  const messages = collectErrorHints(rawPayload);
  return messages.some((item) => /does not match\s+[0-9a-f]{7,40}/.test(item));
}

export class GitHubClient {
  constructor(fetcher = fetch, apiBase = "https://api.github.com") {
    this.fetcher = (...args) => fetcher.apply(globalThis, args);
    this.apiBase = apiBase;
  }

  async getDefaultBranch(input) {
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}`;
    const response = await this.fetcher(url, {
      method: "GET",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub getRepo failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    return `${payload.default_branch || "main"}`.trim() || "main";
  }

  async getRefSha(input) {
    const ref = encodeRefName(input.branch);
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}/git/ref/heads/${ref}`;
    const response = await this.fetcher(url, {
      method: "GET",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json"
      }
    });

    if (response.status === 404) {
      return "";
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub getRef failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    return payload?.object?.sha || "";
  }

  async createRef(input) {
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}/git/refs`;
    const response = await this.fetcher(url, {
      method: "POST",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: `refs/heads/${input.branch}`,
        sha: input.sha
      })
    });

    if (response.status === 422) {
      // Branch may have been created concurrently by another request.
      return;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub createRef failed: ${response.status} ${body}`);
    }
  }

  async ensureBranch(input) {
    const existingSha = await this.getRefSha(input);
    if (existingSha) {
      return;
    }

    const defaultBranch = await this.getDefaultBranch(input);
    const baseSha = await this.getRefSha({
      ...input,
      branch: defaultBranch
    });
    if (!baseSha) {
      throw new Error(
        `GitHub createBranch failed: base branch '${defaultBranch}' has no commit. Initialize the repository with an initial commit first.`
      );
    }

    await this.createRef({
      ...input,
      sha: baseSha
    });
  }

  async getFileSha(input) {
    const path = encodePath(input.path);
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}/contents/${path}?ref=${encodeURIComponent(input.branch)}`;
    const response = await this.fetcher(url, {
      method: "GET",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json"
      }
    });

    if (response.status === 404) {
      return "";
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub getFileSha failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    return payload.sha || "";
  }

  async getFileContent(input) {
    const path = encodePath(input.path);
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}/contents/${path}?ref=${encodeURIComponent(input.branch)}`;
    const response = await this.fetcher(url, {
      method: "GET",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json"
      }
    });

    if (response.status === 404) {
      return "";
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub getFileContent failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    const encoded = `${payload?.content || ""}`;
    if (!encoded.trim()) {
      return "";
    }
    return fromBase64(encoded);
  }

  async upsertFile(input) {
    const path = encodePath(input.path);
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}/contents/${path}`;
    const createBody = (sha = "") => {
      const body = {
        message: input.message,
        content: toBase64(input.content),
        branch: input.branch
      };
      if (sha) {
        body.sha = sha;
      }
      return body;
    };

    let knownSha = "";
    try {
      knownSha = await this.getFileSha(input);
    } catch {
      // Keep optimistic path. Some tokens may still allow PUT even if SHA probe fails.
      knownSha = "";
    }

    let response = await this.fetcher(url, {
      method: "PUT",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createBody(knownSha))
    });

    if (response.ok) {
      return;
    }

    if (response.status === 422) {
      const payload422 = await response.text();
      const missingSha = isMissingShaErrorPayload(payload422);

      if (!missingSha) {
        throw new Error(`GitHub upsert failed: 422 ${payload422}`);
      }

      let sha = knownSha;
      if (!sha) {
        sha = await this.getFileSha(input);
      }
      if (!sha) {
        throw new Error(
          `GitHub upsert failed: 422 ${payload422}. Unable to resolve existing file SHA; check token contents read permission, branch name, and path.`
        );
      }

      response = await this.fetcher(url, {
        method: "PUT",
        headers: {
          Authorization: input.authHeader,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(createBody(sha))
      });

      if (response.ok) {
        return;
      }
    }

    if (response.status === 409) {
      const payload409 = await response.text();
      const shaConflict = isShaConflictPayload(payload409);
      if (!shaConflict) {
        throw new Error(`GitHub upsert failed: 409 ${payload409}`);
      }

      const latestSha = await this.getFileSha(input);
      if (!latestSha) {
        throw new Error(
          `GitHub upsert failed: 409 ${payload409}. Unable to resolve latest file SHA; check token contents read permission, branch name, and path.`
        );
      }

      response = await this.fetcher(url, {
        method: "PUT",
        headers: {
          Authorization: input.authHeader,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(createBody(latestSha))
      });

      if (response.ok) {
        return;
      }
    }

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`GitHub upsert failed: ${response.status} ${payload}`);
    }
  }
}
