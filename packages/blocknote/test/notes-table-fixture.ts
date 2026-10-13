import { vi } from "vitest";
import type { JsonValue } from "@hello-ai-company/editor-core";
import { notesTableBindingKey, type NotesTableEditingHost, type NotesTableBinding, type NotesTableInputDraft, type NotesTableReceipt, type NotesTableSnapshot, type NotesTableRow } from "../src/notes/tableEditing.js";
import type { NotesResourceRecovery, NotesResourceRequest } from "../src/workspace/revisionedNotesResource.js";
export const fixtureScope = { actorId: "fixture-actor", workspaceId: "fixture-only" };
export const fixtureTarget = { kind: "page", pageId: "parent" } as const;
export const fixtureBinding = (query = "", viewId = "main"): NotesTableBinding => ({ scope: fixtureScope, parentTarget: fixtureTarget, databaseId: "db", viewId, query: { query, trashed: false, sortBy: "position", direction: "asc", limit: 20 } });
const clone = <T,>(value: T): T => structuredClone(value);
const draftKey = (d: NotesTableInputDraft) => notesTableBindingKey(d.binding) + JSON.stringify([d.mode, d.rowKey, d.propertyId ?? null]);
export function tableFixture() {
  let revision = "r1", schemaRevision = "s1";
  const rows = new Map<string, NotesTableRow>([
    ["visible", { id: "visible", title: "Visible", deleted: false, sortOrder: 0, values: { title: "Visible", number: 2, done: false, future: { opaque: ["retain", 7] }, hiddenField: "exact unknown bytes" } }],
    ["hidden", { id: "hidden", title: "Hidden", deleted: false, sortOrder: 1, values: { title: "Hidden", number: 9, opaque: { nested: true } } }]
  ]);
  const stored = new Map<string, NotesTableInputDraft>(), tickets = new Map<string, NotesResourceRecovery>(), receipts = new Map<string, NotesTableReceipt>();
  const faults = { journal: false, ticket: false, lostAck: false, rows: false, foreignProof: false, denied: false, beforeCommit: undefined as (() => Promise<void>) | undefined };
  const snapshot = (): NotesTableSnapshot => ({ scope: fixtureScope, parentTarget: fixtureTarget, databaseId: "db", revision, schema: { revision: schemaRevision, properties: [
    { id: "title", name: "Title", type: "text" }, { id: "number", name: "Amount", type: "number" }, { id: "done", name: "Done", type: "checkbox" }, { id: "future", name: "Future", type: "future-native", config: { raw: "keep" } }, { id: "formula", name: "Computed", type: "formula", readOnly: true }
  ] }, capabilities: ["row.create", "row.patch"] });
  const journal: NotesTableEditingHost["journal"] = {
    version: 1, compareAndSwap: true,
    read: vi.fn(async binding => [...stored.values()].filter(d => notesTableBindingKey(d.binding) === notesTableBindingKey(binding)).map(clone)),
    list: vi.fn(async (scope, target) => [...stored.values()].filter(d => JSON.stringify(d.binding.scope) === JSON.stringify(scope) && JSON.stringify(d.binding.parentTarget) === JSON.stringify(target)).map(clone)),
    put: vi.fn(async (draft, expected) => { if (faults.journal) throw new Error("QuotaExceededError"); if (JSON.stringify(stored.get(draftKey(draft))) !== JSON.stringify(expected)) throw new Error("Input CAS conflict"); stored.set(draftKey(draft), clone(draft)); }),
    remove: vi.fn(async draft => { if (faults.journal || JSON.stringify(stored.get(draftKey(draft))) !== JSON.stringify(draft)) throw new Error("Input cleanup failed"); stored.delete(draftKey(draft)); })
  };
  const commit = vi.fn(async (request: NotesResourceRequest): Promise<NotesTableReceipt> => {
    if (!tickets.has(request.operationId)) throw new Error("Missing durable ticket");
    const capture = [...stored.values()].find(d => d.submitted?.request.operationId === request.operationId); if (!capture) throw new Error("Raw input not durable before transport");
    if (faults.beforeCommit) await faults.beforeCommit();
    const proof = { scope: fixtureScope, parentTarget: fixtureTarget, databaseId: "db", previousRevision: request.expectedRevision, historyId: "history-" + request.operationId };
    let result: NotesTableReceipt;
    if (request.expectedRevision !== revision || faults.denied) result = { status: faults.denied ? "denied" : "conflict", resourceId: request.resourceId, operationId: request.operationId, proof };
    else {
      if (request.change.kind !== "patch") throw new Error("No other wire command");
      const command = request.change.fields.command as { kind: "row.create" | "row.patch"; rowKey: string; fields: Record<string, JsonValue> };
      if (Object.keys(command).sort().join() !== "fields,kind,rowKey") throw new Error("Wire contains unexpected schema field");
      const row = command.kind === "row.create" ? { id: command.rowKey, title: "", sortOrder: rows.size, deleted: false, values: {} } : clone(rows.get(command.rowKey)!);
      if (!row) throw new Error("No reviewed row"); Object.assign(row.values, clone(command.fields)); if (typeof row.values.title === "string") row.title = row.values.title;
      rows.set(row.id, row); revision = "r" + (Number(revision.slice(1)) + 1);
      result = { status: "committed", resourceId: request.resourceId, operationId: request.operationId, snapshot: { revision, value: { ...snapshot(), command } as unknown as JsonValue }, proof };
    }
    receipts.set(request.operationId, clone(result));
    if (faults.lostAck) throw new Error("Lost acknowledgement after durable commit");
    if (faults.foreignProof) return { ...result, proof: { ...proof, scope: { ...fixtureScope, actorId: "foreign" } } };
    return clone(result);
  });
  const lookup = vi.fn(async (resourceId: string, operationId: string): Promise<NotesTableReceipt> => clone(receipts.get(operationId) ?? { status: "denied", resourceId, operationId, proof: { scope: fixtureScope, parentTarget: fixtureTarget, databaseId: "db" } }));
  const host: NotesTableEditingHost = {
    version: 1, scope: fixtureScope, journal,
    resolvePort: vi.fn(async (binding: NotesTableBinding) => ({ binding: clone(binding), resourceId: "notes-db-edit:db", read: async () => clone(snapshot()), rows: async () => {
      if (faults.rows) throw new Error("Rows unavailable"); const visible = [...rows.values()].filter(row => row.title.toLowerCase().includes(binding.query.query.toLowerCase()));
      return { binding: clone(binding), revision, rows: clone(visible.slice(0, binding.query.limit)), total: visible.length, nextCursor: null };
    }, provider: { commit, lookupOperation: lookup }, beforeSubmit: async (ticket: NotesResourceRecovery) => { if (faults.ticket) throw new Error("Ticket quota failed"); tickets.set(ticket.request.operationId, clone(ticket)); }, beforeLookup: async (ticket: NotesResourceRecovery) => { tickets.set(ticket.request.operationId, clone(ticket)); }, releaseTerminal: async (ticket: NotesResourceRecovery) => { const receipt = await lookup(ticket.request.resourceId, ticket.request.operationId); if (!["denied", "conflict"].includes(receipt.status)) throw new Error("Not terminal"); tickets.delete(ticket.request.operationId); } }))
  };
  return { host, journal, rows, stored, tickets, receipts, faults, commit, lookup, snapshot, bumpRevision: () => { revision = "r" + (Number(revision.slice(1)) + 1); }, bumpSchema: () => { schemaRevision = "changed"; revision = "schema-parent-changed"; } };
}
