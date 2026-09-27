# Migration notes

This change does not alter `editor-core`'s `EditorDocument` wire shape, schema version, serializer, or provider contracts. Existing documents need no migration.

`editor-blocknote` remains on BlockNote `^0.54.2`. Its feature registry and dialog focus handling are additive. The new `editor-ai`, `editor-canvas`, and `editor-publish` packages are experimental, unpublished, and opt-in; they do not enter the core or BlockNote initial surface.

Personal AI already consumes the published `editor-blocknote@0.1.0` and `editor-core@0.1.1` through the npm registry and uses BlockNote `^0.54.2`. Its shadow mount remains feature-gated. The Secretary bridge creates work through Work Intake and leaves task execution to Personal AI. No document-content migration is required.

The current patch removes the GPL/proprietary `@blocknote/xl-multi-column` dependency and its integration. Existing multi-column note documents need an explicit migration/compatibility review before that removal is merged; the new editor-canvas package does not yet translate those stored blocks.
