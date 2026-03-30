import { AUTO_SYNC_ALARM_NAME } from "../../constants/sync.js";
import { getRuntime } from "./runtime.js";

const runtime = getRuntime(chrome);
const { syncService, logger, stateRepository, alerter } = runtime;

async function collectSessionFromTab(tabId) {
  if (!tabId) {
    return null;
  }

  try {
    const snapshot = await chrome.tabs.sendMessage(tabId, {
      type: "collect-session-snapshot"
    });
    if (!snapshot || !snapshot.sessionId) {
      return null;
    }
    return syncService.collectSession(snapshot);
  } catch (error) {
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
    url: ["https://chat.openai.com/*", "https://chatgpt.com/*"]
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

async function scheduleAutoSyncByConfig() {
  const config = await syncService.getConfig();
  await chrome.alarms.clear(AUTO_SYNC_ALARM_NAME);

  if (!config.autoSync.enabled) {
    return;
  }

  await chrome.alarms.create(AUTO_SYNC_ALARM_NAME, {
    delayInMinutes: config.autoSync.intervalMinutes,
    periodInMinutes: config.autoSync.intervalMinutes
  });
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
      await scheduleAutoSyncByConfig();
      return updated;
    }
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
  await scheduleAutoSyncByConfig();
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduleAutoSyncByConfig();
});
