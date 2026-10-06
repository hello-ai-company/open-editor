import type { EditorBlock, EditorDocument } from "@hello-ai-company/editor-core";
/** Deterministic, context-dependent fixture. This cannot assess real model reasoning quality. */
export function contextualQuietFixture(document: EditorDocument, runId: string) {
  const text = (value: unknown): string => typeof value === "string" ? value : Array.isArray(value) ? value.map(item => item && typeof item === "object" && "text" in item ? String(item.text) : "").join("") : "";
  const blocks: EditorBlock[] = [];
  const visit = (items: EditorBlock[]): void => { for (const block of items) { if (["heading", "paragraph"].includes(block.type) && text(block.content).trim()) blocks.push(block); if (block.children) visit(block.children); } };
  visit(document.blocks);
  const target = blocks.find(block => block.type === "heading") ?? blocks.at(-1);
  const subject = Array.from(text(target?.content).trim()).slice(0, 40).join("") || "この文書";
  return { hypothesis: `「${subject}」について、次に確認する点を整理すると役立つでしょうか？（合成例）`, group: {
    schemaVersion: 1, id: runId, title: "文脈に沿う確認案（合成例）", baseDocument: document,
    changes: [{ op: "insert", block: { id: crypto.randomUUID(), type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [{ type: "text", text: `次に確かめたいこと：「${subject}」の目的、判断に必要な根拠、次の確認先を整理する。`, styles: {} }] } }]
  } };
}
