function parseLanguageFromClassName(className) {
  if (!className) {
    return "";
  }
  const match = className.match(/language-([\w-]+)/i);
  return match ? match[1] : "";
}

const DEBUG_PREFIX = "[AI2Git Collector]";

function debugLog(event, payload = {}) {
  const detail = {
    event,
    at: new Date().toISOString(),
    url: window.location.href,
    ...payload
  };
  window.__AI2GIT_COLLECTOR_DEBUG__ = detail;
  // eslint-disable-next-line no-console
  console.info(DEBUG_PREFIX, detail);
}

function normalizeToken(value) {
  return `${value || ""}`.trim().toLowerCase();
}

function normalizeText(text) {
  return `${text || ""}`
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function firstNonEmptyLine(text) {
  return `${text || ""}`
    .split("\n")
    .map((line) => normalizeText(line))
    .find(Boolean) || "";
}

function clipText(text, max = 60) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return "";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function cleanDocumentTitle(rawTitle) {
  let title = normalizeText(rawTitle || "");
  if (!title) {
    return "";
  }
  title = title
    .replace(/\s*[-|]\s*(ChatGPT|DeepSeek|通义千问|Qwen)\s*$/i, "")
    .replace(/\s*(ChatGPT|DeepSeek|通义千问|Qwen)\s*$/i, "")
    .trim();
  const lower = title.toLowerCase();
  const generic = new Set([
    "chatgpt",
    "deepseek",
    "qwen",
    "通义千问",
    "新对话",
    "untitled session"
  ]);
  const genericPatterns = [
    /通义千问官网/i,
    /最新模型体验/i,
    /^千问[-\s].*官网/i,
    /^qwen[-\s].*official/i
  ];
  if (!title || generic.has(lower) || genericPatterns.some((pattern) => pattern.test(title))) {
    return "";
  }
  return title;
}

function getSiteTitleSelectors(site) {
  if (site === "qianwen") {
    return [
      "[data-testid*='conversation-title']",
      "[class*='conversation'][class*='title']",
      "[class*='session'][class*='title']",
      "[class*='chat'][class*='title']",
      "main h1"
    ];
  }
  if (site === "deepseek") {
    return [
      "[data-testid*='conversation-title']",
      "[class*='conversation'][class*='title']",
      "[class*='chat'][class*='title']",
      "main h1"
    ];
  }
  return ["main h1"];
}

function getTitleFromPage(site) {
  const selectors = getSiteTitleSelectors(site);
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const text = cleanDocumentTitle(node?.textContent || "");
    if (text) {
      return text;
    }
  }
  return "";
}

function inferRole(node) {
  const directRole = normalizeToken(
    node.getAttribute("data-message-author-role")
    || node.getAttribute("data-role")
    || node.getAttribute("data-author-role")
    || node.getAttribute("data-sender-role")
  );
  if (directRole) {
    if (directRole.includes("assistant") || directRole.includes("bot") || directRole.includes("ai")) {
      return "assistant";
    }
    if (directRole.includes("user") || directRole.includes("human")) {
      return "user";
    }
    return directRole;
  }

  const hintText = normalizeToken(
    [
      node.className,
      node.id,
      node.getAttribute("aria-label"),
      node.getAttribute("data-testid")
    ].join(" ")
  );

  if (
    hintText.includes("assistant")
    || hintText.includes("answer")
    || hintText.includes("bot")
    || hintText.includes("ai")
    || hintText.includes("reply")
    || hintText.includes("qianwen")
    || hintText.includes("deepseek")
  ) {
    return "assistant";
  }
  if (
    hintText.includes("user")
    || hintText.includes("human")
    || hintText.includes("question")
    || hintText.includes("prompt")
  ) {
    return "user";
  }
  return "unknown";
}

function getSiteName() {
  const host = window.location.hostname.toLowerCase();
  if (host === "chatgpt.com" || host === "chat.openai.com") {
    return "chatgpt";
  }
  if (host === "chat.deepseek.com") {
    return "deepseek";
  }
  if (host === "www.qianwen.com") {
    return "qianwen";
  }
  return "generic";
}

function getMessageSelectorsBySite(site) {
  switch (site) {
    case "chatgpt":
      return ["[data-message-author-role]"];
    case "deepseek":
      return [
        "[data-role='user']",
        "[data-role='assistant']",
        "[data-message-id]",
        "[data-index]",
        "[data-testid*='message']",
        "[data-testid*='chat']",
        "[class*='message'][class*='user']",
        "[class*='message'][class*='assistant']",
        "[class*='bubble']",
        "[class*='msg']",
        "[class*='chat-message']",
        "main [class*='message']",
        "main [class*='content']",
        "main [class*='markdown']",
        "main article"
      ];
    case "qianwen":
      return [
        "[data-role='user']",
        "[data-role='assistant']",
        "[class*='question']",
        "[class*='answer']",
        "[class*='message'][class*='item']"
      ];
    default:
      return [
        "[data-message-author-role]",
        "[data-role='user']",
        "[data-role='assistant']",
        "[class*='message'][class*='user']",
        "[class*='message'][class*='assistant']"
      ];
  }
}

function collectFallbackNodesForDeepseek() {
  const containers = Array.from(document.querySelectorAll("main div, main section, main article"));
  const keywords = ["message", "assistant", "user", "chat", "markdown", "answer", "question"];
  const matched = containers.filter((node) => {
    const hint = normalizeToken(
      [
        node.className,
        node.id,
        node.getAttribute("data-testid"),
        node.getAttribute("role")
      ].join(" ")
    );
    if (keywords.some((keyword) => hint.includes(keyword))) {
      return true;
    }
    const textLength = normalizeText(node.innerText || node.textContent || "").length;
    return textLength > 10 && node.querySelectorAll("pre code, img[src], a[href]").length > 0;
  });
  return matched;
}

function collectStructuredTextBlocksForDeepseek() {
  const root = document.querySelector("main") || document.body;
  if (!root) {
    return [];
  }

  const candidates = Array.from(root.querySelectorAll("div, article, section")).filter((node) => {
    const text = normalizeText(node.innerText || node.textContent || "");
    if (text.length < 12 || text.length > 15000) {
      return false;
    }
    const hasStructuredContent = node.querySelector("p, li, pre, code, blockquote, table, a[href], img[src]");
    if (!hasStructuredContent) {
      return false;
    }
    const hint = normalizeToken(
      [
        node.className,
        node.id,
        node.getAttribute("data-testid"),
        node.getAttribute("role")
      ].join(" ")
    );
    return (
      hint.includes("message")
      || hint.includes("assistant")
      || hint.includes("user")
      || hint.includes("chat")
      || hint.includes("content")
      || hint.includes("markdown")
      || text.length > 120
    );
  });

  // Keep top-level blocks only to reduce nested duplicates.
  return candidates.filter((node) => !candidates.some((other) => other !== node && other.contains(node)));
}

function collectCandidateMessageNodes() {
  const site = getSiteName();
  const selectors = getMessageSelectorsBySite(site);
  debugLog("collect_candidate_nodes_start", { site, selectors });

  const matched = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const unique = [];
  const seen = new Set();

  matched.forEach((node) => {
    if (!(node instanceof Element)) {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    const textLength = normalizeText(node.innerText || node.textContent || "").length;
    if (textLength < 2 && node.querySelectorAll("pre code, img[src], a[href]").length === 0) {
      return;
    }
    unique.push(node);
  });

  debugLog("collect_candidate_nodes_done", {
    site,
    matchedCount: matched.length,
    uniqueCount: unique.length
  });

  if (site === "deepseek" && unique.length === 0) {
    const fallbackNodes = collectFallbackNodesForDeepseek();
    debugLog("collect_candidate_nodes_deepseek_fallback", {
      fallbackCount: fallbackNodes.length
    });
    if (fallbackNodes.length > 0) {
      return fallbackNodes;
    }

    const structuredBlocks = collectStructuredTextBlocksForDeepseek();
    debugLog("collect_candidate_nodes_deepseek_structured_blocks", {
      structuredBlockCount: structuredBlocks.length
    });
    return structuredBlocks;
  }

  return unique;
}

function extractTextPart(messageNode) {
  const clone = messageNode.cloneNode(true);
  clone.querySelectorAll("pre, code, img, svg, script, style, video, audio, source").forEach((node) => {
    node.remove();
  });
  const text = normalizeText(clone.innerText || clone.textContent || "");
  if (!text) {
    return null;
  }
  return {
    type: "text",
    text,
    url: "",
    language: "",
    name: ""
  };
}

function escapeInlineMarkdown(text) {
  return `${text || ""}`.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function renderElementToMarkdown(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return `${node.textContent || ""}`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tag = `${element.tagName || ""}`.toLowerCase();
  const children = Array.from(element.childNodes).map((child) => renderElementToMarkdown(child)).join("");
  const text = normalizeText(children);

  if (tag === "br") {
    return "\n";
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1)) || 1;
    return `\n${"#".repeat(level)} ${text}\n\n`;
  }

  if (tag === "p") {
    return `\n${text}\n\n`;
  }

  if (tag === "blockquote") {
    const lines = text.split("\n").map((line) => `> ${line}`).join("\n");
    return `\n${lines}\n\n`;
  }

  if (tag === "li") {
    return `- ${text}\n`;
  }

  if (tag === "ul" || tag === "ol") {
    return `\n${children}\n`;
  }

  if (tag === "pre") {
    const codeNode = element.querySelector("code");
    const codeText = codeNode?.textContent || element.textContent || "";
    const language = parseLanguageFromClassName(codeNode?.className || element.className) || "text";
    return `\n\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
  }

  if (tag === "code") {
    const inline = normalizeText(element.textContent || "");
    if (!inline) {
      return "";
    }
    return `\`${escapeInlineMarkdown(inline)}\``;
  }

  if (tag === "a") {
    const href = element.getAttribute("href") || "";
    const label = text || href || "link";
    return `[${label}](${href || "#"})`;
  }

  if (tag === "img") {
    const alt = element.getAttribute("alt") || "image";
    const src = element.getAttribute("src") || "";
    return `![${alt}](${src})`;
  }

  if (tag === "strong" || tag === "b") {
    return `**${text}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${text}*`;
  }

  if (tag === "hr") {
    return "\n---\n\n";
  }

  if (["div", "section", "article", "main"].includes(tag)) {
    return `${children}\n`;
  }

  return children;
}

function extractMarkdownPart(messageNode) {
  const markdown = normalizeText(renderElementToMarkdown(messageNode));
  if (!markdown) {
    return null;
  }
  return {
    type: "markdown",
    text: markdown,
    url: "",
    language: "",
    name: ""
  };
}

function extractParts(messageNode, site = "generic") {
  if (site === "deepseek" || site === "qianwen") {
    const markdownPart = extractMarkdownPart(messageNode);
    if (markdownPart) {
      return [markdownPart];
    }
  }

  const parts = [];
  const textPart = extractTextPart(messageNode);
  if (textPart) {
    parts.push(textPart);
  }

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
    const text = normalizeText(messageNode.textContent || "");
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
  const site = getSiteName();
  const nodes = collectCandidateMessageNodes();
  if (nodes.length === 0) {
    return [];
  }

  return nodes.map((node, index) => {
    const role = inferRole(node);
    const id = node.getAttribute("data-message-id")
      || node.getAttribute("data-message-id-v2")
      || node.getAttribute("data-id")
      || node.id
      || `m-${index + 1}`;
    return {
      id,
      role,
      createdAt: new Date().toISOString(),
      parts: extractParts(node, site)
    };
  });
}

function extractTextFromPart(part) {
  if (!part || typeof part !== "object") {
    return "";
  }
  const raw = normalizeText(part.text || "");
  if (!raw) {
    return "";
  }
  const first = firstNonEmptyLine(raw)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^>\s+/, "");
  return normalizeText(first || raw);
}

function getTitleFromMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const priority = list.find((item) => item.role === "user") || list[0];
  const parts = Array.isArray(priority?.parts) ? priority.parts : [];
  for (const part of parts) {
    const text = extractTextFromPart(part);
    if (text) {
      return clipText(text, 70);
    }
  }
  return "";
}

function resolveSessionTitle(site, messages, fallbackTitle, sessionId) {
  const fromPage = getTitleFromPage(site);
  if (fromPage) {
    return fromPage;
  }

  const fromMessages = getTitleFromMessages(messages);
  if (fromMessages) {
    return fromMessages;
  }

  const fromDocument = cleanDocumentTitle(fallbackTitle);
  if (fromDocument) {
    return fromDocument;
  }

  return `Session ${`${sessionId || ""}`.slice(0, 8) || "Untitled"}`;
}

function getSessionIdFromPath(pathname) {
  const rules = [
    { pattern: /\/a\/chat\/s\/([^/?#]+)/, source: "path" },
    { pattern: /\/chat\/s\/([^/?#]+)/, source: "path" },
    { pattern: /\/c\/([^/?#]+)/, source: "path" },
    { pattern: /\/chat\/([^/?#]+)/, source: "path" },
    { pattern: /\/conversation\/([^/?#]+)/, source: "path" },
    { pattern: /\/s\/([^/?#]+)/, source: "path" }
  ];
  const reserved = new Set(["s", "c", "chat", "conversation"]);
  for (const rule of rules) {
    const match = pathname.match(rule.pattern);
    const value = `${match?.[1] || ""}`.trim();
    if (!value) {
      continue;
    }
    if (reserved.has(value.toLowerCase())) {
      continue;
    }
    return {
      value,
      source: rule.source
    };
  }
  return null;
}

function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("sessionId")
    || params.get("conversationId")
    || params.get("conversation_id")
    || params.get("session_id")
    || params.get("chatId")
    || params.get("chat_id")
    || params.get("id");
  if (fromQuery) {
    return {
      value: fromQuery,
      source: "query"
    };
  }

  const fromPath = getSessionIdFromPath(window.location.pathname);
  if (fromPath?.value) {
    return fromPath;
  }

  const host = window.location.hostname.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  const path = window.location.pathname
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/[\/_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = path ? path.slice(0, 80) : `${Date.now()}`;
  return {
    value: `${host}-${suffix}`,
    source: "fallback"
  };
}

function collectSnapshot() {
  const site = getSiteName();
  debugLog("collect_snapshot_start", {
    title: document.title || "",
    site
  });

  const session = getSessionId();
  const messages = collectMessages();
  const resolvedTitle = resolveSessionTitle(site, messages, document.title || "", session.value);
  const roleStats = messages.reduce((acc, item) => {
    const role = item.role || "unknown";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const snapshot = {
    sessionId: session.value,
    title: resolvedTitle,
    sourceUrl: window.location.href,
    capturedAt: new Date().toISOString(),
    messages
  };

  debugLog("collect_snapshot_done", {
    site,
    sessionId: session.value,
    sessionIdSource: session.source,
    title: resolvedTitle,
    messageCount: messages.length,
    roleStats
  });

  return snapshot;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "collect-session-snapshot") {
    return false;
  }

  debugLog("collect_request_received", {
    messageType: message?.type
  });

  try {
    sendResponse(collectSnapshot());
  } catch (error) {
    debugLog("collect_snapshot_error", {
      error: error?.message || String(error)
    });
    sendResponse({
      sessionId: "",
      title: document.title || "Untitled Session",
      sourceUrl: window.location.href,
      capturedAt: new Date().toISOString(),
      messages: []
    });
  }
  return true;
});

debugLog("collector_ready", {
  site: getSiteName(),
  pathname: window.location.pathname
});
