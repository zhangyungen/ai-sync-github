import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../src/infrastructure/github/client.js";

function createJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function createTextResponse(status, payload) {
  return new Response(payload, {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("ensureBranch should create target branch from default branch when missing", async () => {
  const responses = [
    createJsonResponse(404, { message: "Not Found" }),
    createJsonResponse(200, { default_branch: "master" }),
    createJsonResponse(200, { object: { sha: "base-sha-123" } }),
    createJsonResponse(201, { ref: "refs/heads/main" })
  ];
  const calls = [];
  const client = new GitHubClient(async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  });

  await client.ensureBranch({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    authHeader: "Bearer token"
  });

  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /\/git\/ref\/heads\/main$/);
  assert.match(calls[1].url, /\/repos\/alice\/ai2git$/);
  assert.match(calls[2].url, /\/git\/ref\/heads\/master$/);
  assert.match(calls[3].url, /\/git\/refs$/);
  assert.equal(calls[3].options.method, "POST");
  const payload = JSON.parse(calls[3].options.body);
  assert.equal(payload.ref, "refs/heads/main");
  assert.equal(payload.sha, "base-sha-123");
});

test("ensureBranch should do nothing when target branch exists", async () => {
  const calls = [];
  const client = new GitHubClient(async (url, options = {}) => {
    calls.push({ url, options });
    return createJsonResponse(200, { object: { sha: "existing-sha" } });
  });

  await client.ensureBranch({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    authHeader: "Bearer token"
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/git\/ref\/heads\/main$/);
});

test("upsertFile should probe sha first, then upsert with sha when file exists", async () => {
  const calls = [];
  const responses = [
    createJsonResponse(200, { sha: "existing-sha" }),
    createJsonResponse(201, { content: { path: "a.md" } })
  ];
  const client = new GitHubClient(async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  });

  await client.upsertFile({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    path: "sync-data/a.md",
    content: "hello",
    message: "sync: test",
    authHeader: "Bearer token"
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].options.method, "PUT");
  const putPayload = JSON.parse(calls[1].options.body);
  assert.equal(putPayload.sha, "existing-sha");
});

test("upsertFile should retry with sha when first put returns 422", async () => {
  const responses = [
    createJsonResponse(404, { message: "Not Found" }),
    createTextResponse(422, "{\"message\":\"sha wasn't supplied\"}"),
    createJsonResponse(200, { sha: "existing-sha" }),
    createJsonResponse(200, { content: { path: "a.md" } })
  ];
  const calls = [];
  const client = new GitHubClient(async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  });

  await client.upsertFile({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    path: "sync-data/a.md",
    content: "hello",
    message: "sync: test",
    authHeader: "Bearer token"
  });

  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].options.method, "PUT");
  assert.equal(calls[2].options.method, "GET");
  assert.equal(calls[3].options.method, "PUT");
});

test("upsertFile should parse GitHub multiline sha-missing message and retry with sha", async () => {
  const responses = [
    createJsonResponse(404, { message: "Not Found" }),
    createTextResponse(422, "{\"message\":\"Invalid request.\\n\\n\\\"sha\\\" wasn't supplied.\",\"status\":\"422\"}"),
    createJsonResponse(200, { sha: "existing-sha" }),
    createJsonResponse(200, { content: { path: "indexes/README.md" } })
  ];
  const calls = [];
  const client = new GitHubClient(async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  });

  await client.upsertFile({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    path: "sync-data/indexes/README.md",
    content: "hello",
    message: "sync: test",
    authHeader: "Bearer token"
  });

  assert.equal(calls.length, 4);
  const retryPayload = JSON.parse(calls[3].options.body);
  assert.equal(retryPayload.sha, "existing-sha");
});

test("upsertFile should handle non-json 422 body with escaped sha message", async () => {
  const responses = [
    createJsonResponse(404, { message: "Not Found" }),
    createTextResponse(422, "Invalid request.\\n\\n\\\"sha\\\" wasn't supplied."),
    createJsonResponse(200, { sha: "existing-sha" }),
    createJsonResponse(200, { content: { path: "indexes/README.md" } })
  ];
  const client = new GitHubClient(async () => responses.shift());

  await client.upsertFile({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    path: "sync-data/indexes/README.md",
    content: "hello",
    message: "sync: test",
    authHeader: "Bearer token"
  });
});

test("upsertFile should throw actionable error when sha is required but cannot be resolved", async () => {
  const responses = [
    createJsonResponse(404, { message: "Not Found" }),
    createTextResponse(422, "{\"message\":\"Invalid request.\\n\\n\\\"sha\\\" wasn't supplied.\"}"),
    createJsonResponse(404, { message: "Not Found" })
  ];
  const client = new GitHubClient(async () => responses.shift());

  await assert.rejects(
    client.upsertFile({
      owner: "alice",
      repo: "ai2git",
      branch: "main",
      path: "sync-data/a.md",
      content: "hello",
      message: "sync: test",
      authHeader: "Bearer token"
    }),
    /Unable to resolve existing file SHA/
  );
});

test("upsertFile should retry with latest sha when GitHub returns 409 sha conflict", async () => {
  const responses = [
    createJsonResponse(200, { sha: "stale-sha" }),
    createTextResponse(409, "{\"message\":\"sync-data/indexes/README.md does not match 1fdf4338724e827ee709fc7d3e94b3469fef5a48\",\"status\":\"409\"}"),
    createJsonResponse(200, { sha: "latest-sha" }),
    createJsonResponse(200, { content: { path: "sync-data/indexes/README.md" } })
  ];
  const calls = [];
  const client = new GitHubClient(async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  });

  await client.upsertFile({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    path: "sync-data/indexes/README.md",
    content: "hello",
    message: "sync: test",
    authHeader: "Bearer token"
  });

  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].options.method, "PUT");
  assert.equal(calls[2].options.method, "GET");
  assert.equal(calls[3].options.method, "PUT");
  const retryPayload = JSON.parse(calls[3].options.body);
  assert.equal(retryPayload.sha, "latest-sha");
});

test("getFileContent should decode base64 content", async () => {
  const encoded = Buffer.from("[{\"sessionId\":\"s1\"}]", "utf-8").toString("base64");
  const client = new GitHubClient(async () => createJsonResponse(200, { content: encoded }));

  const content = await client.getFileContent({
    owner: "alice",
    repo: "ai2git",
    branch: "main",
    path: "sync-data/indexes/index.json",
    authHeader: "Bearer token"
  });

  assert.equal(content, "[{\"sessionId\":\"s1\"}]");
});
