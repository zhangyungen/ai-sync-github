import { DEDUPE_WINDOW_MS } from "../../constants/sync.js";

export class DedupeWindow {
  constructor(windowMs = DEDUPE_WINDOW_MS, nowFn = Date.now) {
    this.windowMs = windowMs;
    this.nowFn = nowFn;
  }

  prune(entriesMap) {
    const output = {};
    const now = this.nowFn();

    Object.entries(entriesMap || {}).forEach(([fingerprint, timestamp]) => {
      const value = Number(timestamp);
      if (Number.isFinite(value) && now - value <= this.windowMs) {
        output[fingerprint] = value;
      }
    });

    return output;
  }

  isDuplicate(entriesMap, fingerprint) {
    const pruned = this.prune(entriesMap);
    return Object.prototype.hasOwnProperty.call(pruned, fingerprint);
  }

  mark(entriesMap, fingerprint) {
    const pruned = this.prune(entriesMap);
    pruned[fingerprint] = this.nowFn();
    return pruned;
  }
}
