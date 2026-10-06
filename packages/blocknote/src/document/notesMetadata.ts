import type { JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "./legacyNotes.js";

export type NotesMetadataEdit = {
  blockId: string;
  field: "tableProps" | "databaseConfig";
  key: string;
  expected: { present: boolean; value?: JsonValue };
  value: JsonValue;
};
const reserved = new Set(["__proto__", "constructor", "prototype"]);
function object(value: JsonValue): Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected metadata object");
  return value;
}
function equal(a: unknown, b: unknown): boolean {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
}
/** Explicit host-side edits only. Never expose the raw block/archive to an AI context.
 * Call after exportLegacyNotesBlocks, then persist with a server revision CAS.
 * Each key is compared against its captured value; unedited future fields/rows survive.
 */
export function applyNotesMetadataEdits(currentBlocks: unknown, edits: readonly NotesMetadataEdit[]): JsonValue[] {
  const blocks = copyLegacyNotesJson(currentBlocks);
  if (!Array.isArray(blocks)) throw new Error("Expected blocks");
  const safeEdits = copyLegacyNotesJson(edits) as unknown as NotesMetadataEdit[];
  if (!Array.isArray(safeEdits) || safeEdits.length > 64) throw new Error("Metadata edit budget exceeded");
  const identities = new Map<string, Record<string, JsonValue>>();
  const visit = (items: JsonValue[]): void => { for (const item of items) {
    const block = object(item);
    if (typeof block.id !== "string" || identities.has(block.id)) throw new Error("Invalid block identity");
    identities.set(block.id, block);
    if (block.children !== undefined) { if (!Array.isArray(block.children)) throw new Error("Invalid children"); visit(block.children); }
  } };
  visit(blocks);
  const targets = new Set<string>();
  for (const edit of safeEdits) {
    const raw = object(edit as unknown as JsonValue);
    if (Object.keys(raw).some(k => !["blockId", "field", "key", "expected", "value"].includes(k))) throw new Error("Invalid metadata edit");
    if (typeof edit.key !== "string" || !edit.key || edit.key.length > 128 || reserved.has(edit.key)) throw new Error("Invalid metadata key");
    const block = identities.get(edit.blockId);
    if (!block || !(edit.field === "tableProps" && block.type === "table" || edit.field === "databaseConfig" && block.type === "database")) throw new Error("Metadata target is unavailable");
    const target = JSON.stringify([edit.blockId, edit.field, edit.key]);
    if (targets.has(target)) throw new Error("Duplicate metadata target"); targets.add(target);
    const original = block[edit.field];
    if (edit.field === "databaseConfig" && original !== undefined && typeof original !== "string") throw new Error("Database config must be serialized JSON");
    const properties = original === undefined ? {} : object(typeof original === "string" ? copyLegacyNotesJson(JSON.parse(original)) : original);
    const expected = object(edit.expected as unknown as JsonValue);
    if (typeof expected.present !== "boolean" || Object.keys(expected).some(k => k !== "present" && k !== "value") || expected.present !== Object.hasOwn(expected, "value") || !Object.hasOwn(raw, "value")) throw new Error("Invalid expected metadata value");
    if (Object.hasOwn(properties, edit.key) !== edit.expected.present || edit.expected.present && !equal(properties[edit.key], edit.expected.value)) throw new Error("Metadata changed; refresh before saving");
    const next = { ...properties, [edit.key]: edit.value };
    block[edit.field] = edit.field === "databaseConfig" ? JSON.stringify(next) : next;
  }
  return blocks;
}
