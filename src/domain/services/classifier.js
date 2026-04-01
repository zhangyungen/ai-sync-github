import { DEFAULT_ROLE_TAG } from "../../constants/roles.js";

function normalizeTags(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values
    .map((value) => `${value || ""}`.trim())
    .filter(Boolean)));
}

function normalizeDirectory(value, fallback = "general") {
  const text = `${value || ""}`.trim();
  return text || fallback;
}

function normalizeRoleOptions(values) {
  const normalized = normalizeTags(values);
  return normalized.length > 0 ? normalized : [DEFAULT_ROLE_TAG];
}

function normalizeClassification(input, options = {}) {
  const roleOptions = normalizeRoleOptions(options.roleOptions);
  const defaultDirectory = normalizeDirectory(options.defaultDirectory, "general");
  const fallbackRole = !!options.fallbackRole;
  const roles = normalizeTags(input?.roles);
  const businessTags = normalizeTags(input?.businessTags);
  const directories = normalizeTags(input?.directories);

  if (directories.length === 0 && `${input?.directory || ""}`.trim()) {
    directories.push(normalizeDirectory(input.directory, defaultDirectory));
  }

  const resolvedDirectories = directories.length > 0 ? directories : [defaultDirectory];
  const resolvedRoles = roles.length > 0
    ? roles
    : (fallbackRole ? [roleOptions[0] || DEFAULT_ROLE_TAG] : []);

  return {
    roles: resolvedRoles,
    businessTags,
    directories: resolvedDirectories,
    directory: resolvedDirectories[0]
  };
}

function hasAnyTag(classification) {
  return (
    classification.roles.length > 0
    || classification.businessTags.length > 0
    || classification.directories.length > 0
  );
}

export class ManualFirstClassifier {
  constructor(autoClassifier = null) {
    this.autoClassifier = autoClassifier;
  }

  async resolve(input) {
    const options = {
      roleOptions: input?.roleOptions,
      defaultDirectory: input?.defaultDirectory,
      fallbackRole: true
    };
    const manualClassification = normalizeClassification(input?.manualSelection, options);

    if (input?.mode === "manual") {
      return {
        classification: manualClassification,
        source: "manual",
        requiresManual: false
      };
    }

    if (this.autoClassifier && input?.autoEnabled) {
      const prediction = await this.autoClassifier.classify(input?.session, {
        roleOptions: input?.roleOptions,
        businessTagOptions: input?.businessTagOptions,
        directoryOptions: input?.directoryOptions,
        defaultDirectory: input?.defaultDirectory
      });
      const confidence = Number(prediction?.confidence || 0);
      const threshold = Number(input?.autoThreshold || 0.8);
      const predicted = normalizeClassification(prediction, options);

      if (confidence >= threshold || input?.mode === "auto") {
        return {
          classification: predicted,
          source: confidence >= threshold ? "auto" : "auto_fallback",
          requiresManual: false
        };
      }
    }

    const stored = normalizeClassification(
      input?.storedSelection,
      {
        ...options,
        fallbackRole: false
      }
    );
    if (hasAnyTag(stored)) {
      return {
        classification: stored,
        source: "stored",
        requiresManual: false
      };
    }

    if (input?.mode === "auto") {
      return {
        classification: normalizeClassification(null, options),
        source: "default",
        requiresManual: false
      };
    }

    return {
      classification: null,
      source: "none",
      requiresManual: true
    };
  }
}
