import { toBase64 } from "../../shared/base64.js";

function encodePath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export class GitHubClient {
  constructor(fetcher = fetch, apiBase = "https://api.github.com") {
    this.fetcher = fetcher;
    this.apiBase = apiBase;
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

  async upsertFile(input) {
    const path = encodePath(input.path);
    const url = `${this.apiBase}/repos/${input.owner}/${input.repo}/contents/${path}`;
    const sha = await this.getFileSha(input);
    const body = {
      message: input.message,
      content: toBase64(input.content),
      branch: input.branch
    };
    if (sha) {
      body.sha = sha;
    }

    const response = await this.fetcher(url, {
      method: "PUT",
      headers: {
        Authorization: input.authHeader,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`GitHub upsert failed: ${response.status} ${payload}`);
    }
  }
}
