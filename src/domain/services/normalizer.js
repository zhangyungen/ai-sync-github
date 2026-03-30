import { CONTENT_TYPE } from "../../constants/sync.js";
import { nowIso } from "../../shared/time.js";

function normalizePart(rawPart) {
  if (!rawPart || typeof rawPart !== "object") {
    return null;
  }

  const type = `${rawPart.type || CONTENT_TYPE.TEXT}`.toLowerCase();
  const normalizedType = Object.values(CONTENT_TYPE).includes(type)
    ? type
    : CONTENT_TYPE.TEXT;

  return {
    type: normalizedType,
    text: rawPart.text ? `${rawPart.text}` : "",
    url: rawPart.url ? `${rawPart.url}` : "",
    language: rawPart.language ? `${rawPart.language}` : "",
    name: rawPart.name ? `${rawPart.name}` : ""
  };
}

function normalizeMessage(rawMessage, index) {
  const messageId = rawMessage?.id ? `${rawMessage.id}` : `message-${index + 1}`;
  const role = rawMessage?.role ? `${rawMessage.role}` : "unknown";
  const createdAt = rawMessage?.createdAt ? `${rawMessage.createdAt}` : nowIso();
  const sourceParts = Array.isArray(rawMessage?.parts) ? rawMessage.parts : [];

  let parts = sourceParts
    .map((part) => normalizePart(part))
    .filter(Boolean);

  if (parts.length === 0) {
    const text = rawMessage?.content ? `${rawMessage.content}` : "";
    parts = [{ type: CONTENT_TYPE.TEXT, text, url: "", language: "", name: "" }];
  }

  return {
    id: messageId,
    role,
    createdAt,
    parts
  };
}

export function normalizeSession(rawSession) {
  const messages = Array.isArray(rawSession?.messages)
    ? rawSession.messages.map((message, index) => normalizeMessage(message, index))
    : [];

  return {
    sessionId: rawSession?.sessionId ? `${rawSession.sessionId}` : `session-${Date.now()}`,
    title: rawSession?.title ? `${rawSession.title}` : "Untitled Session",
    sourceUrl: rawSession?.sourceUrl ? `${rawSession.sourceUrl}` : "",
    capturedAt: rawSession?.capturedAt ? `${rawSession.capturedAt}` : nowIso(),
    messages
  };
}

export function getLastMessageId(normalizedSession) {
  const messages = normalizedSession?.messages || [];
  if (messages.length === 0) {
    return "";
  }
  return messages[messages.length - 1].id;
}
