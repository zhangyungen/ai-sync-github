import { joinPath, sanitizePathSegment } from "../../shared/path.js";
import { toDateKey } from "../../shared/time.js";

function buildCodeFence(text) {
  const matches = `${text || ""}`.match(/`+/g) || [];
  const longest = matches.reduce((max, item) => Math.max(max, item.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

function normalizeCodeLanguage(language) {
  const normalized = `${language || ""}`.trim().toLowerCase();
  if (!normalized) {
    return "text";
  }
  return /^[\w+-]+$/.test(normalized) ? normalized : "text";
}

function renderPart(part) {
  switch (part.type) {
    case "code": {
      const code = part.text || "";
      const fence = buildCodeFence(code);
      const language = normalizeCodeLanguage(part.language);
      return `\n${fence}${language}\n${code}\n${fence}\n`;
    }
    case "markdown":
      return `\n${part.text || ""}\n`;
    case "link":
      return `\n[${part.name || part.url || "Link"}](${part.url || "#"})\n`;
    case "image_ref":
      return `\n![${part.name || "image"}](${part.url || ""})\n`;
    case "attachment_ref":
      return `\nAttachment: [${part.name || part.url || "file"}](${part.url || ""})\n`;
    case "text":
    default:
      return `\n${part.text || ""}\n`;
  }
}

function renderTimelineMarkdown(session) {
  const lines = [
    `# ${session.title}`,
    "",
    `- Session ID: \`${session.sessionId}\``,
    `- Source URL: ${session.sourceUrl || "N/A"}`,
    `- Captured At: ${session.capturedAt}`,
    ""
  ];

  session.messages.forEach((message, index) => {
    lines.push(`## ${index + 1}. ${message.role}`);
    lines.push(`- Message ID: \`${message.id}\``);
    lines.push(`- Created At: ${message.createdAt}`);
    lines.push("");
    message.parts.forEach((part) => {
      lines.push(renderPart(part));
    });
    lines.push("");
  });

  return lines.join("\n");
}

function buildCategorizedPaths(rootPath, classification, sessionId) {
  const safeSessionId = sanitizePathSegment(sessionId);
  const rolePaths = classification.roles.map((role) =>
    joinPath(
      rootPath,
      "categorized",
      "roles",
      sanitizePathSegment(role),
      `${safeSessionId}.md`
    )
  );

  const businessTags = classification.businessTags.length > 0
    ? classification.businessTags
    : ["unclassified"];

  const businessPaths = businessTags.map((tag) =>
    joinPath(
      rootPath,
      "categorized",
      "business",
      sanitizePathSegment(tag),
      `${safeSessionId}.md`
    )
  );

  const directoryValues = Array.isArray(classification.directories) && classification.directories.length > 0
    ? classification.directories
    : [classification.directory];
  const directoryPaths = Array.from(new Set(directoryValues
    .map((value) => `${value || ""}`.trim())
    .filter(Boolean)))
    .map((value) => joinPath(
      rootPath,
      "categorized",
      "directory",
      sanitizePathSegment(value),
      `${safeSessionId}.md`
    ));

  return [...rolePaths, ...businessPaths, ...directoryPaths];
}

export function renderSyncArtifacts(input) {
  const session = input.session;
  const rootPath = input.rootPath || "sync-data";
  const syncedAt = input.syncedAt;
  const dateKey = toDateKey(syncedAt);
  const safeSessionId = sanitizePathSegment(session.sessionId);
  const timelineMarkdown = renderTimelineMarkdown(session);
  const classifiedPaths = buildCategorizedPaths(
    rootPath,
    input.classification,
    safeSessionId
  );

  const files = [
    {
      path: joinPath(rootPath, "raw", dateKey, `${safeSessionId}.json`),
      content: JSON.stringify(session, null, 2)
    },
    {
      path: joinPath(rootPath, "timeline", dateKey, `${safeSessionId}.md`),
      content: timelineMarkdown
    },
    ...classifiedPaths.map((path) => ({ path, content: timelineMarkdown }))
  ];

  return {
    files,
    record: {
      sessionId: session.sessionId,
      title: session.title,
      syncedAt,
      dateKey,
      classification: input.classification,
      paths: files.map((file) => file.path),
      lastMessageId: session.messages.length > 0 ? session.messages[session.messages.length - 1].id : ""
    }
  };
}
