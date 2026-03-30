async function callRuntime(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || `Runtime call failed: ${type}`);
  }
  return response.data;
}

function setStatus(text) {
  document.getElementById("status").textContent = text || "";
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

function fillForm(config) {
  document.getElementById("webhook-url").value = config.alerts.webhookUrl || "";
  document.getElementById("auto-classify-enabled").checked = !!config.classification.autoEnabled;
  document.getElementById("auto-threshold").value = config.classification.autoThreshold ?? 0.8;
  document.getElementById("default-directory").value = config.classification.defaultDirectory || "general";
  document.getElementById("publish-root-path").value = config.publish.rootPath || "sync-data";
}

function collectPatch() {
  return {
    alerts: {
      webhookUrl: document.getElementById("webhook-url").value.trim()
    },
    classification: {
      autoEnabled: document.getElementById("auto-classify-enabled").checked,
      autoThreshold: parseThreshold(document.getElementById("auto-threshold").value, 0.8),
      defaultDirectory: document.getElementById("default-directory").value.trim() || "general"
    },
    publish: {
      rootPath: document.getElementById("publish-root-path").value.trim() || "sync-data"
    }
  };
}

document.getElementById("save-options").addEventListener("click", async () => {
  try {
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
