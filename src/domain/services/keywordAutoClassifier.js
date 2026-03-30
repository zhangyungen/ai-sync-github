import { ROLE_TAGS } from "../../constants/roles.js";

const KEYWORD_RULES = [
  { keyword: "market", role: ROLE_TAGS[0], businessTag: "市场调研" },
  { keyword: "business", role: ROLE_TAGS[1], businessTag: "业务分析" },
  { keyword: "requirement", role: ROLE_TAGS[2], businessTag: "需求设计" },
  { keyword: "architecture", role: ROLE_TAGS[3], businessTag: "技术设计" }
];

export class KeywordAutoClassifier {
  async classify(session) {
    const fullText = session.messages
      .flatMap((message) => message.parts.map((part) => part.text || ""))
      .join(" ")
      .toLowerCase();

    const matches = KEYWORD_RULES.filter((rule) => fullText.includes(rule.keyword));
    if (matches.length === 0) {
      return {
        roles: [ROLE_TAGS[3]],
        businessTags: [],
        directory: "general",
        confidence: 0.2
      };
    }

    const first = matches[0];
    return {
      roles: [first.role],
      businessTags: [first.businessTag],
      directory: "auto",
      confidence: 0.85
    };
  }
}
