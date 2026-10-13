# Additive .19 host contract

## Page icons

Bind `pageAppearance.fields.icon` explicitly, e.g. `icon`. The existing `metadata.patch` path stores strings, including `lucide:book-open` and existing emoji, under CAS/receipt guards. All .19 tokens fit the existing host's 100-character bound. `""` means removal. No descriptor object, raw SVG, schema migration or second write path is introduced.

`NotesPageIcon` is exported from `@hello-ai-company/editor-blocknote/react` for other host-owned lists. Render it as a decorative icon beside an accessible page title. Known `lucide:<slug>` tokens render fixed catalog SVG. Unknown tokens and old values remain escaped text; do not rewrite or erase them.

`NotesWorkspace` presents the configured canonical metadata string through its existing scoped snapshot cache without new reads. It preserves empty removal and checks actor/workspace/page identity. For unread catalog pages, especially beyond the existing first-100 snapshot cache, the host should expose `page.icon = metadata[configuredIconKey]` in `readWorkspace`/search/load-more DTOs. The existing host catalog digest already includes metadata; adding this read-only field avoids new N+1 requests. Do not guess an unconfigured metadata key or optimistically display an unconfirmed patch.

## Insertions

`NotesEditorBridge.insert(kind, signal, options)` has additive `options.anchor?: { blockId: string; placement: "before" | "after" }`. `table` dimensions remain integers 1..5. `NotesInsertRequest.anchor` retains this context through a picker. `NotesInsertEditor.insertBlocks` accepts an optional fourth `placement` argument; existing 3-argument callbacks remain source-compatible. Hosts sending an anchor must honor the placement or use the standard writer.

The standard writer owns drop coordinates and uses the existing schema and `editor.insertBlocks`, not JSON/text replacement. Tokens are ephemeral and tied to controller, scope and target; no global browser broadcast, arbitrary external payload or extra POST is accepted. Undo history is separated before/after direct blocks, columns, picker blocks and inline links. Saving remains an explicit controller/host action with the existing archive and receipt guarantees.

Installed blocks do not grant persistence or media/database access. The current PersonalAI host admits only its known block binder; code/media/columns etc. can be local unsaved drafts and may be refused by that host. Never broaden `canSaveKnown`, lose unknown originals or declare every catalog item persistable. Optional picker providers remain authorized and explicit; .19 makes no paid call.

## Existing .18 behavior

Sidebar/drawer ownership, standalone full-width layout, Split navigation/TAG, fixed save feedback, pointer/keyboard focus, theme tab colors, hover adjacency, fresh mode guards and no-op active tab/mode behavior remain in place. `.19` does not change trialTools or database providers. The host already gates the former database-below-editor trial widget behind `trialTools=1`; normal page flows should omit that parameter, retaining actual database blocks/navigation.
