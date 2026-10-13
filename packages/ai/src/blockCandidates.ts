import type { EditorBlock, EditorDocument } from "@hello-ai-company/editor-core";
import { cloneJsonValue, parseEditorDocument, requireExactKeys, requireId, requireRecord, requireString, requireStringArray } from "./validation.js";

/** Inventory, not a grant of host editing authority. Includes optional and legacy types. */
export const KNOWN_AGENT_BLOCK_TYPES = [
  "paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote",
  "toggleListItem", "callout", "codeBlock", "divider", "oePageBreak", "status", "table",
  "databaseView", "oeColumns", "oeColumn", "oeHtmlWidget", "oeNotesDrawing",
  "oeLegacyNotesDrawing", "oeNotesSyncedBlock", "pageCard", "pageTransclusion", "childPage",
  "oeLegacyNotesPageLink", "image", "audio", "video", "file", "oeLegacyNotesAsset",
  "oeLegacyNotesLink", "mathBlock", "diagram", "oeUnknownBlock"
] as const;
export type KnownAgentBlockType = typeof KNOWN_AGENT_BLOCK_TYPES[number];
export type BlockCandidateOperation = "format" | "typed-edit";
export type BlockCandidateDurability = "durable" | "session" | "none";

type AdapterTarget =
  | { kind: "text"; blockType: "paragraph" | "heading" | "bulletListItem" | "numberedListItem" | "checkListItem" | "quote" | "toggleListItem" | "callout" }
  | { kind: "table"; blockType: "table" }
  | { kind: "database"; blockType: "databaseView" }
  | { kind: "columns"; blockType: "oeColumns" | "oeColumn" }
  | { kind: "media"; blockType: "image" | "audio" | "video" | "file" | "oeLegacyNotesAsset" }
  | { kind: "html"; blockType: "oeHtmlWidget" }
  | { kind: "drawing"; blockType: "oeNotesDrawing" | "oeLegacyNotesDrawing" }
  | { kind: "shared"; blockType: "oeNotesSyncedBlock" }
  | { kind: "reference"; blockType: "pageCard" | "pageTransclusion" | "childPage" | "oeLegacyNotesPageLink" }
  | { kind: "link"; blockType: "oeLegacyNotesLink" }
  | { kind: "code"; blockType: "codeBlock" }
  | { kind: "math"; blockType: "mathBlock" }
  | { kind: "diagram"; blockType: "diagram" }
  | { kind: "separator"; blockType: "divider" | "oePageBreak" }
  | { kind: "status"; blockType: "status" }
  | { kind: "extension"; blockType: string };

/** Host-authored declaration of a typed validator/writer path, never model output.
 * Even every gate being true only permits review. No binding is invoked here. */
export type BlockCandidateBinding = AdapterTarget & {
  id: string;
  sourceTypes: readonly string[];
  operations: readonly BlockCandidateOperation[];
  bound: boolean;
  proposalAuthorized: boolean;
  persistence: BlockCandidateDurability;
  undo: BlockCandidateDurability;
};
export type BlockCandidateAdapterKind = BlockCandidateBinding["kind"];
export type BlockCandidateSource = { blockId: string; sourceKey: string };
/** Produced by the host's typed adapter after examining the exact source. A matching
 * source key establishes source identity, NOT the correctness of a proposed edit. */
export type BlockCandidateEvidence = {
  blockType: string;
  kind: BlockCandidateAdapterKind;
  operation: BlockCandidateOperation;
  sources: readonly BlockCandidateSource[];
  /** Stable description of the effect, excluding generated IDs, prose and revisions. */
  effectKey: string;
  reason: string;
};
export type BlockCandidateSnapshot = {
  documentId: string;
  documentRevision: string;
  document: EditorDocument;
  /** An empty blockIds array explicitly means the entire document. */
  selection: { revision: string; blockIds: readonly string[] };
  capabilities: {
    revision: string;
    registeredBlockTypes: readonly string[];
    bindings?: readonly BlockCandidateBinding[];
  };
  evidence?: readonly BlockCandidateEvidence[];
};
export type BlockCandidateReason = { code: string; message: string };
export type BlockCandidateSuggestion = {
  key: string;
  semanticKey: string;
  blockType: string;
  blockIds: string[];
  operation: BlockCandidateOperation;
  score: number;
  reason: string;
  evidence: { origin: "literal-marker" | "typed-adapter"; sources: BlockCandidateSource[]; effectKey: string };
  /** There is deliberately no patch, writer, transport, approval or execution function. */
  execution: "denied";
};
export type BlockCandidateDiagnostic = {
  blockType: string;
  known: boolean;
  installed: boolean;
  bound: boolean;
  proposalAuthorized: boolean;
  persistence: BlockCandidateDurability;
  undo: BlockCandidateDurability;
  adapterKind: BlockCandidateAdapterKind | "opaque";
  status: "suggested" | "rejected" | "no-change";
  reasons: BlockCandidateReason[];
};
export type BlockCandidateResult = {
  key: string;
  suggestions: BlockCandidateSuggestion[];
  noChange: { recommended: boolean; reason: string };
  diagnostics: BlockCandidateDiagnostic[];
  rejected: { blockType: string; blockIds: string[]; reason: BlockCandidateReason }[];
  execution: "denied";
};
export type BlockCandidateOptions = {
  /** Defaults to three; at most five review choices, with no overlapping sources. */
  maxSuggestions?: number;
  minScore?: number;
  /** Host-local semantic dismissal history; never interpreted as authority. */
  dismissedSemanticKeys?: readonly string[];
};

const kinds: Record<KnownAgentBlockType, BlockCandidateAdapterKind | "opaque"> = {
  paragraph: "text", heading: "text", bulletListItem: "text", numberedListItem: "text",
  checkListItem: "text", quote: "text", toggleListItem: "text", callout: "text",
  codeBlock: "code", divider: "separator", oePageBreak: "separator", status: "status",
  table: "table", databaseView: "database", oeColumns: "columns", oeColumn: "columns",
  oeHtmlWidget: "html", oeNotesDrawing: "drawing", oeLegacyNotesDrawing: "drawing",
  oeNotesSyncedBlock: "shared", pageCard: "reference", pageTransclusion: "reference",
  childPage: "reference", oeLegacyNotesPageLink: "reference", image: "media", audio: "media",
  video: "media", file: "media", oeLegacyNotesAsset: "media", oeLegacyNotesLink: "link",
  mathBlock: "math", diagram: "diagram", oeUnknownBlock: "opaque"
};
const known = (type: string): type is KnownAgentBlockType => Object.hasOwn(kinds, type);
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const kindFor = (type: string): BlockCandidateAdapterKind | "opaque" => known(type) ? kinds[type] : "extension";
const reason = (code: string, message: string): BlockCandidateReason => ({ code, message });
function fail(message: string): never { throw new Error(`Block candidates: ${message}`); }
function canonical(value: unknown): string {
  if (typeof value === "number" && Object.is(value, -0)) return "-0";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
/** Exact, collision-free JSON identity, not a cryptographic digest. Contains source
 * content: keep private, do not put in URLs, logs, analytics or remote model prompts. */
export function blockCandidateSourceKey(block: EditorBlock): string {
  return sourceKey(parseEditorDocument({ schemaVersion: 1, blocks: [block] }).blocks[0]!);
}
function sourceKey(block: EditorBlock): string {
  const key = `block-source-v1:${canonical(block)}`;
  if (key.length > 65536) fail("source key exceeds 65536 characters; use a narrower typed source instead of truncating it");
  return key;
}
function snapshotKey(snapshot: BlockCandidateSnapshot): string {
  return `block-candidates-v1:${canonical({
    documentId: snapshot.documentId, documentRevision: snapshot.documentRevision,
    selection: { revision: snapshot.selection.revision, blockIds: [...snapshot.selection.blockIds].sort() },
    capabilityRevision: snapshot.capabilities.revision
  })}`;
}
/** Host must advance these revisions whenever body, selection or bindings change.
 * This is a freshness token, not an authorization token or an apply-time CAS check. */
export function blockCandidateSnapshotKey(snapshot: BlockCandidateSnapshot): string {
  return snapshotKey(parseSnapshot(snapshot));
}
function strings(value: unknown, label: string, limit: number): string[] {
  const list = requireStringArray(value, label, limit);
  if (new Set(list).size !== list.length) fail(`duplicate ${label}`);
  return list;
}
function parseSnapshot(input: BlockCandidateSnapshot): BlockCandidateSnapshot {
  const value = requireRecord(cloneJsonValue(input, "candidate snapshot"), "candidate snapshot");
  requireExactKeys(value, ["documentId", "documentRevision", "document", "selection", "capabilities", "evidence"], "candidate snapshot");
  requireId(value.documentId, "document ID"); requireString(value.documentRevision, "document revision", 256);
  value.document = parseEditorDocument(value.document);
  const selection = requireRecord(value.selection, "selection");
  requireExactKeys(selection, ["revision", "blockIds"], "selection"); requireString(selection.revision, "selection revision", 256);
  selection.blockIds = strings(selection.blockIds, "selection block IDs", 1000);
  for (const id of selection.blockIds as string[]) requireId(id, "selection block ID");
  const caps = requireRecord(value.capabilities, "capabilities");
  requireExactKeys(caps, ["revision", "registeredBlockTypes", "bindings"], "capabilities"); requireString(caps.revision, "capability revision", 256);
  caps.registeredBlockTypes = strings(caps.registeredBlockTypes, "registered block types", 256);
  if (caps.bindings !== undefined && (!Array.isArray(caps.bindings) || caps.bindings.length > 256)) fail("bounded bindings required");
  const targetTypes = new Set<string>(), bindingIds = new Set<string>();
  for (const input of (caps.bindings ?? []) as unknown[]) {
    const binding = requireRecord(input, "binding");
    requireExactKeys(binding, ["id", "blockType", "kind", "sourceTypes", "operations", "bound", "proposalAuthorized", "persistence", "undo"], "binding");
    const id = requireId(binding.id, "binding ID"), type = requireString(binding.blockType, "binding block type", 256);
    if (targetTypes.has(type) || bindingIds.has(id)) fail("duplicate binding ID or target type");
    targetTypes.add(type); bindingIds.add(id);
    if (kindFor(type) === "opaque" || kindFor(type) !== binding.kind) fail(`typed adapter mismatch for ${type}`);
    binding.sourceTypes = strings(binding.sourceTypes, "binding source types", 256);
    binding.operations = strings(binding.operations, "binding operations", 2);
    if ((binding.operations as string[]).some(op => op !== "format" && op !== "typed-edit")) fail("unknown candidate operation");
    if (typeof binding.bound !== "boolean" || typeof binding.proposalAuthorized !== "boolean") fail("explicit binding and proposal authorization required");
    for (const key of ["persistence", "undo"]) if (!["durable", "session", "none"].includes(binding[key] as string)) fail(`invalid ${key} declaration`);
  }
  if (value.evidence !== undefined && (!Array.isArray(value.evidence) || value.evidence.length > 256)) fail("bounded evidence required");
  for (const input of (value.evidence ?? []) as unknown[]) {
    const item = requireRecord(input, "evidence");
    requireExactKeys(item, ["blockType", "kind", "operation", "sources", "effectKey", "reason"], "evidence");
    requireString(item.blockType, "evidence block type", 256);
    requireString(item.kind, "evidence adapter kind", 256);
    if (item.operation !== "format" && item.operation !== "typed-edit") fail("unknown evidence operation");
    requireString(item.effectKey, "evidence effect key", 256); requireString(item.reason, "evidence reason", 500);
    if (!Array.isArray(item.sources) || item.sources.length < 1 || item.sources.length > 32) fail("one to 32 evidence sources required");
    const ids = new Set<string>();
    for (const source of item.sources) {
      const entry = requireRecord(source, "evidence source"); requireExactKeys(entry, ["blockId", "sourceKey"], "evidence source");
      const id = requireId(entry.blockId, "evidence block ID"); requireString(entry.sourceKey, "evidence source key", 65536);
      if (ids.has(id)) fail("duplicate evidence source"); ids.add(id);
    }
  }
  return value as unknown as BlockCandidateSnapshot;
}

type Source = { block: EditorBlock; ancestors: EditorBlock[]; topLevel: boolean };
type Candidate = BlockCandidateEvidence & { origin: "literal-marker" | "typed-adapter"; score: number };
function plainText(block: EditorBlock): string | undefined {
  if (typeof block.content === "string") return block.content;
  if (!Array.isArray(block.content)) return undefined;
  // Links, mentions, inline atoms and unknown inline shapes are never flattened.
  const parts: string[] = [];
  for (const node of block.content) {
    if (!node || typeof node !== "object" || Array.isArray(node) || node.type !== "text" || typeof node.text !== "string" || Object.keys(node).some(key => !["type", "text", "styles"].includes(key))) return undefined;
    parts.push(node.text);
  }
  return parts.join("");
}
function literalCandidates(source: Source): Candidate[] {
  const block = source.block;
  if (!source.topLevel || block.type !== "paragraph" || block.children?.length) return [];
  const text = plainText(block); if (!text || text.length > 16000) return [];
  const lines = text.split(/\r?\n/), trimmed = text.trim();
  const candidates: Candidate[] = [];
  const add = (blockType: KnownAgentBlockType, score: number, why: string) => {
    const kind = kindFor(blockType); if (kind === "opaque") return;
    candidates.push({ blockType, kind, operation: "format", sources: [{ blockId: block.id, sourceKey: sourceKey(block) }], effectKey: `format:${blockType}`, reason: why, origin: "literal-marker", score });
  };
  if (/^#{1,3} [^\r\n]+$/.test(text)) add("heading", 91, "An explicit heading marker is present in the original text.");
  if (lines.every(line => /^[-*+] (?!\[[ xX]\] )\S/.test(line))) add("bulletListItem", 86, "Every line has an explicit unordered-list marker.");
  const numbering = lines.map(line => /^(\d+)([.)]) \S/.exec(line));
  if (lines.length > 1 && numbering.every((match, index) => match && Number(match[1]) >= 1 && Number(match[1]) <= 99 && match[2] === numbering[0]?.[2] && Number(match[1]) === Number(numbering[0]?.[1]) + index)) add("numberedListItem", 87, "Consecutive explicit list markers are present; preserve the original numbers and wording.");
  if (lines.every(line => /^[-*+] \[[ xX]\] \S/.test(line))) add("checkListItem", 92, "Explicit checkbox markers carry completion state that must be preserved.");
  if (lines.every(line => /^> ?\S/.test(line))) add("quote", 82, "Every line has an explicit quotation marker; preserve attribution and wording.");
  if (/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n| )\S/.test(text)) add("callout", 93, "An explicit callout marker is present; preserve its label and body.");
  if (/^```[^\r\n]*\r?\n[\s\S]+\r?\n```$/.test(text)) {
    add("codeBlock", 90, "A complete fenced source block is present; preserve source and language without executing it.");
    if (/^```mermaid\r?\n/.test(text)) add("diagram", 94, "The original source explicitly names the diagram language; a diagram validator is still required.");
  }
  if (/^\$\$\r?\n[\s\S]+\r?\n\$\$$/.test(text)) add("mathBlock", 89, "An explicit display-math source delimiter is present; preserve the expression.");
  if (/^(?:---|\*\*\*|___)$/.test(trimmed)) add("divider", 72, "An isolated separator marker is present; the host must confirm the intended structure.");
  if (lines.length >= 2 && lines.every(line => line.includes("\t"))) {
    const widths = lines.map(line => line.split("\t").length);
    if (widths[0]! >= 2 && widths[0]! <= 20 && lines.length <= 100 && widths.every(width => width === widths[0])) add("table", 84, "A rectangular tab-separated grid is present; preserve every cell, value and row order with the table adapter.");
  }
  return candidates;
}

/** Pure bounded candidate policy. Evaluates the inventory plus runtime types;
 * does not call AI, invoke adapters, fetch resources, rewrite or persist content. */
export function evaluateBlockCandidates(input: BlockCandidateSnapshot, options: BlockCandidateOptions = {}): BlockCandidateResult {
  const snapshot = parseSnapshot(input), key = snapshotKey(snapshot);
  const limits = requireRecord(cloneJsonValue(options, "candidate options"), "candidate options");
  requireExactKeys(limits, ["maxSuggestions", "minScore", "dismissedSemanticKeys"], "candidate options");
  const maxSuggestions = (limits.maxSuggestions ?? 3) as number, minScore = (limits.minScore ?? 70) as number;
  if (!Number.isInteger(maxSuggestions) || maxSuggestions < 1 || maxSuggestions > 5 || !Number.isFinite(minScore) || minScore < 0 || minScore > 100) fail("invalid ranking limits");
  if (limits.dismissedSemanticKeys !== undefined && (!Array.isArray(limits.dismissedSemanticKeys) || limits.dismissedSemanticKeys.length > 256 || limits.dismissedSemanticKeys.some(value => typeof value !== "string" || value.length > 65536))) fail("invalid dismissal keys");
  const dismissed = new Set((limits.dismissedSemanticKeys ?? []) as string[]), sources = new Map<string, Source>();
  const walk = (blocks: EditorBlock[], ancestors: EditorBlock[]) => {
    for (const block of blocks) { sources.set(block.id, { block, ancestors, topLevel: ancestors.length === 0 }); if (block.children) walk(block.children, [...ancestors, block]); }
  };
  walk(snapshot.document.blocks, []);
  const selection = new Set(snapshot.selection.blockIds);
  for (const id of selection) if (!sources.has(id)) fail(`selection block ${id} is missing`);
  if ((selection.size || sources.size) > 1000) fail("scope exceeds 1000 blocks; capture a smaller explicit selection without truncating content");
  const bindings = new Map((snapshot.capabilities.bindings ?? []).map(binding => [binding.blockType, binding]));
  const installed = new Set(snapshot.capabilities.registeredBlockTypes);
  const allTypes = [...new Set<string>([...KNOWN_AGENT_BLOCK_TYPES, ...installed, ...bindings.keys(), ...[...sources.values()].map(source => source.block.type), ...(snapshot.evidence ?? []).map(item => item.blockType)])];
  const diagnostics: BlockCandidateDiagnostic[] = allTypes.map(blockType => {
    const binding = bindings.get(blockType), reasons: BlockCandidateReason[] = [];
    if (!installed.has(blockType)) reasons.push(reason("not-installed", "This block type is not registered in the captured host schema."));
    if (blockType === "oeUnknownBlock") reasons.push(reason("opaque-type", "The unknown-block envelope is preserved verbatim and cannot be a candidate."));
    else if (!binding?.bound) reasons.push(reason("adapter-unbound", `A bound ${kindFor(blockType)} adapter is required; schema registration is not an editing path.`));
    if (!binding?.proposalAuthorized) reasons.push(reason("proposal-not-authorized", "The host has not granted proposal authority for this type."));
    if (binding?.persistence !== "durable") reasons.push(reason("persistence-unverified", "A durable canonical transaction and receipt path has not been declared."));
    if (binding?.undo !== "durable") reasons.push(reason("undo-unverified", "A durable, conflict-aware Undo path has not been declared."));
    return { blockType, known: known(blockType), installed: installed.has(blockType), bound: binding?.bound ?? false, proposalAuthorized: binding?.proposalAuthorized ?? false, persistence: binding?.persistence ?? "none", undo: binding?.undo ?? "none", adapterKind: kindFor(blockType), status: "no-change", reasons };
  });
  const diagnosticByType = new Map(diagnostics.map(item => [item.blockType, item]));
  const gateReasons = new Map(diagnostics.map(item => [item.blockType, [...item.reasons]]));
  const candidates: Candidate[] = [...sources.values()].filter(source => !selection.size || selection.has(source.block.id)).flatMap(literalCandidates);
  for (const item of snapshot.evidence ?? []) candidates.push({ ...item, origin: "typed-adapter", score: item.operation === "format" ? 88 : 80 });
  const rejected: BlockCandidateResult["rejected"] = [], ready: BlockCandidateSuggestion[] = [];
  const reject = (candidate: Candidate | BlockCandidateSuggestion, why: BlockCandidateReason) => {
    const blockIds = "sources" in candidate ? candidate.sources.map(source => source.blockId) : candidate.blockIds;
    rejected.push({ blockType: candidate.blockType, blockIds, reason: why });
    const diagnostic = diagnosticByType.get(candidate.blockType)!;
    if (!diagnostic.reasons.some(item => item.code === why.code)) diagnostic.reasons.push(why);
    if (diagnostic.status !== "suggested") diagnostic.status = "rejected";
  };
  for (const source of sources.values()) {
    if (selection.size && !selection.has(source.block.id)) continue;
    if (source.topLevel && source.block.type === "paragraph" && !source.block.children?.length && (plainText(source.block)?.length ?? 0) > 16000) {
      const why = reason("literal-inference-limit", "This paragraph exceeds the 16000-character literal-inference budget; use a narrower typed review without truncating source text.");
      rejected.push({ blockType: "paragraph", blockIds: [source.block.id], reason: why });
      const diagnostic = diagnosticByType.get("paragraph")!;
      if (!diagnostic.reasons.some(item => item.code === why.code)) diagnostic.reasons.push(why);
      diagnostic.status = "rejected";
    }
  }
  for (const candidate of candidates) {
    const diagnostic = diagnosticByType.get(candidate.blockType)!, binding = bindings.get(candidate.blockType);
    const candidateSources = candidate.sources.map(source => sources.get(source.blockId));
    let blocked: BlockCandidateReason | undefined;
    if (candidate.kind !== diagnostic.adapterKind) blocked = reason("adapter-kind-mismatch", "Evidence requires the exact typed adapter for its target.");
    else if (candidate.sources.some((source, index) => !candidateSources[index] || source.sourceKey !== sourceKey(candidateSources[index]!.block))) blocked = reason("stale-evidence", "Evidence does not match the complete current source block.");
    else if (candidateSources.some(source => source!.block.type === "oeUnknownBlock" || source!.ancestors.some(parent => !known(parent.type) || parent.type === "oeUnknownBlock") || (!known(source!.block.type) && (candidate.kind !== "extension" || candidate.blockType !== source!.block.type)))) blocked = reason("opaque-source", "Unknown envelopes and unadapted runtime source types must remain opaque.");
    else if (candidateSources.some(source => !installed.has(source!.block.type))) blocked = reason("source-not-installed", "A source type is not registered in the captured host schema.");
    else if (candidateSources.some(source => kindFor(source!.block.type) !== "text" && kindFor(source!.block.type) !== candidate.kind)) blocked = reason("typed-source-mismatch", "A structured source cannot be flattened or relabeled through a different adapter family.");
    else if (candidate.sources.some(source => selection.size > 0 && !selection.has(source.blockId))) blocked = reason("outside-selection", "A source lies outside the exact captured block selection.");
    else if (candidate.operation === "format" && candidateSources.every(source => source!.block.type === candidate.blockType)) blocked = reason("already-satisfied", "The sources already use this block type.");
    else if (gateReasons.get(candidate.blockType)!.length) blocked = gateReasons.get(candidate.blockType)![0];
    else if (!binding!.operations.includes(candidate.operation)) blocked = reason("operation-unbound", "The typed adapter does not declare this operation.");
    else if (candidateSources.some(source => !binding!.sourceTypes.includes(source!.block.type))) blocked = reason("source-type-unbound", "The typed adapter does not declare this source type.");
    else if (candidate.origin === "literal-marker" && candidateSources.some(source => source!.block.children?.length)) blocked = reason("nested-source", "Literal-marker suggestions cannot restructure a child hierarchy.");
    if (blocked) { reject(candidate, blocked); continue; }
    const sortedSources = [...candidate.sources].sort((a, b) => compare(a.blockId, b.blockId));
    const effectKey = candidate.operation === "format" ? `format:${candidate.blockType}` : candidate.effectKey;
    const semanticKey = `block-meaning-v1:${canonical({ documentId: snapshot.documentId, blockType: candidate.blockType, operation: candidate.operation, sources: sortedSources, effectKey })}`;
    if (semanticKey.length > 65536) { reject(candidate, reason("semantic-key-limit", "The exact effect identity exceeds 65536 characters; use a narrower typed review without truncating sources.")); continue; }
    if (dismissed.has(semanticKey)) { reject(candidate, reason("dismissed", "An unchanged equivalent suggestion was already dismissed.")); continue; }
    if (candidate.score < minScore) { reject(candidate, reason("below-threshold", "The evidence does not meet the configured usefulness threshold.")); continue; }
    ready.push({ key, semanticKey, blockType: candidate.blockType, blockIds: sortedSources.map(source => source.blockId), operation: candidate.operation, score: candidate.score, reason: candidate.reason, evidence: { origin: candidate.origin, sources: sortedSources.map(source => ({ ...source })), effectKey }, execution: "denied" });
  }
  ready.sort((a, b) => b.score - a.score || compare(a.semanticKey, b.semanticKey));
  const suggestions: BlockCandidateSuggestion[] = [], seen = new Set<string>();
  const overlaps = (left: string, right: string) => left === right || sources.get(left)!.ancestors.some(parent => parent.id === right) || sources.get(right)!.ancestors.some(parent => parent.id === left);
  for (const candidate of ready) {
    if (seen.has(candidate.semanticKey)) { reject(candidate, reason("duplicate-effect", "Equivalent effects are represented by one suggestion.")); continue; }
    seen.add(candidate.semanticKey);
    if (suggestions.some(item => item.blockIds.some(left => candidate.blockIds.some(right => overlaps(left, right))))) { reject(candidate, reason("overlapping-alternative", "A higher-ranked alternative already covers this source or its hierarchy.")); continue; }
    if (suggestions.length >= maxSuggestions) { reject(candidate, reason("ranking-limit", "Only the top few non-overlapping suggestions are shown.")); continue; }
    suggestions.push(candidate); diagnosticByType.get(candidate.blockType)!.status = "suggested";
  }
  for (const diagnostic of diagnostics) {
    if (!candidates.some(item => item.blockType === diagnostic.blockType)) diagnostic.reasons.push(reason("no-grounded-evidence", "No useful, exact-source change was identified; retain the existing content."));
  }
  return { key, suggestions, noChange: { recommended: suggestions.length === 0, reason: suggestions.length ? "Keeping the document unchanged remains an available choice." : "No useful change passed every captured source, selection and host gate; keep the document unchanged." }, diagnostics, rejected, execution: "denied" };
}
