import type { EditorBlock, EditorDocument } from '@hello-ai-company/editor-core';
import { acceptSuggestionGroup, parseSuggestionGroup, type SuggestionChange } from './suggestions.js';
import { parseEditorDocument } from './validation.js';

/** Provider-visible context contains only explicitly selected, eligible rich blocks. */
export type AgentChatDocumentContext = { blocks: EditorBlock[]; fingerprint: string };
/** Full local snapshot. Never include this in a provider request. */
export type AgentChatDocumentSource = { document: EditorDocument; fingerprint: string };
export type AgentChatDocumentProposal = {
  source: AgentChatDocumentSource;
  selectedBlockIds: string[];
  title: string;
  changes: SuggestionChange[];
};
export type AgentChatDocumentProposalResponse = Pick<AgentChatDocumentProposal, 'title' | 'changes'>;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function stable(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}
// This deliberately narrow schema matches the host's lossless canonical codecs.
// Toggle/status/page-break lack a host binding. Native divider writes require a
// separately bound existing divider, so they are not general rich-edit targets.
const textTypes = new Set(['paragraph', 'heading', 'quote', 'bulletListItem', 'numberedListItem', 'checkListItem', 'codeBlock', 'callout']);
const alignments = ['left', 'center', 'right', 'justify'];
const colors = ['default', 'gray', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
const marks = ['bold', 'italic', 'underline', 'strike', 'code'];
const record = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === 'string' && descriptor.enumerable && 'value' in descriptor;
  });
};
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const boundedText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
const member = (value: unknown, values: readonly string[]): boolean => typeof value === 'string' && values.includes(value);
const integer = (value: unknown, min: number, max: number): boolean => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
function textRun(value: unknown, plain = false): boolean {
  return record(value) && value.type === 'text' && keys(value, ['type', 'text', 'styles']) && boundedText(value.text, 16000) &&
    (value.styles === undefined || record(value.styles) && Object.entries(value.styles).every(([key, style]) =>
      !plain && (marks.includes(key) ? typeof style === 'boolean' : ['textColor', 'backgroundColor'].includes(key) && member(style, colors))));
}
function safeLink(value: unknown): boolean {
  if (!boundedText(value, 2000) || /[\\\u0000-\u0020\u007f-\u009f\s]/.test(value)) return false;
  const match = /^https?:\/\/([^/?#]+)([/?#].*)?$/i.exec(value);
  if (!match) return false;
  const authority = match[1]!.split(':');
  if (authority.length > 2) return false;
  const [host, port] = authority;
  if (!host || host.length > 253 || port !== undefined && (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535)) return false;
  const labels = host.split('.');
  if (labels.some(label => /^xn--/i.test(label) || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return false;
  return !/^(?:[0-9]+|0x[0-9a-f]*)$/i.test(labels.at(-1)!) || labels.length === 4 && labels.every(label => /^(?:0|[1-9][0-9]{0,2})$/.test(label) && Number(label) <= 255);
}
function inline(value: unknown, plain = false): boolean {
  if (typeof value === 'string') return boundedText(value, 16000);
  if (!Array.isArray(value) || value.length > 2000) return false;
  let text = '', rich = false;
  for (const item of value) {
    if (textRun(item, plain)) {
      text += item.text;
      rich ||= record(item.styles) && Object.keys(item.styles).some(key => ['textColor', 'backgroundColor'].includes(key));
    } else if (!plain && record(item) && item.type === 'link' && keys(item, ['type', 'href', 'content']) && safeLink(item.href) &&
      Array.isArray(item.content) && item.content.length <= 2000 && item.content.every(child => textRun(child))) {
      const label = item.content.map(child => child.text).join('');
      if (!label) return false;
      text += label;
      rich = true;
    } else return false;
  }
  // The canonical owner inline codec cannot persist link/color hard breaks.
  return !rich || !/[\r\n]/.test(text);
}
function tableInline(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 2000 && value.every(item => record(item) && textRun(item) && boundedText(item.text, 10000) &&
    (item.styles === undefined || record(item.styles) && keys(item.styles, marks)));
}
function properties(block: EditorBlock): boolean {
  if (block.props === undefined) return true;
  if (!record(block.props)) return false;
  if (block.type === 'oeColumns') return keys(block.props, ['gap']) && (block.props.gap === undefined || block.props.gap === 16);
  if (block.type === 'oeColumn') return keys(block.props, ['width']) && (block.props.width === undefined || typeof block.props.width === 'number' && Number.isFinite(block.props.width) && block.props.width >= .1 && block.props.width <= 10);
  const extra = block.type === 'heading' ? ['level', 'isToggleable'] : block.type === 'checkListItem' ? ['checked'] : block.type === 'numberedListItem' ? ['start'] : block.type === 'codeBlock' ? ['language'] : block.type === 'callout' ? ['variant', 'title'] : [];
  if (!keys(block.props, ['textAlignment', 'backgroundColor', 'textColor', ...extra])) return false;
  return Object.entries(block.props).every(([key, value]) => {
    if (key === 'textAlignment') return block.type === 'codeBlock' || block.type === 'table' ? value === 'left' : member(value, alignments);
    // Block-level colors have no canonical host field. Inline color tokens do.
    if (key === 'backgroundColor' || key === 'textColor') return value === 'default';
    if (key === 'level') return integer(value, 1, 3);
    if (key === 'isToggleable') return value === false;
    if (key === 'checked') return typeof value === 'boolean';
    if (key === 'start') return integer(value, 1, 999999999);
    if (key === 'language') return typeof value === 'string' && /^[A-Za-z0-9_+.-]{1,80}$/.test(value);
    if (key === 'variant') return member(value, ['info', 'warning', 'success', 'danger']);
    return key === 'title' && boundedText(value, 500);
  });
}
function table(value: unknown): boolean {
  if (!record(value) || value.type !== 'tableContent' || !keys(value, ['type', 'rows', 'columnWidths', 'headerRows', 'headerCols']) || !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 50) return false;
  const first = value.rows[0];
  if (!record(first) || !Array.isArray(first.cells)) return false;
  const width = first.cells.length;
  if (width < 1 || width > 20) return false;
  if (value.columnWidths !== undefined && (!Array.isArray(value.columnWidths) || value.columnWidths.length !== width || value.columnWidths.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 4096)))) return false;
  if (value.headerRows !== undefined && !integer(value.headerRows, 0, value.rows.length) || value.headerCols !== undefined && !integer(value.headerCols, 0, width)) return false;
  return value.rows.every(row => record(row) && keys(row, ['cells']) && Array.isArray(row.cells) && row.cells.length === width && row.cells.every(cell => {
    if (Array.isArray(cell)) return tableInline(cell);
    if (!record(cell) || cell.type !== 'tableCell' || !keys(cell, ['type', 'content', 'props']) || !tableInline(cell.content)) return false;
    return cell.props === undefined || record(cell.props) && Object.entries(cell.props).every(([key, prop]) =>
      key === 'colspan' || key === 'rowspan' ? integer(prop, 1, 50) : key === 'textAlignment' ? member(prop, alignments) : ['backgroundColor', 'textColor'].includes(key) && member(prop, colors));
  }));
}
function eligible(block: EditorBlock, depth = 0, parentType?: string): boolean {
  if (depth > 12 || !record(block) || !keys(block, ['id', 'type', 'props', 'content', 'children']) || typeof block.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(block.id)) return false;
  if (!textTypes.has(block.type) && !['table', 'oeColumns', 'oeColumn'].includes(block.type) || !properties(block)) return false;
  const children = block.children ?? [];
  if (!Array.isArray(children) || children.length > 100) return false;
  if (block.type === 'oeColumns') {
    if (block.content !== undefined || children.length < 2 || children.length > 6 || children.some(child => child.type !== 'oeColumn')) return false;
  } else if (block.type === 'oeColumn') {
    if (parentType !== 'oeColumns' || block.content !== undefined) return false;
  } else if (block.type === 'table') {
    if (children.length || !table(block.content)) return false;
  } else if (block.content !== undefined && !inline(block.content, block.type === 'codeBlock') || block.type === 'codeBlock' && children.length) return false;
  return children.every(child => eligible(child, depth + 1, block.type));
}
function label(block: EditorBlock): string {
  const value = block.content;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => record(item) && typeof item.text === 'string' ? item.text : record(item) && Array.isArray(item.content) ? item.content.map(x => record(x) && typeof x.text === 'string' ? x.text : '').join('') : '').join('');
  if (block.type === 'oeColumns') return `${block.children?.length ?? 0} columns`;
  if (block.type === 'callout' && typeof block.props?.title === 'string') return block.props.title;
  return block.type === 'table' ? 'Table' : block.type;
}
/** Only whole root subtrees with an understood, visibly reviewable schema qualify. */
export function agentChatDocumentTargets(document: EditorDocument): Array<{ id: string; type: string; text: string }> {
  try { parseEditorDocument(document); } catch { return []; }
  return document.blocks.filter(block => eligible(block) && JSON.stringify(block).length <= 40000).map(block => ({ id: block.id, type: block.type, text: label(block) }));
}
export function agentChatDocumentSource(document: EditorDocument): AgentChatDocumentSource {
  if (JSON.stringify(document).length > 300000) throw Error('The document is too large for a reviewed rich proposal');
  parseEditorDocument(document); // fail closed on malformed/duplicate identities without changing the captured bytes
  return { document: copy(document), fingerprint: JSON.stringify(document) };
}
export function agentChatDocumentContext(document: EditorDocument, blockIds: string[]): AgentChatDocumentContext {
  if (!Array.isArray(blockIds) || !blockIds.length || blockIds.length > 20 || new Set(blockIds).size !== blockIds.length) throw Error('Explicitly choose 1–20 rich blocks');
  const targets = new Set(agentChatDocumentTargets(document).map(block => block.id));
  if (blockIds.some(id => !targets.has(id))) throw Error('A selected block is unknown, private or not eligible for rich editing');
  // Canonical document order, independent of checkbox click order.
  const blocks = document.blocks.filter(block => blockIds.includes(block.id));
  const fingerprint = JSON.stringify(blocks);
  if (fingerprint.length > 80000) throw Error('The selected rich context is too large');
  return { blocks: copy(blocks), fingerprint };
}
/** Pure preview. No editor writes, network, tools, or acceptance receipts are produced. */
export function previewAgentChatDocumentProposal(proposal: AgentChatDocumentProposal): EditorDocument {
  if (!proposal || !proposal.source || typeof proposal.source.fingerprint !== 'string' || JSON.stringify(proposal.source.document) !== proposal.source.fingerprint) throw Error('The document proposal source is invalid');
  agentChatDocumentSource(proposal.source.document);
  const context = agentChatDocumentContext(proposal.source.document, proposal.selectedBlockIds);
  if (typeof proposal.title !== 'string' || !proposal.title.trim() || proposal.title.length > 256 || !Array.isArray(proposal.changes) || !proposal.changes.length || proposal.changes.length > 40) throw Error('The rich document proposal is invalid or too large');
  const allowed = new Set<string>(), completed = new Set<string>();
  const visit = (blocks: EditorBlock[], callback: (block: EditorBlock) => void): void => { for (const block of blocks) { callback(block); visit(block.children ?? [], callback); } };
  visit(context.blocks, block => {
    allowed.add(block.id);
    if (block.type === 'checkListItem' && block.props?.checked === true) completed.add(block.id);
  });
  const group = parseSuggestionGroup({ schemaVersion: 1, id: 'agent-chat-preview', title: proposal.title, baseDocument: proposal.source.document, changes: proposal.changes });
  for (const change of group.changes) {
    if (change.op !== 'insert' && !allowed.has(change.blockId)) throw Error('A proposal may only edit explicitly selected blocks');
    if ((change.op === 'insert' || change.op === 'replace') && !eligible(change.block, 0, change.block.type === 'oeColumn' ? 'oeColumns' : undefined)) throw Error('A proposal contains an unsupported or hidden block');
    if (change.op === 'insert' || change.op === 'move') {
      if (change.parentId && !allowed.has(change.parentId) || change.beforeId && !allowed.has(change.beforeId)) throw Error('A proposal destination is outside the reviewed selection');
      if (!change.parentId && !change.beforeId) throw Error('Root insertions and moves need an explicitly selected beforeId');
    }
  }
  // The existing generic acceptance helper is pure. Its synthetic preview provenance is discarded.
  const result = acceptSuggestionGroup(group, proposal.source.document, { acceptedBy: 'agent-chat-preview', acceptedAt: '1970-01-01T00:00:00.000Z', source: { agentId: 'agent-chat-preview', runId: 'agent-chat-preview', generatedAt: '1970-01-01T00:00:00.000Z' } });
  if (result.status !== 'accepted') throw Error('The document proposal source changed');
  const next = result.document, nextById = new Map<string, EditorBlock>(), originalIds = new Set<string>();
  visit(next.blocks, block => nextById.set(block.id, block));
  visit(proposal.source.document.blocks, block => {
    originalIds.add(block.id);
    if (!allowed.has(block.id) && stable(nextById.get(block.id)) !== stable(block)) throw Error('A proposal cannot change unselected, unknown or private blocks');
  });
  // Validate edited root subtrees in their final parent context, not individual
  // operations: a valid column cannot be left orphaned by a move/delete/replace.
  for (const block of next.blocks) {
    if ((allowed.has(block.id) || !originalIds.has(block.id)) && !eligible(block)) throw Error('A proposal creates unsupported rich content');
  }
  visit(next.blocks, block => {
    if ((allowed.has(block.id) || !originalIds.has(block.id)) && block.type === 'checkListItem' && block.props?.checked === true && !completed.has(block.id)) throw Error('A rich proposal cannot infer completed task state');
  });
  parseEditorDocument(next); // The complete resulting tree must have valid, unique identities.
  if (JSON.stringify(next).length > 300000) throw Error('The resulting document is too large');
  // Preserve the exact original representation of every unselected root subtree.
  const roots = new Map(proposal.source.document.blocks.map(block => [block.id, block]));
  next.blocks = next.blocks.map(block => !allowed.has(block.id) && roots.has(block.id) ? copy(roots.get(block.id)!) : block);
  return copy(next);
}
