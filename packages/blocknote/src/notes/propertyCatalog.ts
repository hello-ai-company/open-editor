import type { JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import { validateNotesPropertyValue, type NotesWritableProperty } from "../workspace/revisionedNotesResource.js";

/** Separate from the legacy seven-kind database renderer: no unknown type is coerced. */
export const NOTES_DATABASE_PROPERTY_KINDS = ["text", "number", "select", "multi_select", "status", "date", "user", "files", "checkbox", "url", "email", "phone", "formula", "relation", "rollup", "created_time", "created_by", "last_edited_time", "last_edited_by", "button", "location", "id"] as const;
export type NotesDatabasePropertyKind = typeof NOTES_DATABASE_PROPERTY_KINDS[number];
export type NotesDatabasePropertyOption = { id: string; label: string; color?: string };
/** Extra JSON keys are retained by parse and never included in a named-field update. */
export type NotesDatabasePropertyDefinition = {
  id: string; name: string; type: string; readOnly?: boolean;
  options?: readonly NotesDatabasePropertyOption[];
  config?: Record<string, JsonValue>;
  [key: string]: unknown;
};
export type NotesDatabaseSchemaSnapshot = { revision: string; properties: readonly NotesDatabasePropertyDefinition[] };
export type NotesUserReference = { id: string; label?: string };
export type NotesFileReference = { assetId: string; name?: string };
export type NotesLocationValue = { latitude: number; longitude: number; label?: string };
export type NotesHostedPropertyKind = "user" | "files" | "relation" | "location";
export type NotesPropertyPicker<T extends JsonValue = JsonValue> = {
  /** Called only by explicit user action. Return undefined on cancel. Scoped identities, not URLs/secrets. */
  pick(request: { definition: NotesDatabasePropertyDefinition; value: JsonValue; signal: AbortSignal }): Promise<T | undefined>;
};
export type NotesDatabasePropertyAdapters = {
  user?: NotesPropertyPicker<NotesUserReference[] | null>;
  files?: NotesPropertyPicker<NotesFileReference[] | null>;
  relation?: NotesPropertyPicker<string[] | null>;
  location?: NotesPropertyPicker<NotesLocationValue | null>;
};
export const NOTES_DATABASE_PROPERTY_LABELS: Readonly<Record<NotesDatabasePropertyKind, string>> = {
  text: "テキスト", number: "数値", select: "選択", multi_select: "複数選択", status: "ステータス", date: "日付", user: "ユーザー", files: "ファイル", checkbox: "チェックボックス", url: "URL", email: "メール", phone: "電話", formula: "計算式", relation: "関連", rollup: "集計", created_time: "作成日時", created_by: "作成者", last_edited_time: "更新日時", last_edited_by: "更新者", button: "アクション", location: "位置", id: "ID"
};
const authoritative = new Set<string>(["formula", "rollup", "created_time", "created_by", "last_edited_time", "last_edited_by", "id"]);
const hosted = new Set<string>(["user", "files", "relation", "location"]);
export function isNotesDatabasePropertyKind(type: string): type is NotesDatabasePropertyKind { return (NOTES_DATABASE_PROPERTY_KINDS as readonly string[]).includes(type); }
export function notesPropertyAuthority(definition: NotesDatabasePropertyDefinition): "editable" | "host-picker" | "host-computed" | "action" | "unknown" {
  if (!isNotesDatabasePropertyKind(definition.type)) return "unknown";
  if (definition.readOnly || authoritative.has(definition.type)) return "host-computed";
  if (definition.type === "button") return "action";
  return hosted.has(definition.type) ? "host-picker" : "editable";
}
function object(value: unknown): Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSONオブジェクトが必要です");
  return value as Record<string, JsonValue>;
}
function identity(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 512; }
function optionalLabel(value: JsonValue | undefined): boolean { return value === undefined || typeof value === "string" && value.length <= 4000; }
/** Unknown definitions remain inert, including their exact extra JSON fields. */
export function parseNotesDatabasePropertyDefinition(value: unknown): NotesDatabasePropertyDefinition {
  const safe = object(copyLegacyNotesJson(value));
  if (!identity(safe.id) || typeof safe.name !== "string" || !safe.name.trim() || safe.name.length > 256 || !identity(safe.type)) throw new Error("プロパティID・名前・種類を確認してください");
  if (safe.readOnly !== undefined && typeof safe.readOnly !== "boolean") throw new Error("読取専用の指定が不正です");
  if (!isNotesDatabasePropertyKind(safe.type)) return safe as unknown as NotesDatabasePropertyDefinition;
  if (safe.options !== undefined) {
    if (!Array.isArray(safe.options) || safe.options.length > 100 || safe.options.some(option => {
      const item = object(option);
      return !identity(item.id) || typeof item.label !== "string" || item.label.length > 256 || item.color !== undefined && (typeof item.color !== "string" || !/^[a-zA-Z0-9#_-]{1,32}$/.test(item.color));
    }) || new Set(safe.options.map(option => object(option).id)).size !== safe.options.length) throw new Error("選択肢のID・表示名が不正です");
  }
  if (safe.config !== undefined) {
    const config = object(safe.config);
    if (config.expression !== undefined && (typeof config.expression !== "string" || config.expression.length > 4000)) throw new Error("計算式を確認してください");
    for (const key of ["databaseId", "relationPropertyId", "targetPropertyId", "actionId"]) if (config[key] !== undefined && !identity(config[key])) throw new Error("設定の参照IDが不正です");
    if (config.aggregation !== undefined && (typeof config.aggregation !== "string" || !["count", "sum", "average", "min", "max"].includes(config.aggregation))) throw new Error("集計方法が不正です");
    if (config.numberFormat !== undefined && (typeof config.numberFormat !== "string" || !["number", "percent", "currency"].includes(config.numberFormat))) throw new Error("数値形式が不正です");
    if (config.currency !== undefined && (typeof config.currency !== "string" || !/^[A-Z]{3}$/.test(config.currency))) throw new Error("通貨は3文字のコードで指定してください");
    if (config.dateFormat !== undefined && (typeof config.dateFormat !== "string" || !["iso", "short", "long"].includes(config.dateFormat))) throw new Error("日付形式が不正です");
  }
  return safe as unknown as NotesDatabasePropertyDefinition;
}
/** No eval, coercion, asset fetch or loaded-row computation. Host authorizes every final patch. */
export function validateNotesDatabasePropertyValue(definition: NotesDatabasePropertyDefinition, value: unknown): JsonValue {
  const parsed = parseNotesDatabasePropertyDefinition(definition), authority = notesPropertyAuthority(parsed);
  if (authority === "unknown" || authority === "host-computed" || authority === "action") throw new Error("この値はホスト管理の読取専用です");
  const safe = copyLegacyNotesJson(value);
  if (safe === null) return null;
  if (authority === "editable") return validateNotesPropertyValue({ type: parsed.type === "checkbox" ? "boolean" : parsed.type as NotesWritableProperty["type"], optionIds: parsed.options?.map(option => option.id) }, safe);
  switch (parsed.type) {
    case "relation": if (Array.isArray(safe) && safe.length <= 100 && safe.every(identity) && new Set(safe).size === safe.length) return safe; break;
    case "user": case "files": {
      const key = parsed.type === "user" ? "id" : "assetId";
      if (!Array.isArray(safe) || safe.length > 100) break;
      if (safe.every(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        return identity(item[key]) && optionalLabel(item[parsed.type === "user" ? "label" : "name"]) && Object.keys(item).every(field => field === key || field === (parsed.type === "user" ? "label" : "name"));
      }) && new Set(safe.map(item => object(item)[key])).size === safe.length) return safe;
      break;
    }
    case "location": {
      if (!safe || typeof safe !== "object" || Array.isArray(safe)) break;
      if (Object.keys(safe).every(key => ["latitude", "longitude", "label"].includes(key)) && typeof safe.latitude === "number" && safe.latitude >= -90 && safe.latitude <= 90 && typeof safe.longitude === "number" && safe.longitude >= -180 && safe.longitude <= 180 && optionalLabel(safe.label)) return safe;
      break;
    }
  }
  throw new Error("プロパティの値が不正です。入力を保持しています");
}
