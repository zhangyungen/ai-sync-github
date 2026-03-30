export function stableHash(input) {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return (`0000000${(hash >>> 0).toString(16)}`).slice(-8);
}
