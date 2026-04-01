import { ROLE_TAGS } from "../../constants/roles.js";

const DEFAULT_BUSINESS_TAG_OPTIONS = [
  "市场调研",
  "业务分析",
  "需求设计",
  "技术方案"
];

const DEFAULT_DIRECTORY_OPTIONS = [
  "general",
  "market",
  "business",
  "product",
  "architecture"
];

const DEFAULT_AUTO_SYNC_INTERVAL = 2;
const DEFAULT_AUTO_SYNC_MIN = 1;
const DEFAULT_AUTO_SYNC_MAX = 5;

function node(id) {
  return document.getElementById(id);
}

async function callRuntime(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || `Runtime call failed: ${type}`);
  }
  return response.data;
}

function setStatus(text) {
  node("status").textContent = text || "";
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.floor(number);
}

function parseThreshold(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  if (number < 0) {
    return 0;
  }
  if (number > 1) {
    return 1;
  }
  return number;
}

function parseProxyPort(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }
  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new Error("代理端口必须是 1-65535 的整数。");
  }
  return number;
}

function normalizeTagList(values, fallback = []) {
  const list = Array.isArray(values) ? values : [];
  const normalized = Array.from(new Set(list
    .map((value) => `${value || ""}`.trim())
    .filter(Boolean)));
  if (normalized.length > 0) {
    return normalized;
  }
  return Array.from(new Set((fallback || [])
    .map((value) => `${value || ""}`.trim())
    .filter(Boolean)));
}

function parseTagListInput(text, fallback = []) {
  const values = `${text || ""}`
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return normalizeTagList(values, fallback);
}

function formatTagList(values, fallback = []) {
  return normalizeTagList(values, fallback).join("\n");
}

function ensureDirectoryOptions(defaultDirectory, directoryOptions) {
  const normalizedDefault = `${defaultDirectory || ""}`.trim() || "general";
  const options = normalizeTagList(directoryOptions, [normalizedDefault, ...DEFAULT_DIRECTORY_OPTIONS]);
  if (options.includes(normalizedDefault)) {
    return { defaultDirectory: normalizedDefault, directoryOptions: options };
  }
  return { defaultDirectory: normalizedDefault, directoryOptions: [normalizedDefault, ...options] };
}

function fillForm(config) {
  node("github-owner").value = config.github.owner || "";
  node("github-repo").value = config.github.repo || "";
  node("github-branch").value = config.github.branch || "main";
  node("github-auth-mode").value = config.github.authMode || "pat";
  node("github-token").value = config.github.token || "";

  node("proxy-server").value = config.network?.proxyServer || "";
  node("proxy-port").value = config.network?.proxyPort || "";

  node("auto-enabled").checked = !!config.autoSync.enabled;
  node("auto-interval").value = config.autoSync.intervalMinutes ?? DEFAULT_AUTO_SYNC_INTERVAL;
  node("auto-min").value = config.autoSync.minIntervalMinutes ?? DEFAULT_AUTO_SYNC_MIN;
  node("auto-max").value = config.autoSync.maxIntervalMinutes ?? DEFAULT_AUTO_SYNC_MAX;

  node("webhook-url").value = config.alerts.webhookUrl || "";

  const classification = config.classification || {};
  const roleTags = normalizeTagList(classification.roleTags, ROLE_TAGS);
  const businessTagOptions = normalizeTagList(
    classification.businessTagOptions,
    DEFAULT_BUSINESS_TAG_OPTIONS
  );
  const normalizedDirectory = ensureDirectoryOptions(
    classification.defaultDirectory || "general",
    classification.directoryOptions
  );

  node("auto-classify-enabled").checked = !!classification.autoEnabled;
  node("auto-threshold").value = classification.autoThreshold ?? 0.8;
  node("default-directory").value = normalizedDirectory.defaultDirectory;
  node("role-tags").value = formatTagList(roleTags, ROLE_TAGS);
  node("business-tag-options").value = formatTagList(
    businessTagOptions,
    DEFAULT_BUSINESS_TAG_OPTIONS
  );
  node("directory-options").value = formatTagList(
    normalizedDirectory.directoryOptions,
    DEFAULT_DIRECTORY_OPTIONS
  );

  node("publish-root-path").value = config.publish.rootPath || "sync-data";
}

function collectPatch() {
  const proxyServer = node("proxy-server").value.trim();
  const proxyPort = parseProxyPort(node("proxy-port").value);
  if ((proxyServer && !proxyPort) || (!proxyServer && proxyPort)) {
    throw new Error("代理服务器和代理端口需同时填写，或同时留空。");
  }

  const defaultDirectory = node("default-directory").value.trim() || "general";
  const roleTags = parseTagListInput(node("role-tags").value, ROLE_TAGS);
  const businessTagOptions = parseTagListInput(
    node("business-tag-options").value,
    DEFAULT_BUSINESS_TAG_OPTIONS
  );
  const parsedDirectoryOptions = parseTagListInput(
    node("directory-options").value,
    [defaultDirectory, ...DEFAULT_DIRECTORY_OPTIONS]
  );
  const normalizedDirectory = ensureDirectoryOptions(defaultDirectory, parsedDirectoryOptions);

  return {
    github: {
      owner: node("github-owner").value.trim(),
      repo: node("github-repo").value.trim(),
      branch: node("github-branch").value.trim() || "main",
      authMode: node("github-auth-mode").value,
      token: node("github-token").value.trim()
    },
    network: {
      proxyServer,
      proxyPort
    },
    autoSync: {
      enabled: node("auto-enabled").checked,
      intervalMinutes: parsePositiveInteger(node("auto-interval").value, DEFAULT_AUTO_SYNC_INTERVAL),
      minIntervalMinutes: parsePositiveInteger(node("auto-min").value, DEFAULT_AUTO_SYNC_MIN),
      maxIntervalMinutes: parsePositiveInteger(node("auto-max").value, DEFAULT_AUTO_SYNC_MAX)
    },
    alerts: {
      webhookUrl: node("webhook-url").value.trim()
    },
    classification: {
      autoEnabled: node("auto-classify-enabled").checked,
      autoThreshold: parseThreshold(node("auto-threshold").value, 0.8),
      defaultDirectory: normalizedDirectory.defaultDirectory,
      roleTags,
      businessTagOptions,
      directoryOptions: normalizedDirectory.directoryOptions,
      manualSelectionMode: "multiple"
    },
    publish: {
      rootPath: node("publish-root-path").value.trim() || "sync-data"
    }
  };
}

function collectGithubConfigFromForm() {
  return {
    owner: node("github-owner").value.trim(),
    repo: node("github-repo").value.trim(),
    branch: node("github-branch").value.trim() || "main",
    authMode: node("github-auth-mode").value,
    token: node("github-token").value.trim()
  };
}

async function validateGithubAccessFromForm() {
  const result = await callRuntime("validate-github-access", {
    github: collectGithubConfigFromForm()
  });
  return result;
}

function ensureObject(input, message) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(message);
  }
  return input;
}

function normalizeImportedPatch(raw) {
  const patch = ensureObject(raw, "配置文件格式无效，必须是 JSON 对象。");
  const classification = patch.classification;
  if (classification !== undefined) {
    ensureObject(classification, "classification 必须是对象。");
    classification.manualSelectionMode = "multiple";
  }
  return patch;
}

function downloadConfigFile(config) {
  const blob = new Blob(
    [JSON.stringify(config, null, 2)],
    { type: "application/json;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `ai2git-config-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importConfigFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("配置文件不是合法 JSON。");
  }

  const patch = normalizeImportedPatch(parsed);
  const updated = await callRuntime("save-config", { patch });
  fillForm(updated);
}

node("validate-github").addEventListener("click", async () => {
  try {
    setStatus("正在校验 GitHub 权限...");
    const result = await validateGithubAccessFromForm();
    setStatus(result?.message || "GitHub 权限校验通过。");
  } catch (error) {
    setStatus(`GitHub 权限校验失败：${error.message}`);
  }
});

node("import-config").addEventListener("click", () => {
  node("config-file-input").click();
});

node("config-file-input").addEventListener("change", async (event) => {
  try {
    const file = event.target.files?.[0];
    setStatus("正在导入配置...");
    await importConfigFile(file);
    setStatus("配置导入成功。");
  } catch (error) {
    setStatus(`配置导入失败：${error.message}`);
  } finally {
    event.target.value = "";
  }
});

node("export-config").addEventListener("click", async () => {
  try {
    setStatus("正在导出配置...");
    downloadConfigFile(collectPatch());
    setStatus("配置导出成功。");
  } catch (error) {
    setStatus(`配置导出失败：${error.message}`);
  }
});

node("save-options").addEventListener("click", async () => {
  try {
    setStatus("正在校验 GitHub 权限...");
    await validateGithubAccessFromForm();
    setStatus("正在保存...");
    await callRuntime("save-config", { patch: collectPatch() });
    setStatus("高级设置已保存。");
  } catch (error) {
    setStatus(`保存失败：${error.message}`);
  }
});

callRuntime("get-config")
  .then((config) => {
    fillForm(config);
    setStatus("");
  })
  .catch((error) => setStatus(`初始化失败：${error.message}`));
