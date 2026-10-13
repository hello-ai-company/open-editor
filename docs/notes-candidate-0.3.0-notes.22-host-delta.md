# .22 host delta

Use the four local candidate tarballs together: editor-blocknote, editor-ai, editor-canvas, editor-publish. Core peer remains the existing ^0.2.0. This is not a registry release; accepted .21 and trial assets remain frozen.

`createNotesDocumentWidgetsFeature()` now installs `createInteractiveWidgetInputExtension()` (also exported by the root entry). Notes presets already include that feature. This covers host-owned Whiteboard factories rendering `NotesDrawingWidget` even if their factory has default selectable metadata. Hosts constructing standalone schemas without that feature can add the public extension to editor extensions or use the common block factories. Do not register the same extension twice. Controls are matched by scoped widget classes; ordinary inline content and drag/drop are excluded.

Native common factories now set non-selectable metadata for Drawing, Shared, legacy editable widgets, Columns, HTML, pageCard, childPage, pageTransclusion, databaseView and status. No stored block type/props/payload/version, capabilities, wire commands or host persistence contract changes. Width updates remain named property edits; Add text changes only the explicitly empty column's children.

PA separately owns `personal-ai-code-css-host-candidate/mac-evidence/code-css/host-code-scope.patch`: scope legacy `.ProseMirror pre` to `:where(.editorSurface) .ProseMirror pre` while retaining specificity. Apply only that product patch, not its audit routing scaffold. SDK Code supplies its own dark parent background. Shared SDK never edits PA host CSS or restarts trial5331.

DB37/#57 body-writer integration is deferred; .22 does not supply or grant the pending journal/writer API. Do not infer table write support from a read-only database view. Keep disabled media, remote shared blocks, external image sources and DB insertions disabled until their existing bindings and grants are actually supplied.
