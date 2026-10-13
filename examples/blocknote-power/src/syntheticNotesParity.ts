import type { JsonValue } from "@hello-ai-company/editor-core";
import { NOTES_DATABASE_PROPERTY_KINDS, type NotesDatabasePropertyAdapters } from "@hello-ai-company/editor-blocknote/notes";
import type { NotesPropertyOptionsHost, NotesAssistanceService } from "@hello-ai-company/editor-blocknote/react";

/** Separate, explicitly selected synthetic fixture. None of these are real assets/actors/provider results. */
export const syntheticParityDefinitions = NOTES_DATABASE_PROPERTY_KINDS.map(type => ({ id: type === "text" ? "name" : type === "number" ? "score" : type, name: type, type,
  ...(["select", "status", "multi_select"].includes(type) ? { options: [{ id: "a", label: "計画" }, { id: "b", label: "確認" }] } : {}),
  ...(type === "button" ? { config: { actionId: "synthetic-confirm", label: "合成アクションを実行" } } : {})
}));
export const syntheticParityValues: Record<string, JsonValue> = {
  name: "合成の行", score: 42, select: "a", multi_select: ["a"], status: "a", date: "2026-10-08", user: [{ id: "synthetic-user", label: "合成ユーザー" }], files: [{ assetId: "synthetic-file", name: "合成ファイル" }], checkbox: false,
  url: "https://example.invalid/synthetic", email: "synthetic@example.invalid", phone: "000-0000", formula: 84, relation: ["row-2"], rollup: 12, created_time: "2026-10-08T00:00:00Z", created_by: "合成ユーザー", last_edited_time: "2026-10-08T00:00:00Z", last_edited_by: "合成ユーザー", button: null, location: { latitude: 35, longitude: 139, label: "合成の位置" }, id: "synthetic-row"
};
export const syntheticParityAdapters: NotesDatabasePropertyAdapters = {
  user: { pick: async () => [{ id: "synthetic-picked-user", label: "選択した合成ユーザー" }] }, files: { pick: async () => [{ assetId: "synthetic-picked-file", name: "選択した合成ファイル" }] }, relation: { pick: async () => ["row-2"] }, location: { pick: async () => ({ latitude: 36, longitude: 140, label: "選択した合成の位置" }) }
};
export const syntheticParityAssistance: NotesAssistanceService = {
  allowWeb: true,
  async run(request) {
    // No network, actual web retrieval or provider use. Honor cancel before returning a projection.
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    if (request.signal.aborted) throw new Error("Synthetic cancelled");
    return { scope: request.scope, target: request.target, revision: request.revision, text: `合成の回答: ${request.query}${request.includeWeb ? " · Web指定も合成です" : ""}`, hits: request.kind === "search" ? [{ id: "synthetic-hit", target: { kind: "row", databaseId: "synthetic-db", rowId: "row-1" }, title: "合成データベースの行", excerpt: "権限確認済みの合成抜粋" }] : [] };
  }
};

export const syntheticParityPropertyOptions: NotesPropertyOptionsHost = {
  async read(request) {
    if (request.signal.aborted || request.target.kind !== "row" || request.target.databaseId !== "synthetic-db") throw new Error("Synthetic scope mismatch");
    const adapter = syntheticParityAdapters[request.definition.type as keyof typeof syntheticParityAdapters];
    const value = request.definition.config?.valueMode === "legacy-text" ? "選択した旧形式の文字列" : request.definition.config?.valueMode === "legacy-files" ? [{ url: "https://example.invalid/synthetic-file", name: "選択した旧形式のファイル", kind: "file", size: 12 }] : await adapter?.pick({ definition: request.definition, value: null, signal: request.signal });
    return { scope: request.scope, target: request.target, propertyId: request.definition.id, valueMode: (request.definition.config?.valueMode ?? "reference") as "reference" | "legacy-text" | "legacy-files", choices: request.query && !"許可された合成の選択".includes(request.query) || value === undefined ? [] : [{ id: "synthetic-choice", label: "許可された合成の選択", value }] };
  }
};
