import type { EditorBlock, EditorBlockProps, EditorDocument, JsonValue } from "@hello-ai-company/editor-core";
import {
  AIContractValidationError,
  cloneJsonValue,
  createValidationBudget,
  parseEditorDocument,
  requireExactKeys,
  requireId,
  requireRecord,
  requireString,
  requireText,
  requireTimestamp,
  type ValidationBudget
} from "./validation.js";

export type SuggestionOrigin = Readonly<{
  agentId: string;
  runId: string;
  generatedAt: string;
}>;

export type TextEdit = Readonly<{
  start: number;
  end: number;
  insertText: string;
}>;

export type SuggestionChange =
  | Readonly<{ op: "insert"; block: EditorBlock; parentId?: string | null; beforeId?: string }>
  | Readonly<{ op: "delete"; blockId: string }>
  | Readonly<{ op: "replace"; blockId: string; block: EditorBlock }>
  | Readonly<{ op: "move"; blockId: string; parentId?: string | null; beforeId?: string }>
  | Readonly<{ op: "update-props"; blockId: string; set: EditorBlockProps; remove: readonly string[] }>
  | Readonly<{ op: "text-diff"; blockId: string; baseText: string; edits: readonly TextEdit[] }>;

export type SuggestionGroup = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  summary?: string;
  baseDocument: EditorDocument;
  changes: readonly SuggestionChange[];
}>;

export type AcceptSuggestionDecision = Readonly<{
  acceptedBy: string;
  acceptedAt: string;
  source: SuggestionOrigin;
}>;

export type AcceptedChangeProvenance = Readonly<{
  sourceAgentId: string;
  sourceRunId: string;
  generatedAt: string;
  acceptedBy: string;
  acceptedAt: string;
}>;

export type AcceptedSuggestionChange = Readonly<{
  group: SuggestionGroup;
  provenance: AcceptedChangeProvenance;
}>;

export type SuggestionAcceptance =
  | Readonly<{ status: "accepted"; document: EditorDocument; acceptedChange: AcceptedSuggestionChange }>
  | Readonly<{ status: "stale"; groupId: string; reason: string }>;

export type SuggestionRejection = Readonly<{
  status: "rejected";
  groupId: string;
  rejectedBy: string;
  rejectedAt: string;
}>;

export class SuggestionValidationError extends Error {
  readonly code = "INVALID_SUGGESTION";

  constructor(message: string) {
    super(message);
    this.name = "SuggestionValidationError";
  }
}

export class SuggestionConflictError extends Error {
  readonly code = "SUGGESTION_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "SuggestionConflictError";
  }
}

const MAX_SUGGESTION_CHANGES = 256;
const MAX_TEXT_EDITS_PER_CHANGE = 1_000;
const MAX_TEXT_EDITS_PER_GROUP = 10_000;

/** Validates and copies an untrusted agent payload. It never mutates the payload. */
export function parseSuggestionGroup(value: unknown): SuggestionGroup {
  try {
    const budget = createValidationBudget();
    const record = requireRecord(value, "suggestion");
    requireExactKeys(record, ["schemaVersion", "id", "title", "summary", "baseDocument", "changes"], "suggestion");
    if (record.schemaVersion !== 1) throw new AIContractValidationError("suggestion.schemaVersion must be 1.");
    const id = requireId(record.id, "suggestion.id", budget);
    const title = requireString(record.title, "suggestion.title", 256, budget);
    const summary = record.summary === undefined ? undefined : requireText(record.summary, "suggestion.summary", 8_000, budget);
    const baseDocument = parseEditorDocument(record.baseDocument, "suggestion.baseDocument", budget);
    if (!Array.isArray(record.changes) || record.changes.length === 0 || record.changes.length > MAX_SUGGESTION_CHANGES) {
      throw new AIContractValidationError(`suggestion.changes must contain between 1 and ${MAX_SUGGESTION_CHANGES} operations.`);
    }
    const textEditBudget = { total: 0 };
    const changes = record.changes.map((change, index) => parseChange(change, index, textEditBudget, budget));
    validateChanges(baseDocument, changes);
    const group: SuggestionGroup = {
      schemaVersion: 1,
      id,
      title,
      ...(summary === undefined ? {} : { summary }),
      baseDocument,
      changes
    };
    // Dry-run against the copied base so structurally impossible payloads never enter the UI.
    applyChanges(baseDocument, changes);
    return group;
  } catch (error) {
    if (error instanceof SuggestionValidationError || error instanceof SuggestionConflictError) throw error;
    if (error instanceof AIContractValidationError) throw new SuggestionValidationError(error.message);
    throw new SuggestionValidationError("suggestion payload could not be validated.");
  }
}

/** Applies only after an explicit accept decision and only when the base is still current. */
export function acceptSuggestionGroup(
  untrustedGroup: unknown,
  untrustedCurrentDocument: unknown,
  untrustedDecision: unknown
): SuggestionAcceptance {
  const group = parseSuggestionGroup(untrustedGroup);
  const currentDocument = parseEditorDocument(untrustedCurrentDocument, "currentDocument");
  const decision = requireRecord(untrustedDecision, "decision");
  requireExactKeys(decision, ["acceptedBy", "acceptedAt", "source"], "decision");
  const acceptedBy = requireId(decision.acceptedBy, "decision.acceptedBy");
  const acceptedAt = requireTimestamp(decision.acceptedAt, "decision.acceptedAt");
  const source = parseOrigin(decision.source, "decision.source");

  if (!documentsEqual(currentDocument, group.baseDocument)) {
    return { status: "stale", groupId: group.id, reason: "The document changed after this suggestion was generated." };
  }

  const document = applyChanges(currentDocument, group.changes);
  return {
    status: "accepted",
    document,
    acceptedChange: {
      group,
      provenance: {
        sourceAgentId: source.agentId,
        sourceRunId: source.runId,
        generatedAt: source.generatedAt,
        acceptedBy,
        acceptedAt
      }
    }
  };
}

/** Records rejection without applying any operation or returning a document. */
export function rejectSuggestionGroup(
  untrustedGroup: unknown,
  untrustedDecision: unknown
): SuggestionRejection {
  const group = parseSuggestionGroup(untrustedGroup);
  const decision = requireRecord(untrustedDecision, "decision");
  requireExactKeys(decision, ["rejectedBy", "rejectedAt"], "decision");
  return {
    status: "rejected",
    groupId: group.id,
    rejectedBy: requireId(decision.rejectedBy, "decision.rejectedBy"),
    rejectedAt: requireTimestamp(decision.rejectedAt, "decision.rejectedAt")
  };
}

function parseOrigin(value: unknown, label: string): SuggestionOrigin {
  const origin = requireRecord(value, label);
  requireExactKeys(origin, ["agentId", "runId", "generatedAt"], label);
  return {
    agentId: requireId(origin.agentId, `${label}.agentId`),
    runId: requireId(origin.runId, `${label}.runId`),
    generatedAt: requireTimestamp(origin.generatedAt, `${label}.generatedAt`)
  };
}

function parseBlock(value: unknown, label: string, budget: ValidationBudget): EditorBlock {
  const document = parseEditorDocument({ schemaVersion: 1, blocks: [value] }, label, budget);
  return document.blocks[0] as EditorBlock;
}

function parseChange(value: unknown, index: number, textEditBudget: { total: number }, budget: ValidationBudget): SuggestionChange {
  const label = `suggestion.changes[${index}]`;
  const change = requireRecord(value, label);
  const op = requireString(change.op, `${label}.op`, 32, budget);
  switch (op) {
    case "insert": {
      requireExactKeys(change, ["op", "block", "parentId", "beforeId"], label);
      const parentId = parseOptionalId(change.parentId, `${label}.parentId`, true, budget);
      const beforeId = change.beforeId === undefined ? undefined : requireId(change.beforeId, `${label}.beforeId`, budget);
      return { op, block: parseBlock(change.block, `${label}.block`, budget), ...(parentId === undefined ? {} : { parentId }), ...(beforeId === undefined ? {} : { beforeId }) };
    }
    case "delete": {
      requireExactKeys(change, ["op", "blockId"], label);
      return { op, blockId: requireId(change.blockId, `${label}.blockId`, budget) };
    }
    case "replace": {
      requireExactKeys(change, ["op", "blockId", "block"], label);
      const blockId = requireId(change.blockId, `${label}.blockId`, budget);
      const block = parseBlock(change.block, `${label}.block`, budget);
      if (block.id !== blockId) throw new AIContractValidationError(`${label}.block.id must equal blockId.`);
      return { op, blockId, block };
    }
    case "move": {
      requireExactKeys(change, ["op", "blockId", "parentId", "beforeId"], label);
      const parentId = parseOptionalId(change.parentId, `${label}.parentId`, true, budget);
      const beforeId = change.beforeId === undefined ? undefined : requireId(change.beforeId, `${label}.beforeId`, budget);
      return { op, blockId: requireId(change.blockId, `${label}.blockId`, budget), ...(parentId === undefined ? {} : { parentId }), ...(beforeId === undefined ? {} : { beforeId }) };
    }
    case "update-props": {
      requireExactKeys(change, ["op", "blockId", "set", "remove"], label);
      const blockId = requireId(change.blockId, `${label}.blockId`, budget);
      const rawSet = change.set === undefined ? {} : cloneJsonValue(change.set, `${label}.set`, budget);
      if (rawSet === null || Array.isArray(rawSet) || typeof rawSet !== "object") {
        throw new AIContractValidationError(`${label}.set must be a JSON object.`);
      }
      const removeValue = change.remove === undefined ? [] : change.remove;
      if (!Array.isArray(removeValue) || removeValue.length > 1_000) {
        throw new AIContractValidationError(`${label}.remove must be an array of at most 1000 property names.`);
      }
      const remove = removeValue.map((key, keyIndex) => requireString(key, `${label}.remove[${keyIndex}]`, 256, budget));
      if (new Set(remove).size !== remove.length) throw new AIContractValidationError(`${label}.remove must not contain duplicate property names.`);
      if (Object.keys(rawSet).some((key) => remove.includes(key))) throw new AIContractValidationError(`${label}.set and remove must not name the same property.`);
      if (Object.keys(rawSet).length === 0 && remove.length === 0) throw new AIContractValidationError(`${label} must change at least one property.`);
      return { op, blockId, set: rawSet as EditorBlockProps, remove };
    }
    case "text-diff": {
      requireExactKeys(change, ["op", "blockId", "baseText", "edits"], label);
      const blockId = requireId(change.blockId, `${label}.blockId`, budget);
      const baseText = requireText(change.baseText, `${label}.baseText`, undefined, budget);
      if (!Array.isArray(change.edits) || change.edits.length === 0 || change.edits.length > MAX_TEXT_EDITS_PER_CHANGE) {
        throw new AIContractValidationError(`${label}.edits must contain between 1 and ${MAX_TEXT_EDITS_PER_CHANGE} text edits.`);
      }
      textEditBudget.total += change.edits.length;
      if (textEditBudget.total > MAX_TEXT_EDITS_PER_GROUP) {
        throw new AIContractValidationError(`suggestion.changes exceeds the ${MAX_TEXT_EDITS_PER_GROUP} text edit limit.`);
      }
      let previous: TextEdit | undefined;
      const edits = change.edits.map((editValue, editIndex) => {
        const editLabel = `${label}.edits[${editIndex}]`;
        const edit = requireRecord(editValue, editLabel);
        requireExactKeys(edit, ["start", "end", "insertText"], editLabel);
        if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end)) {
          throw new AIContractValidationError(`${editLabel} offsets must be safe integers.`);
        }
        const start = edit.start as number;
        const end = edit.end as number;
        const insertText = requireText(edit.insertText, `${editLabel}.insertText`, undefined, budget);
        if (start < 0 || end < start || end > baseText.length) throw new AIContractValidationError(`${editLabel} offsets are outside baseText.`);
        if (previous && (start < previous.end || start === previous.start)) throw new AIContractValidationError(`${label}.edits must be ordered and non-overlapping.`);
        const parsedEdit = { start, end, insertText };
        previous = parsedEdit;
        return parsedEdit;
      });
      return { op, blockId, baseText, edits };
    }
    default:
      throw new AIContractValidationError(`${label}.op is unsupported.`);
  }
}

function parseOptionalId(value: unknown, label: string, allowNull: boolean, budget: ValidationBudget): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && allowNull) return null;
  return requireId(value, label, budget);
}

function validateChanges(baseDocument: EditorDocument, changes: readonly SuggestionChange[]): void {
  const blocks = indexBlocks(baseDocument);
  const targets = new Set<string>();
  const insertedIds = new Set<string>();
  const destructive = new Set<string>();
  const moved = new Set<string>();
  const destinationAnchors = new Set<string>();

  for (const change of changes) {
    if (change.op === "insert") {
      assertNoDuplicateIds(change.block, insertedIds);
      if (blocks.has(change.block.id)) throw new SuggestionValidationError(`insert block id '${change.block.id}' already exists.`);
      validateDestination(change.parentId, change.beforeId, blocks, `${change.op} destination`);
      if (change.beforeId !== undefined) {
        if (destinationAnchors.has(change.beforeId)) throw new SuggestionValidationError(`multiple operations use beforeId '${change.beforeId}'.`);
        destinationAnchors.add(change.beforeId);
      }
      continue;
    }

    if (!blocks.has(change.blockId)) throw new SuggestionValidationError(`${change.op} target '${change.blockId}' does not exist.`);
    if (targets.has(change.blockId)) throw new SuggestionValidationError(`multiple operations target block '${change.blockId}'.`);
    targets.add(change.blockId);
    if (change.op === "delete" || change.op === "replace") destructive.add(change.blockId);
    if (change.op === "move") {
      moved.add(change.blockId);
      validateDestination(change.parentId, change.beforeId, blocks, `${change.op} destination`);
      if (change.beforeId === change.blockId) throw new SuggestionValidationError(`move target '${change.blockId}' cannot anchor before itself.`);
      if (change.beforeId !== undefined) {
        if (destinationAnchors.has(change.beforeId)) throw new SuggestionValidationError(`multiple operations use beforeId '${change.beforeId}'.`);
        destinationAnchors.add(change.beforeId);
      }
      const targetDescendants = blocks.get(change.blockId)?.descendants ?? new Set<string>();
      if (change.parentId !== undefined && change.parentId !== null && targetDescendants.has(change.parentId)) {
        throw new SuggestionValidationError(`move of '${change.blockId}' would create a parent cycle.`);
      }
    }
  }

  for (const blockId of targets) {
    for (const rootId of destructive) {
      if (rootId !== blockId && isAncestor(rootId, blockId, blocks)) {
        throw new SuggestionValidationError(`operation on '${blockId}' conflicts with removal or replacement of ancestor '${rootId}'.`);
      }
      if (rootId !== blockId && isAncestor(blockId, rootId, blocks) && destructive.has(blockId)) {
        throw new SuggestionValidationError(`nested destructive operations on '${blockId}' and '${rootId}' conflict.`);
      }
    }
  }

  for (const change of changes) {
    if (change.op === "insert" || change.op === "move") {
      if (change.parentId !== undefined && change.parentId !== null && destructive.has(change.parentId)) {
        throw new SuggestionValidationError(`destination parent '${change.parentId}' is removed or replaced by this suggestion.`);
      }
      if (change.beforeId !== undefined && (destructive.has(change.beforeId) || moved.has(change.beforeId))) {
        throw new SuggestionValidationError(`destination anchor '${change.beforeId}' is changed by this suggestion.`);
      }
    }
  }
}

function validateDestination(
  parentId: string | null | undefined,
  beforeId: string | undefined,
  blocks: Map<string, BlockLocation>,
  label: string
): void {
  if (parentId !== undefined && parentId !== null && !blocks.has(parentId)) {
    throw new SuggestionValidationError(`${label} parent '${parentId}' does not exist.`);
  }
  if (beforeId === undefined) return;
  const anchor = blocks.get(beforeId);
  if (!anchor) throw new SuggestionValidationError(`${label} anchor '${beforeId}' does not exist.`);
  const parentKey = parentId ?? null;
  if (anchor.parentId !== parentKey) throw new SuggestionValidationError(`${label} anchor '${beforeId}' is not a child of the selected parent.`);
}

function assertNoDuplicateIds(block: EditorBlock, ids: Set<string>): void {
  const visit = (current: EditorBlock): void => {
    if (ids.has(current.id)) throw new SuggestionValidationError(`inserted block id '${current.id}' is duplicated.`);
    ids.add(current.id);
    for (const child of current.children ?? []) visit(child);
  };
  visit(block);
}

type BlockLocation = Readonly<{ block: EditorBlock; parentId: string | null; descendants: Set<string> }>;

function indexBlocks(document: EditorDocument): Map<string, BlockLocation> {
  const index = new Map<string, BlockLocation>();
  function visit(block: EditorBlock, parentId: string | null): Set<string> {
    const descendants = new Set<string>();
    for (const child of block.children ?? []) {
      descendants.add(child.id);
      for (const descendant of visit(child, block.id)) descendants.add(descendant);
    }
    index.set(block.id, { block, parentId, descendants });
    return new Set([block.id, ...descendants]);
  }
  for (const block of document.blocks) visit(block, null);
  return index;
}

function isAncestor(ancestorId: string, blockId: string, blocks: Map<string, BlockLocation>): boolean {
  let parentId = blocks.get(blockId)?.parentId;
  while (parentId !== undefined && parentId !== null) {
    if (parentId === ancestorId) return true;
    parentId = blocks.get(parentId)?.parentId;
  }
  return false;
}

function applyChanges(baseDocument: EditorDocument, changes: readonly SuggestionChange[]): EditorDocument {
  const budget = createValidationBudget();
  const document = parseEditorDocument(baseDocument, "apply.baseDocument", budget);
  for (const change of changes) {
    switch (change.op) {
      case "insert": {
        const siblings = getSiblings(document, change.parentId);
        const index = getAnchorIndex(siblings, change.beforeId);
        siblings.splice(index, 0, parseBlock(change.block, "insert.block", budget));
        break;
      }
      case "delete": {
        const location = findBlockLocation(document, change.blockId);
        location.siblings.splice(location.index, 1);
        break;
      }
      case "replace": {
        const location = findBlockLocation(document, change.blockId);
        location.siblings[location.index] = parseBlock(change.block, "replace.block", budget);
        break;
      }
      case "move": {
        const location = findBlockLocation(document, change.blockId);
        const [block] = location.siblings.splice(location.index, 1);
        if (!block) throw new SuggestionConflictError(`move target '${change.blockId}' disappeared.`);
        const siblings = getSiblings(document, change.parentId);
        const index = getAnchorIndex(siblings, change.beforeId);
        siblings.splice(index, 0, block);
        break;
      }
      case "update-props": {
        const target = findBlockLocation(document, change.blockId).siblings[findBlockLocation(document, change.blockId).index];
        if (!target) throw new SuggestionConflictError(`update-props target '${change.blockId}' disappeared.`);
        const props = { ...(target.props ?? {}) };
        for (const key of change.remove) delete props[key];
        for (const [key, value] of Object.entries(change.set)) props[key] = cloneJsonValue(value, `update-props.${key}`);
        if (Object.keys(props).length === 0) delete target.props;
        else target.props = props;
        break;
      }
      case "text-diff": {
        const targetLocation = findBlockLocation(document, change.blockId);
        const target = targetLocation.siblings[targetLocation.index];
        if (!target || typeof target.content !== "string" || target.content !== change.baseText) {
          throw new SuggestionConflictError(`text-diff base for '${change.blockId}' does not match.`);
        }
        let text = target.content;
        for (const edit of [...change.edits].reverse()) {
          text = `${text.slice(0, edit.start)}${edit.insertText}${text.slice(edit.end)}`;
        }
        target.content = text;
        break;
      }
    }
  }
  try {
    return parseEditorDocument(document, "result.document");
  } catch (error) {
    if (error instanceof AIContractValidationError) throw new SuggestionConflictError(error.message);
    throw error;
  }
}

function getSiblings(document: EditorDocument, parentId: string | null | undefined): EditorBlock[] {
  if (parentId === undefined || parentId === null) return document.blocks;
  const parent = findBlockLocation(document, parentId).siblings[findBlockLocation(document, parentId).index];
  if (!parent) throw new SuggestionConflictError(`destination parent '${parentId}' disappeared.`);
  parent.children ??= [];
  return parent.children;
}

function getAnchorIndex(siblings: EditorBlock[], beforeId: string | undefined): number {
  if (beforeId === undefined) return siblings.length;
  const index = siblings.findIndex((block) => block.id === beforeId);
  if (index < 0) throw new SuggestionConflictError(`destination anchor '${beforeId}' is missing.`);
  return index;
}

function findBlockLocation(document: EditorDocument, blockId: string): { siblings: EditorBlock[]; index: number } {
  function search(siblings: EditorBlock[]): { siblings: EditorBlock[]; index: number } | undefined {
    for (let index = 0; index < siblings.length; index += 1) {
      const block = siblings[index];
      if (!block) continue;
      if (block.id === blockId) return { siblings, index };
      const nested = block.children ? search(block.children) : undefined;
      if (nested) return nested;
    }
    return undefined;
  }
  const location = search(document.blocks);
  if (!location) throw new SuggestionConflictError(`block '${blockId}' does not exist.`);
  return location;
}

function documentsEqual(left: EditorDocument, right: EditorDocument): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function stableSerialize(value: JsonValue | EditorDocument | EditorBlock): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item as JsonValue)}`).join(",")}}`;
}
