function parseLanguageFromClassName(className) {
  if (!className) {
    return "";
  }
  const match = className.match(/language-([\w-]+)/i);
  return match ? match[1] : "";
}

function extractParts(messageNode) {
  const parts = [];

  messageNode.querySelectorAll("pre code").forEach((node) => {
    parts.push({
      type: "code",
      text: node.textContent || "",
      language: parseLanguageFromClassName(node.className),
      url: "",
      name: ""
    });
  });

  messageNode.querySelectorAll("a[href]").forEach((node) => {
    parts.push({
      type: "link",
      text: node.textContent || "",
      url: node.href || "",
      language: "",
      name: node.textContent || ""
    });
  });

  messageNode.querySelectorAll("img[src]").forEach((node) => {
    parts.push({
      type: "image_ref",
      text: node.alt || "",
      url: node.src || "",
      language: "",
      name: node.alt || "image"
    });
  });

  if (parts.length === 0) {
    const text = messageNode.textContent || "";
    parts.push({
      type: "text",
      text,
      url: "",
      language: "",
      name: ""
    });
  }

  return parts;
}

function collectMessages() {
  const nodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
  if (nodes.length === 0) {
    return [];
  }

  return nodes.map((node, index) => {
    const role = node.getAttribute("data-message-author-role") || "unknown";
    const id = node.getAttribute("data-message-id") || `m-${index + 1}`;
    return {
      id,
      role,
      createdAt: new Date().toISOString(),
      parts: extractParts(node)
    };
  });
}

function getSessionId() {
  const match = window.location.pathname.match(/\/c\/([^/?#]+)/);
  if (match) {
    return match[1];
  }
  return `session-${Date.now()}`;
}

function collectSnapshot() {
  return {
    sessionId: getSessionId(),
    title: document.title || "Untitled Session",
    sourceUrl: window.location.href,
    capturedAt: new Date().toISOString(),
    messages: collectMessages()
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "collect-session-snapshot") {
    return false;
  }
  sendResponse(collectSnapshot());
  return true;
});
