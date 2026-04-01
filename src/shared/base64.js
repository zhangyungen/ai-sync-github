export function toBase64(text) {
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  return Buffer.from(text, "utf-8").toString("base64");
}

export function fromBase64(base64Text) {
  const normalized = `${base64Text || ""}`.replace(/\s+/g, "");
  if (!normalized) {
    return "";
  }

  if (typeof atob === "function") {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(normalized, "base64").toString("utf-8");
}
