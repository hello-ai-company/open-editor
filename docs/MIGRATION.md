# Migration notes

This change does not alter `editor-core`'s `EditorDocument` wire shape, schema version, serializer, or provider contracts. Existing documents need no migration.

`editor-blocknote` remains on BlockNote `^0.54.2`; `0.1.1` is a reviewed candidate, while `0.1.0` remains the published release. Its feature registry and dialog focus handling are additive. `editor-ai@0.1.0`, `editor-canvas@0.1.0`, and `editor-publish@0.1.0` are experimental candidates, unpublished, and opt-in; they do not change the core document schema or BlockNote initial surface.

Personal AI consumes `editor-core@0.1.1` and `editor-blocknote@0.1.0` from npm today. Its R3 source adds `editor-ai`, `editor-canvas`, and `editor-publish` registry ranges, but those target versions are not published yet; the lockfile and hosted install must be refreshed after the ordered OpenEditor releases. The R3 note workspace persists Canvas metadata without changing `EditorDocument.schemaVersion: 1`. No document-content migration is required.

The BlockNote candidate has no `@blocknote/xl-*` dependency or copied XL source. Existing multi-column note documents are decoded as native columns and round-trip through note persistence. The historical fixture passed browser edit/save/reload with column order and widths preserved; evidence remains in Personal-AI's `docs/evidence/r3/legacy-columns-1440-layout-passing-sanitized.png`. The locked runtime dependency review found no GPL-only package.
