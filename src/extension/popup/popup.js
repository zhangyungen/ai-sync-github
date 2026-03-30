const ROLE_TAGS = [
  "资深市场需求分析师",
  "资深业务架构师",
  "资深产品设计师（需求设计）",
  "资深技术架构师"
];

async function callRuntime(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || `Runtime call failed: ${type}`);
  }
  return response.data;
}

function setStatus(message) {
  const node = document.getElementById("status");
  node.textContent = message || "";
}

function parseNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function renderRoleCheckboxes() {
  const node = document.getElementById("role-list");
  node.innerHTML = "";
  ROLE_TAGS.forEach((role, index) => {
    const label = document.createElement("label");
    label.className = "inline";
    label.innerHTML = `<input type="checkbox" class="role-checkbox" value="${role}" ${index === 3 ? "checked" : ""} /> ${role}`;
    node.appendChild(label);
  });
}

function renderSessions(sessions) {
  const listNode = document.getElementById("session-list");
  listNode.innerHTML = "";

  if (!sessions || sessions.length === 0) {
    listNode.textContent = "暂无会话，请先在 ChatGPT 页面点击“采集当前会话”。";
    return;
  }

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item";
    item.innerHTML = `
      <label class="inline">
        <input class="session-checkbox" type="checkbox" value="${session.sessionId}" />
        <span class="session-title">${session.title}</span>
      </label>
      <div class="session-meta">${session.sessionId}</div>
      <div class="session-meta">${getLatestPreview(session)}</div>
    `;
    listNode.appendChild(item);
  });
}

function getSelectedSessionIds() {
  return Array.from(document.querySelectorAll(".session-checkbox:checked"))
    .map((node) => node.value);
}

function getSelectedRoles() {
  const values = Array.from(document.querySelectorAll(".role-checkbox:checked"))
    .map((node) => node.value);
  return values.length > 0 ? values : [ROLE_TAGS[3]];
}

function loadConfig(config) {
  document.getElementById("github-owner").value = config.github.owner || "";
  document.getElementById("github-repo").value = config.github.repo || "";
  document.getElementById("github-branch").value = config.github.branch || "main";
  document.getElementById("github-auth-mode").value = config.github.authMode || "pat";
  document.getElementById("github-token").value = config.github.token || "";
  document.getElementById("auto-enabled").checked = !!config.autoSync.enabled;
  document.getElementById("auto-interval").value = config.autoSync.intervalMinutes ?? 15;
  document.getElementById("auto-min").value = config.autoSync.minIntervalMinutes ?? 5;
  document.getElementById("auto-max").value = config.autoSync.maxIntervalMinutes ?? 120;
  document.getElementById("manual-directory").value = config.classification.defaultDirectory || "general";
}

function buildConfigPatch() {
  return {
    github: {
      owner: document.getElementById("github-owner").value.trim(),
      repo: document.getElementById("github-repo").value.trim(),
      branch: document.getElementById("github-branch").value.trim() || "main",
      authMode: document.getElementById("github-auth-mode").value,
      token: document.getElementById("github-token").value.trim()
    },
    autoSync: {
      enabled: document.getElementById("auto-enabled").checked,
      intervalMinutes: parseNumber(document.getElementById("auto-interval").value, 15),
      minIntervalMinutes: parseNumber(document.getElementById("auto-min").value, 5),
      maxIntervalMinutes: parseNumber(document.getElementById("auto-max").value, 120)
    },
    classification: {
      defaultDirectory: document.getElementById("manual-directory").value.trim() || "general"
    }
  };
}

function buildManualSelection() {
  const businessTags = document.getElementById("manual-business-tags").value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    directory: document.getElementById("manual-directory").value.trim() || "general",
    roles: getSelectedRoles(),
    businessTags
  };
}

async function refresh() {
  const [config, sessions, lastResult] = await Promise.all([
    callRuntime("get-config"),
    callRuntime("list-sessions"),
    callRuntime("get-last-sync-result")
  ]);

  loadConfig(config);
  renderRoleCheckboxes();
  renderSessions(sessions);

  if (lastResult) {
    setStatus(`上次同步：成功 ${lastResult.synced ?? 0}，跳过 ${lastResult.skipped ?? 0}，失败 ${lastResult.failed ?? 0}`);
  } else {
    setStatus("");
  }
}

document.getElementById("collect-current").addEventListener("click", async () => {
  try {
    setStatus("正在采集当前会话...");
    await callRuntime("collect-current-session");
    await refresh();
    setStatus("采集成功。");
  } catch (error) {
    setStatus(`采集失败：${error.message}`);
  }
});

document.getElementById("refresh-sessions").addEventListener("click", async () => {
  try {
    const sessions = await callRuntime("list-sessions");
    renderSessions(sessions);
    setStatus(`会话数量：${sessions.length}`);
  } catch (error) {
    setStatus(`刷新失败：${error.message}`);
  }
});

document.getElementById("save-config").addEventListener("click", async () => {
  try {
    setStatus("正在保存配置...");
    await callRuntime("save-config", { patch: buildConfigPatch() });
    setStatus("配置已保存。");
  } catch (error) {
    setStatus(`保存失败：${error.message}`);
  }
});

document.getElementById("manual-sync").addEventListener("click", async () => {
  const sessionIds = getSelectedSessionIds();
  if (sessionIds.length === 0) {
    setStatus("请先选择至少一个会话。");
    return;
  }

  try {
    setStatus("正在执行手动同步...");
    const result = await callRuntime("manual-sync", {
      sessionIds,
      manualSelection: buildManualSelection()
    });
    setStatus(`手动同步完成：成功 ${result.synced}，跳过 ${result.skipped}，失败 ${result.failed}`);
  } catch (error) {
    setStatus(`手动同步失败：${error.message}`);
  }
});

document.getElementById("run-auto-sync").addEventListener("click", async () => {
  try {
    setStatus("正在执行自动同步...");
    const result = await callRuntime("run-auto-sync");
    setStatus(`自动同步完成：成功 ${result.synced}，跳过 ${result.skipped}，失败 ${result.failed}`);
  } catch (error) {
    setStatus(`自动同步失败：${error.message}`);
  }
});

refresh().catch((error) => setStatus(`初始化失败：${error.message}`));
