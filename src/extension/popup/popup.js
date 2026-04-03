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

const state = {
  config: null,
  sessions: [],
  syncLogs: [],
  selectedSessionIds: new Set(),
  selection: {
    roles: new Set(),
    businessTags: new Set(),
    directories: new Set()
  }
};

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

function setStatus(message) {
  node("status").textContent = message || "";
}

function showCollectPageRefreshTip(actionLabel = "采集会话") {
  const tip = "无法采集当前页面数据，请刷新页面后重试。";
  window.alert(tip);
  setStatus(`${actionLabel}失败：${tip}`);
}

function formatLogTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return value || "";
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderSyncLogs(logs) {
  const container = node("sync-log-list");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  const list = Array.isArray(logs) ? [...logs].reverse() : [];
  if (list.length === 0) {
    container.textContent = "暂无同步日志。";
    return;
  }

  list.slice(0, 120).forEach((log) => {
    const item = document.createElement("div");
    item.className = `sync-log-item ${log.level || "info"}`;

    const title = document.createElement("div");
    const modeText = log.mode === "auto" ? "自动" : "手动";
    const sessionText = log.sessionId ? ` | ${log.sessionId}` : "";
    title.textContent = `[${modeText}] ${log.message || log.status || "同步记录"}${sessionText}`;

    const meta = document.createElement("div");
    meta.className = "sync-log-meta";
    meta.textContent = `${formatLogTime(log.at)}${log.reason ? ` | reason=${log.reason}` : ""}`;

    item.appendChild(title);
    item.appendChild(meta);
    container.appendChild(item);
  });
}

function renderAutoSyncIndicator(config) {
  const indicator = node("auto-sync-indicator");
  if (!indicator) {
    return;
  }

  const enabled = !!config?.autoSync?.enabled;
  const interval = Number(config?.autoSync?.intervalMinutes || 0);
  const min = Number(config?.autoSync?.minIntervalMinutes || 0);
  const max = Number(config?.autoSync?.maxIntervalMinutes || 0);

  indicator.classList.toggle("enabled", enabled);
  indicator.classList.toggle("disabled", !enabled);
  if (enabled) {
    indicator.textContent = `自动同步：已启用（每 ${interval} 分钟，范围 ${min}-${max} 分钟）`;
    return;
  }
  indicator.textContent = "自动同步：未启用";
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

function getLatestPreview(session) {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const last = messages[messages.length - 1];
  if (!last || !Array.isArray(last.parts)) {
    return "";
  }
  const part = last.parts.find((item) => item.text) || last.parts[0];
  return part?.text ? `${part.text}`.slice(0, 80) : "";
}

function getClassificationConfig() {
  const classification = state.config?.classification || {};
  const roleTags = normalizeTagList(classification.roleTags, ROLE_TAGS);
  const businessTagOptions = normalizeTagList(
    classification.businessTagOptions,
    DEFAULT_BUSINESS_TAG_OPTIONS
  );
  const defaultDirectory = `${classification.defaultDirectory || "general"}`.trim() || "general";
  const directoryOptions = normalizeTagList(
    classification.directoryOptions,
    [defaultDirectory, ...DEFAULT_DIRECTORY_OPTIONS]
  );

  return {
    roleTags,
    businessTagOptions,
    directoryOptions: directoryOptions.includes(defaultDirectory)
      ? directoryOptions
      : [defaultDirectory, ...directoryOptions],
    defaultDirectory
  };
}

function loadSelectionDefaults() {
  const {
    roleTags,
    businessTagOptions,
    directoryOptions
  } = getClassificationConfig();
  state.selection.roles = new Set(Array.from(state.selection.roles).filter((value) => roleTags.includes(value)));
  state.selection.businessTags = new Set(
    Array.from(state.selection.businessTags).filter((value) => businessTagOptions.includes(value))
  );
  state.selection.directories = new Set(
    Array.from(state.selection.directories).filter((value) => directoryOptions.includes(value))
  );
}

function renderTagGroup(containerId, values, selectionSet, key) {
  const container = node(containerId);
  container.innerHTML = "";

  if (!values.length) {
    const emptyNode = document.createElement("div");
    emptyNode.className = "tag-empty";
    emptyNode.textContent = "请先在高级设置中维护标签库。";
    container.appendChild(emptyNode);
    selectionSet.clear();
    return;
  }

  values.forEach((value) => {
    const label = document.createElement("label");
    label.className = "tag-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = `manual-${key}`;
    input.value = value;
    input.checked = selectionSet.has(value);

    input.addEventListener("change", () => {
      if (input.checked) {
        selectionSet.add(value);
      } else {
        selectionSet.delete(value);
      }
    });

    const text = document.createElement("span");
    text.textContent = value;

    label.appendChild(input);
    label.appendChild(text);
    container.appendChild(label);
  });
}

function renderTagSelection() {
  const { roleTags, businessTagOptions, directoryOptions } = getClassificationConfig();
  renderTagGroup("role-list", roleTags, state.selection.roles, "role");
  renderTagGroup("business-tag-list", businessTagOptions, state.selection.businessTags, "business");
  renderTagGroup("directory-list", directoryOptions, state.selection.directories, "directory");
}

function renderSessions(sessions) {
  const listNode = node("session-list");
  listNode.innerHTML = "";

  if (!sessions || sessions.length === 0) {
    listNode.textContent = "暂无会话，请先在聊天页面点击“采集当前会话”。";
    state.selectedSessionIds.clear();
    return;
  }

  const knownIds = new Set(sessions.map((session) => session.sessionId));
  state.selectedSessionIds = new Set(
    Array.from(state.selectedSessionIds).filter((sessionId) => knownIds.has(sessionId))
  );

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item";

    const label = document.createElement("label");
    label.className = "inline";

    const input = document.createElement("input");
    input.className = "session-checkbox";
    input.type = "checkbox";
    input.value = session.sessionId;
    input.checked = state.selectedSessionIds.has(session.sessionId);
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedSessionIds.add(session.sessionId);
      } else {
        state.selectedSessionIds.delete(session.sessionId);
      }
    });

    const title = document.createElement("span");
    title.className = "session-title";
    title.textContent = session.title || session.sessionId;

    label.appendChild(input);
    label.appendChild(title);

    const idMeta = document.createElement("div");
    idMeta.className = "session-meta";
    idMeta.textContent = session.sessionId;

    const previewMeta = document.createElement("div");
    previewMeta.className = "session-meta";
    previewMeta.textContent = getLatestPreview(session);

    item.appendChild(label);
    item.appendChild(idMeta);
    item.appendChild(previewMeta);
    listNode.appendChild(item);
  });
}

function getMissingGithubConfigFields(config) {
  const authMode = `${config?.github?.authMode || "pat"}`.trim().toLowerCase();
  const owner = `${config?.github?.owner || ""}`.trim();
  const repo = `${config?.github?.repo || ""}`.trim();
  const token = `${config?.github?.token || ""}`.trim();
  const missing = [];

  if (!owner) {
    missing.push("GitHub Owner");
  }
  if (!repo) {
    missing.push("GitHub Repo");
  }
  if ((authMode === "pat" || authMode === "oauth" || authMode === "app") && !token) {
    missing.push("GitHub Token");
  }

  return missing;
}

async function ensureGithubConfigForSync() {
  const config = state.config || await callRuntime("get-config");
  const missing = getMissingGithubConfigFields(config);
  if (missing.length === 0) {
    return true;
  }

  const message = `缺失必填配置信息：${missing.join("、")}。请先在高级设置中填写并保存。`;
  window.alert(message);
  setStatus(message);
  return false;
}

function buildManualSelection() {
  const roles = Array.from(state.selection.roles);
  const businessTags = Array.from(state.selection.businessTags);
  const directories = Array.from(state.selection.directories);
  const directory = directories[0] || "";

  return {
    roles,
    businessTags,
    directories,
    directory
  };
}

function renderLastResult(lastResult) {
  if (!lastResult) {
    setStatus("");
    return;
  }

  if (typeof lastResult.synced === "number") {
    setStatus(`上次同步：成功 ${lastResult.synced}，跳过 ${lastResult.skipped ?? 0}，失败 ${lastResult.failed ?? 0}`);
    return;
  }

  if (lastResult.status === "synced") {
    setStatus("上次同步：成功 1，跳过 0，失败 0");
    return;
  }

  if (lastResult.status === "failed") {
    setStatus("上次同步：成功 0，跳过 0，失败 1");
    return;
  }

  setStatus("上次同步：成功 0，跳过 1，失败 0");
}

async function refresh() {
  const [config, sessions, lastResult, syncLogs] = await Promise.all([
    callRuntime("get-config"),
    callRuntime("list-sessions"),
    callRuntime("get-last-sync-result"),
    callRuntime("get-sync-logs")
  ]);

  state.config = config;
  state.sessions = sessions;
  state.syncLogs = Array.isArray(syncLogs) ? syncLogs : [];

  renderAutoSyncIndicator(config);
  loadSelectionDefaults();
  renderTagSelection();
  renderSessions(sessions);
  renderLastResult(lastResult);
  renderSyncLogs(state.syncLogs);
}

node("collect-current").addEventListener("click", async () => {
  try {
    setStatus("正在采集当前会话...");
    const collected = await callRuntime("collect-current-session");
    if (!collected?.sessionId) {
      showCollectPageRefreshTip("采集会话");
      return;
    }
    state.selectedSessionIds.add(collected.sessionId);
    await refresh();
    setStatus("采集成功。");
  } catch (error) {
    setStatus(`采集失败：${error.message}`);
  }
});

node("refresh-sessions").addEventListener("click", async () => {
  try {
    const collected = await callRuntime("collect-current-session");
    const collectFailed = !collected?.sessionId;
    if (collectFailed) {
      showCollectPageRefreshTip("刷新会话");
    } else {
      state.selectedSessionIds.add(collected.sessionId);
    }

    const sessions = await callRuntime("list-sessions");
    state.sessions = sessions;
    renderSessions(sessions);
    if (collectFailed) {
      setStatus(`会话数量：${sessions.length}。当前页面采集失败，请刷新页面后重试。`);
      return;
    }
    setStatus(`会话数量：${sessions.length}`);
  } catch (error) {
    setStatus(`刷新失败：${error.message}`);
  }
});

node("manual-sync").addEventListener("click", async () => {
  const sessionIds = Array.from(state.selectedSessionIds);
  if (sessionIds.length === 0) {
    setStatus("请先选择至少一个会话。");
    return;
  }

  if (!await ensureGithubConfigForSync()) {
    return;
  }

  try {
    setStatus("正在执行手动同步...");
    const result = await callRuntime("manual-sync", {
      sessionIds,
      manualSelection: buildManualSelection()
    });
    setStatus(`手动同步完成：成功 ${result.synced}，跳过 ${result.skipped}，失败 ${result.failed}`);
    state.syncLogs = await callRuntime("get-sync-logs");
    renderSyncLogs(state.syncLogs);
  } catch (error) {
    const message = `手动同步失败：${error.message}`;
    window.alert(message);
    setStatus(message);
  }
});

node("run-auto-sync").addEventListener("click", async () => {
  if (!await ensureGithubConfigForSync()) {
    return;
  }

  try {
    setStatus("正在执行自动同步...");
    const result = await callRuntime("run-auto-sync");
    setStatus(`自动同步完成：成功 ${result.synced}，跳过 ${result.skipped}，失败 ${result.failed}`);
    state.syncLogs = await callRuntime("get-sync-logs");
    renderSyncLogs(state.syncLogs);
  } catch (error) {
    const message = `自动同步失败：${error.message}`;
    window.alert(message);
    setStatus(message);
  }
});

node("refresh-sync-logs").addEventListener("click", async () => {
  try {
    state.syncLogs = await callRuntime("get-sync-logs");
    renderSyncLogs(state.syncLogs);
    setStatus(`已刷新日志（${state.syncLogs.length} 条）`);
  } catch (error) {
    setStatus(`刷新日志失败：${error.message}`);
  }
});

node("clear-sync-logs").addEventListener("click", async () => {
  try {
    await callRuntime("clear-sync-logs");
    state.syncLogs = [];
    renderSyncLogs(state.syncLogs);
    setStatus("同步日志已清空。");
  } catch (error) {
    setStatus(`清空日志失败：${error.message}`);
  }
});

refresh().catch((error) => setStatus(`初始化失败：${error.message}`));
