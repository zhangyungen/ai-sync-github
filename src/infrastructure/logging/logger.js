const TOKEN_KEYS = ["token", "authorization", "auth", "secret"];

function maskSensitive(input) {
  if (!input || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => maskSensitive(item));
  }

  const output = {};
  Object.entries(input).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (TOKEN_KEYS.some((needle) => lowerKey.includes(needle))) {
      output[key] = "***";
      return;
    }
    output[key] = maskSensitive(value);
  });
  return output;
}

export class Logger {
  constructor(scope = "ChatSync") {
    this.scope = scope;
  }

  info(message, context = undefined) {
    console.info(`[${this.scope}] ${message}`, maskSensitive(context));
  }

  warn(message, context = undefined) {
    console.warn(`[${this.scope}] ${message}`, maskSensitive(context));
  }

  error(message, context = undefined) {
    console.error(`[${this.scope}] ${message}`, maskSensitive(context));
  }
}
