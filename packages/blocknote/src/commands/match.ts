import type { EditorCommand, CommandGroup } from "./registry.js";

const GROUP_ORDER: CommandGroup[] = [
  "basic",
  "headings",
  "lists",
  "tables",
  "media",
  "power",
  "collab",
  "document",
  "advanced"
];

export function groupRank(group: CommandGroup): number {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

export type CommandMatchOptions = {
  query: string;
  recentIds?: readonly string[];
};

/**
 * Lightweight fuzzy-ish scorer — no Fuse.js.
 * Weights: title > aliases > keywords > subtitle; boosts recent usage.
 */
export function scoreCommand(
  command: EditorCommand,
  options: CommandMatchOptions
): number {
  const q = options.query.trim().toLowerCase();
  const recentBoost = options.recentIds?.includes(command.id)
    ? 30 + Math.max(0, 10 - (options.recentIds?.indexOf(command.id) ?? 10))
    : 0;

  if (!q) {
    return 100 - groupRank(command.group) + recentBoost;
  }

  let score = 0;
  const title = command.title.toLowerCase();
  const subtitle = command.subtitle?.toLowerCase() ?? "";
  const aliases = (command.aliases ?? []).map((a) => a.toLowerCase());
  const keywords = (command.keywords ?? []).map((k) => k.toLowerCase());

  if (title === q) score += 300;
  else if (title.startsWith(q)) score += 180;
  else if (title.includes(q)) score += 100;

  for (const alias of aliases) {
    if (alias === q) score += 220;
    else if (alias.startsWith(q)) score += 140;
    else if (alias.includes(q)) score += 70;
  }

  for (const keyword of keywords) {
    if (keyword === q) score += 160;
    else if (keyword.startsWith(q)) score += 90;
    else if (keyword.includes(q)) score += 45;
  }

  if (subtitle.includes(q)) score += 35;

  // Multi-token AND-ish soft match
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    let hit = 0;
    for (const token of tokens) {
      if (
        title.includes(token) ||
        aliases.some((a) => a.includes(token)) ||
        keywords.some((k) => k.includes(token))
      ) {
        hit += 1;
      }
    }
    score += hit * 20;
  }

  score += recentBoost;
  score -= groupRank(command.group) * 0.5;
  return score;
}

export function filterAndRankCommands(
  commands: readonly EditorCommand[],
  options: CommandMatchOptions
): EditorCommand[] {
  const scored = commands
    .map((command) => ({ command, score: scoreCommand(command, options) }))
    .filter((item) => (options.query.trim() ? item.score > 0 : true));

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      groupRank(a.command.group) - groupRank(b.command.group) ||
      a.command.title.localeCompare(b.command.title)
  );
  return scored.map((item) => item.command);
}

const RECENT_KEY = "oe.command.recent";
const RECENT_MAX = 8;

export function loadRecentCommandIds(storage?: Storage | null): string[] {
  try {
    const raw = (storage ?? (typeof localStorage !== "undefined" ? localStorage : null))?.getItem(
      RECENT_KEY
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function rememberCommandId(
  id: string,
  storage?: Storage | null
): string[] {
  const store =
    storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  const next = [id, ...loadRecentCommandIds(store).filter((x) => x !== id)].slice(
    0,
    RECENT_MAX
  );
  try {
    store?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  return next;
}
