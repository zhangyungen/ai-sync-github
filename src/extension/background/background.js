import { AUTO_SYNC_ALARM_NAME } from "../../constants/sync.js";
import { buildAuthHeader } from "../../infrastructure/github/authStrategies.js";
import { normalizeBranchName, normalizeOwnerRepo } from "../../infrastructure/github/configNormalizer.js";
import { getRuntime } from "./runtime.js";

const runtime = getRuntime(chrome);
const { syncService, logger, stateRepository, alerter } = runtime;

function parseProxyPort(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    return null;
  }
  return number;
}

function parseApiErrorMessage(body, fallback) {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.message) {
      return parsed.message;
    }
  } catch {}
  return fallback;
}

async function validateGithubAccess(githubConfig) {
  const { owner, repo } = normalizeOwnerRepo(githubConfig);
  const branch = normalizeBranchName(githubConfig?.branch);
  const authHeader = buildAuthHeader({
    ...githubConfig,
    owner,
    repo
  });

  const headers = {
    Authorization: authHeader,
    Accept: "application/vnd.github+json"
  };

  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "GET",
    headers
  });
  if (!repoResponse.ok) {
    const body = await repoResponse.text();
    if (repoResponse.status === 404) {
      throw new Error("仓库不存在或当前 Token 无该仓库访问权限。");
    }
    throw new Error(`校验仓库访问失败：${repoResponse.status} ${parseApiErrorMessage(body, "Unknown error")}`);
  }

  const repoPayload = await repoResponse.json();
  if (repoPayload?.permissions?.push === false) {
    throw new Error("当前 Token 对该仓库无写权限（push=false）。");
  }

  const probeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/.ai2git-permission-check?ref=${encodeURIComponent(branch)}`,
    {
      method: "GET",
      headers
    }
  );
  if (probeResponse.status === 200 || probeResponse.status === 404) {
    if (probeResponse.status === 404) {
      const body = await probeResponse.text();
      const reason = parseApiErrorMessage(body, "");
      if (reason.includes("No commit found for the ref")) {
        throw new Error(`分支 ${branch} 不存在。请先创建分支，或在同步时由系统自动创建（需要 refs 权限）。`);
      }
    }
    return {
      ok: true,
      message: `GitHub 权限校验通过：${owner}/${repo}@${branch}`
    };
  }

  const body = await probeResponse.text();
  if (
    probeResponse.status === 403
    && parseApiErrorMessage(body, "").includes("Resource not accessible by personal access token")
  ) {
    throw new Error("当前 Token 未授予该仓库 Contents 读写权限，或未完成组织 SSO 授权。");
  }

  throw new Error(`校验仓库内容权限失败：${probeResponse.status} ${parseApiErrorMessage(body, "Unknown error")}`);
}

function buildProxyRule(config) {
  const host = `${config?.network?.proxyServer || ""}`.trim();
  const port = parseProxyPort(config?.network?.proxyPort);
  if (!host || !port) {
    return null;
  }
  return { host, port };
}

function setProxySettings(details) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set(details, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function clearProxySettings(details) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear(details, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function applyProxyByConfig(config) {
  if (!chrome.proxy?.settings) {
    return;
  }

  const proxyRule = buildProxyRule(config);
  if (!proxyRule) {
    await clearProxySettings({ scope: "regular" });
    return;
  }

  await setProxySettings({
    scope: "regular",
    value: {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: proxyRule.host,
          port: proxyRule.port
        },
        bypassList: ["<local>"]
      }
    }
  });
}

async function collectSessionFromTab(tabId) {
  if (!tabId) {
    return null;
  }

  async function requestSnapshot() {
    return chrome.tabs.sendMessage(tabId, {
      type: "collect-session-snapshot"
    });
  }

  try {
    const snapshot = await requestSnapshot();
    if (!snapshot || !snapshot.sessionId) {
      return null;
    }
    const messageCount = Array.isArray(snapshot.messages) ? snapshot.messages.length : 0;
    if (messageCount === 0) {
      logger.warn("Collected snapshot has no messages, skip persisting", {
        tabId,
        sessionId: snapshot.sessionId
      });
      return null;
    }
    return syncService.collectSession(snapshot);
  } catch (error) {
    const message = `${error?.message || ""}`;
    const canRetryByInject = message.includes("Receiving end does not exist")
      || message.includes("Could not establish connection");

    if (canRetryByInject) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const urlText = `${tab?.url || ""}`;
        const isSupportedChatTab = /^https:\/\/(chat\.openai\.com|chatgpt\.com|chat\.deepseek\.com|www\.qianwen\.com)\//.test(urlText);
        if (isSupportedChatTab) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["src/extension/content/collector.js"]
          });
          const retried = await requestSnapshot();
          const retriedCount = Array.isArray(retried?.messages) ? retried.messages.length : 0;
          if (retried && retried.sessionId && retriedCount > 0) {
            logger.info("Collected session after collector reinjection", { tabId, url: urlText });
            return syncService.collectSession(retried);
          }
          logger.warn("Collector reinjection retry still got empty snapshot", {
            tabId,
            sessionId: retried?.sessionId || "",
            messageCount: retriedCount
          });
        }
      } catch (retryError) {
        logger.warn("Collector reinjection failed", {
          tabId,
          message: retryError?.message || String(retryError)
        });
      }
    }

    logger.warn("Failed to collect session from tab", { tabId, message: error.message });
    return null;
  }
}

async function collectCurrentActiveSession() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length) {
    return null;
  }
  return collectSessionFromTab(tabs[0].id);
}

async function collectOpenChatSessions() {
  const tabs = await chrome.tabs.query({
    url: [
      "https://chat.openai.com/*",
      "https://chatgpt.com/*",
      "https://chat.deepseek.com/*",
      "https://www.qianwen.com/*"
    ]
  });

  const collected = [];
  for (const tab of tabs) {
    const snapshot = await collectSessionFromTab(tab.id);
    if (snapshot) {
      collected.push(snapshot);
    }
  }
  return collected;
}

async function scheduleAutoSyncByConfig(config) {
  const resolvedConfig = config || await syncService.getConfig();
  await chrome.alarms.clear(AUTO_SYNC_ALARM_NAME);

  if (!resolvedConfig.autoSync.enabled) {
    return;
  }

  await chrome.alarms.create(AUTO_SYNC_ALARM_NAME, {
    delayInMinutes: resolvedConfig.autoSync.intervalMinutes,
    periodInMinutes: resolvedConfig.autoSync.intervalMinutes
  });
}

async function applyBackgroundSettings(config) {
  const resolvedConfig = config || await syncService.getConfig();
  await scheduleAutoSyncByConfig(resolvedConfig);
  await applyProxyByConfig(resolvedConfig);
}

async function runAutoSyncFlow() {
  await collectOpenChatSessions();
  return syncService.runAutoSync();
}

async function handleMessage(message) {
  switch (message?.type) {
    case "get-config":
      return syncService.getConfig();
    case "save-config": {
      const updated = await syncService.updateConfig(message.patch || {});
      await applyBackgroundSettings(updated);
      return updated;
    }
    case "validate-github-access":
      return validateGithubAccess(message.github || {});
    case "collect-current-session":
      return collectCurrentActiveSession();
    case "list-sessions":
      return syncService.listSessions();
    case "manual-sync":
      return syncService.runManualSync({
        sessionIds: message.sessionIds || [],
        manualSelection: message.manualSelection || {}
      });
    case "run-auto-sync":
      return runAutoSyncFlow();
    case "set-auto-sync": {
      const updated = await syncService.updateConfig({
        autoSync: {
          enabled: !!message.enabled,
          intervalMinutes: message.intervalMinutes,
          minIntervalMinutes: message.minIntervalMinutes,
          maxIntervalMinutes: message.maxIntervalMinutes
        }
      });
      await scheduleAutoSyncByConfig();
      return updated;
    }
    case "get-last-sync-result":
      return stateRepository.getLastSyncResult();
    case "get-sync-logs":
      return stateRepository.getSyncLogs();
    case "clear-sync-logs":
      await stateRepository.clearSyncLogs();
      return [];
    default:
      return { ok: false, message: "Unsupported message type." };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch(async (error) => {
      logger.error("Runtime message failed", { message: error.message, type: message?.type });
      const config = await syncService.getConfig();
      await alerter.send(config.alerts.webhookUrl, {
        level: "error",
        code: "BACKGROUND_RUNTIME_ERROR",
        message: error.message,
        at: new Date().toISOString()
      });
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTO_SYNC_ALARM_NAME) {
    return;
  }

  try {
    await runAutoSyncFlow();
  } catch (error) {
    logger.error("Auto sync alarm failed", { message: error.message });
    const config = await syncService.getConfig();
    await alerter.send(config.alerts.webhookUrl, {
      level: "error",
      code: "AUTO_SYNC_ALARM_FAILED",
      message: error.message,
      at: new Date().toISOString()
    });
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await applyBackgroundSettings();
});

chrome.runtime.onStartup.addListener(async () => {
  await applyBackgroundSettings();
});
