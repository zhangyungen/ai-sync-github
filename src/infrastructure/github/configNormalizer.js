function trimSlashes(input) {
  return `${input || ""}`.trim().replace(/^\/+|\/+$/g, "");
}

function parseGitHubUrl(input) {
  const raw = `${input || ""}`.trim();
  if (!raw) {
    return null;
  }

  const sshLikeMatch = raw.match(/^git@(?:www\.)?github\.com:([^/]+)\/(.+?)$/i);
  if (sshLikeMatch) {
    return {
      owner: trimSlashes(sshLikeMatch[1]),
      repo: trimSlashes(sshLikeMatch[2]).replace(/\.git$/i, "")
    };
  }

  const normalized = raw.includes("://") ? raw : `https://${raw}`;

  try {
    const url = new URL(normalized);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    return {
      owner: trimSlashes(segments[0]),
      repo: trimSlashes(segments[1]).replace(/\.git$/i, "")
    };
  } catch {
    return null;
  }
}

export function normalizeOwnerRepo(config) {
  const ownerInput = `${config?.owner || ""}`.trim();
  const repoInput = `${config?.repo || ""}`.trim();

  const parsedFromRepo = parseGitHubUrl(repoInput);
  if (parsedFromRepo) {
    return parsedFromRepo;
  }

  const parsedFromOwner = parseGitHubUrl(ownerInput);
  if (parsedFromOwner) {
    return parsedFromOwner;
  }

  if (!ownerInput && repoInput.includes("/")) {
    const segments = repoInput.split("/").filter(Boolean);
    if (segments.length >= 2) {
      return {
        owner: trimSlashes(segments[0]),
        repo: trimSlashes(segments[1]).replace(/\.git$/i, "")
      };
    }
  }

  return {
    owner: trimSlashes(ownerInput),
    repo: trimSlashes(repoInput).replace(/\.git$/i, "")
  };
}

export function normalizeBranchName(branchInput) {
  const raw = `${branchInput || "main"}`.trim() || "main";
  if (raw.startsWith("refs/heads/")) {
    return raw.slice("refs/heads/".length);
  }
  if (raw.startsWith("heads/")) {
    return raw.slice("heads/".length);
  }
  return raw;
}
