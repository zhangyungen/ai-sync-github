import { DEFAULT_ROLE_TAG, ROLE_TAGS } from "../../constants/roles.js";

const DOMAIN_HINTS = [
  {
    keywords: ["market", "营销", "市场", "竞品", "调研", "增长"],
    roleHints: ["市场", "需求分析"],
    businessHints: ["市场", "调研", "增长"],
    directoryHints: ["market", "analysis", "research", "市场"]
  },
  {
    keywords: ["business", "业务", "流程", "泳道", "价值", "场景"],
    roleHints: ["业务", "架构"],
    businessHints: ["业务", "流程", "架构"],
    directoryHints: ["business", "domain", "process", "业务"]
  },
  {
    keywords: ["requirement", "需求", "prd", "产品", "原型", "交互"],
    roleHints: ["产品", "需求", "设计"],
    businessHints: ["需求", "产品", "设计"],
    directoryHints: ["product", "requirement", "prd", "需求"]
  },
  {
    keywords: ["architecture", "技术", "代码", "接口", "数据库", "性能", "部署"],
    roleHints: ["技术", "架构", "开发"],
    businessHints: ["技术", "架构", "实现"],
    directoryHints: ["architecture", "tech", "engineering", "技术"]
  }
];

function normalizeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values
    .map((item) => `${item || ""}`.trim())
    .filter(Boolean)));
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function scoreOption(option, fullText, hints) {
  const lowerOption = option.toLowerCase();
  let score = 0;
  if (fullText.includes(lowerOption)) {
    score += 4;
  }
  hints.forEach((hint) => {
    if (!hint) {
      return;
    }
    if (lowerOption.includes(hint)) {
      score += 3;
    }
    if (fullText.includes(hint) && lowerOption.includes(hint)) {
      score += 2;
    }
  });
  return score;
}

function pickTopOptions(options, fullText, hints, limit = 1) {
  if (!options.length) {
    return [];
  }

  const scored = options
    .map((option) => ({
      option,
      score: scoreOption(option, fullText, hints)
    }))
    .sort((left, right) => right.score - left.score || left.option.localeCompare(right.option));

  const positive = scored.filter((item) => item.score > 0);
  if (positive.length === 0) {
    return [];
  }
  return positive.slice(0, limit).map((item) => item.option);
}

function extractText(session) {
  return session.messages
    .flatMap((message) => message.parts.map((part) => part.text || ""))
    .join(" ")
    .toLowerCase();
}

export class KeywordAutoClassifier {
  async classify(session, options = {}) {
    const fullText = extractText(session);
    const matchedHints = DOMAIN_HINTS.filter((item) => includesAny(fullText, item.keywords));
    const roleHints = matchedHints.flatMap((item) => item.roleHints.map((hint) => hint.toLowerCase()));
    const businessHints = matchedHints.flatMap((item) => item.businessHints.map((hint) => hint.toLowerCase()));
    const directoryHints = matchedHints.flatMap((item) => item.directoryHints.map((hint) => hint.toLowerCase()));

    const roleOptions = normalizeList(options.roleOptions);
    const businessOptions = normalizeList(options.businessTagOptions);
    const directoryOptions = normalizeList(options.directoryOptions);

    const roles = pickTopOptions(roleOptions, fullText, roleHints, 1);
    const businessTags = pickTopOptions(businessOptions, fullText, businessHints, 2);
    const directories = pickTopOptions(directoryOptions, fullText, directoryHints, 1);
    const defaultDirectory = `${options.defaultDirectory || "general"}`.trim() || "general";
    const resolvedDirectory = directories[0] || defaultDirectory;

    const roleFallback = roleOptions[0] || ROLE_TAGS[3] || DEFAULT_ROLE_TAG;
    const confidence = Math.min(
      0.95,
      0.45
        + Math.min(matchedHints.length * 0.12, 0.36)
        + (roles.length > 0 ? 0.08 : 0)
        + (businessTags.length > 0 ? 0.06 : 0)
        + (directories.length > 0 ? 0.05 : 0)
    );

    const resolvedBusinessTags = businessTags.length > 0
      ? businessTags
      : (businessOptions[0] ? [businessOptions[0]] : []);

    return {
      roles: roles.length > 0 ? roles : [roleFallback],
      businessTags: resolvedBusinessTags,
      directories: [resolvedDirectory],
      directory: resolvedDirectory,
      confidence
    };
  }
}
