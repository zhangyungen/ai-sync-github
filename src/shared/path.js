const INVALID_SEGMENT_PATTERN = /[^\w\u4e00-\u9fa5\-().]/g;

export function sanitizePathSegment(segment) {
  const value = `${segment || "unknown"}`.trim();
  return value.replace(INVALID_SEGMENT_PATTERN, "_");
}

export function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => `${part}`.replace(/^\/+|\/+$/g, ""))
    .join("/");
}
