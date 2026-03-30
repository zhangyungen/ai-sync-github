import { DEFAULT_ROLE_TAG, ROLE_TAGS } from "../../constants/roles.js";

function normalizeTags(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => `${value || ""}`.trim())
    .filter(Boolean);
}

function normalizeDirectory(value, fallback = "general") {
  const text = `${value || ""}`.trim();
  return text || fallback;
}

function normalizeClassification(input, defaultDirectory, fallbackRole = false) {
  const roles = normalizeTags(input?.roles);
  const businessTags = normalizeTags(input?.businessTags);

  return {
    roles: roles.length > 0 ? roles : (fallbackRole ? [DEFAULT_ROLE_TAG] : []),
    businessTags,
    directory: normalizeDirectory(input?.directory, defaultDirectory)
  };
}

function keepSupportedRoles(roles) {
  const output = roles.filter((role) => ROLE_TAGS.includes(role));
  return output.length > 0 ? output : [DEFAULT_ROLE_TAG];
}

export class ManualFirstClassifier {
  constructor(autoClassifier = null) {
    this.autoClassifier = autoClassifier;
  }

  async resolve(input) {
    const manualClassification = normalizeClassification(
      input?.manualSelection,
      input?.defaultDirectory,
      true
    );

    if (input?.mode === "manual") {
      return {
        classification: {
          ...manualClassification,
          roles: keepSupportedRoles(manualClassification.roles)
        },
        source: "manual",
        requiresManual: false
      };
    }

    const stored = normalizeClassification(
      input?.storedSelection,
      input?.defaultDirectory,
      false
    );
    if (stored.roles.length > 0 || stored.businessTags.length > 0) {
      return {
        classification: {
          ...stored,
          roles: keepSupportedRoles(stored.roles)
        },
        source: "stored",
        requiresManual: false
      };
    }

    if (this.autoClassifier && input?.autoEnabled) {
      const prediction = await this.autoClassifier.classify(input?.session);
      const confidence = Number(prediction?.confidence || 0);
      const threshold = Number(input?.autoThreshold || 0.8);

      if (confidence >= threshold) {
        const predicted = normalizeClassification(prediction, input?.defaultDirectory, true);
        return {
          classification: {
            ...predicted,
            roles: keepSupportedRoles(predicted.roles)
          },
          source: "auto",
          requiresManual: false
        };
      }
    }

    return {
      classification: null,
      source: "none",
      requiresManual: true
    };
  }
}
