import { joinPath } from "../../shared/path.js";

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const a = new Date(left.syncedAt).getTime();
    const b = new Date(right.syncedAt).getTime();
    return b - a;
  });
}

function buildReadme(records, rootPath) {
  const lines = [
    "# Chat Sync Index",
    "",
    "该目录由扩展自动维护，包含原始会话、时间线和分类输出。",
    "",
    "| Synced At | Session | Last Message | Paths |",
    "| --- | --- | --- | --- |"
  ];

  sortRecords(records).forEach((record) => {
    const timelinePath = record.paths.find((path) => path.includes("/timeline/")) || "";
    const link = timelinePath ? `[View](/${timelinePath})` : "-";
    lines.push(
      `| ${record.syncedAt} | ${record.title} | \`${record.lastMessageId || "-"}\` | ${link} |`
    );
  });

  lines.push("");
  lines.push(`Root: \`${rootPath}\``);
  lines.push("");

  return lines.join("\n");
}

export function buildIndexArtifacts(records, rootPath = "sync-data") {
  const readmePath = joinPath(rootPath, "indexes", "README.md");
  const jsonPath = joinPath(rootPath, "indexes", "index.json");

  return [
    { path: readmePath, content: buildReadme(records, rootPath) },
    { path: jsonPath, content: JSON.stringify(sortRecords(records), null, 2) }
  ];
}
