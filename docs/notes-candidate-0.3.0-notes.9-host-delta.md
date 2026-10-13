# PA .8 to OE .9 — reviewable integration delta

PA host evidence was read only from `personal-ai-notes8-host/mac-evidence/notes8-host/HANDOFF.md`. It records API56/Web469/Chrome26, partial canonical paragraph/Canvas/tab-layout/text-row/metadata/tree/attachment-reference integration. These are PA .8 results, not .9 production acceptance. Its existing process, data, keys and source files were not changed by this OE task.

## Standalone width

The public components already fill the consuming container. The PA trial's `apps/web/src/features/notesMigration/trial.css` currently gives `.notesMigrationTrial` `padding-left:268px` while its standalone trial renders no global PersonalAI sidebar. **Remove that padding in the host trial** to meet the user's full-width request there too. Do not reproduce the blank reserve in production OpenEditor. Actual embedded PersonalAI sidebar/grid owns its own real width. `hostFrame=reference` belongs only to OE's explicit synthetic screenshot-comparison URL, not the public Notes API.

OE standalone local URL: `http://127.0.0.1:5199/?notes=synthetic&classic&baseline`. Reference-only URL adds `&hostFrame=reference`. The synthetic database is separately named `css-baseline9-v2`; old fixtures remain intact.

## Explicit appearance binding

PA's current `notes_pages.py` allowlist accepts `tags`, `category`, `favorite`, `icon`; it rejects host-managed/unbound keys such as `privacy` and currently `style`/`cover`. `host.ts` projects authorized metadata and advertises scoped `metadata.patch` with test-only semantics. This permits a reviewed binding of **icon and tags only**, while preserving scope/revision/receipt checks:

```tsx
import type { NotesPageAppearanceOptions } from '@hello-ai-company/editor-blocknote/react';
const pageAppearance: NotesPageAppearanceOptions = {
  fields: { icon: 'icon', tags: 'tags' },
};
// Pass pageAppearance to NotesTabbedWorkspace; do not bind style/cover yet.
// The host's custom renderModes must also pass classic to NotesWorkspaceModes.
```

The PA trial currently provides custom `renderModes` without `classic`; explicitly pass it so the .9 combined toolbar renders. Continue passing its session-owned Canvas controller and existing `beforeModeChange` body/Canvas fences. Do not substitute config changes for canonical server validation.

To enable style later, define its enum/field projection and authorization, atomically persist the named style change with revision/CAS/history/operation receipt, test denied/unknown/reload behavior, then map `fields.style`. Cover requires an authorized resource/provider/picker and metadata contract; `renderCoverControl` receives `editable` and the mapped value, but neither grants upload rights nor invents a signing key. Existing upload-signing blockage stays with the host owner.

## Remaining ownership and gates

| Scope | OE responsibility | PA host responsibility / remaining gate |
|---|---|---|
| Document Info/Library | Rich public presentation, metadata fields, backlink/related sections and exact measured layout remain incomplete | Project authorized summaries/categories/privacy/relations/DB counts; do not fabricate records |
| DB studio | Public UI/rendering/fixtures for all bound views/properties and row drawer remain incomplete | Current canonical text-column-only writer is preserved; bind schema, other types, row lifecycle/body with server CAS/history/receipts |
| Cover/icon/gallery | Distinct icons, searchable picker, cover banner/native gallery remain public UI gaps | Cover providers/resources need explicit authorization and safe projection; no key changes |
| Secretary suggestions | Existing `NotesProposalRail`/review contracts must be mounted and visually accepted in Notes | Connect the actual scoped proposal/revision/commit/reject/Undo adapters; production model transport remains unverified |
| History/media/templates/shared | Public dialog/panel behavior and original presentation need further acceptance | Keep canonical records and original bytes; bind providers and restore transactions without implicit deletion |
| Global chrome | Standalone has no artificial left reserve; Notes fills host container | Real PersonalAI routing/sidebar/search stays owned by the host |

All 59 PA feature-acceptance rows remain pending and original UI/data deletion permission remains zero. Do not categorize portable presentation omissions as host-owned completion. Do not broaden the existing metadata allowlist, enable unsupported widgets or declare autosave solely to make the screen look available.
