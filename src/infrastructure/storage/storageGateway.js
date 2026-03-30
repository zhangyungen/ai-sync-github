function assertStorageArea(storageArea) {
  if (!storageArea || typeof storageArea.get !== "function" || typeof storageArea.set !== "function") {
    throw new Error("Storage area is not available.");
  }
}

export function createStorageGateway(storageArea) {
  assertStorageArea(storageArea);

  return {
    async get(keys) {
      return storageArea.get(keys);
    },
    async set(values) {
      await storageArea.set(values);
    }
  };
}

export function createInMemoryStorageGateway(seed = {}) {
  const state = { ...seed };
  return {
    async get(keys) {
      if (Array.isArray(keys)) {
        return keys.reduce((accumulator, key) => {
          accumulator[key] = state[key];
          return accumulator;
        }, {});
      }

      if (typeof keys === "string") {
        return { [keys]: state[keys] };
      }

      if (keys && typeof keys === "object") {
        const output = {};
        Object.keys(keys).forEach((key) => {
          output[key] = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : keys[key];
        });
        return output;
      }

      return { ...state };
    },
    async set(values) {
      Object.assign(state, values);
    },
    snapshot() {
      return { ...state };
    }
  };
}
