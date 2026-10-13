# Notes .19 — insertion examples, drag placement and page icons

This local candidate builds on accepted `a5cbfc3` / `.18`. It is a separate branch and package; `.18` source, dist, tarballs and previous CRUD work remain intact. No publish, push, merge, deployment or paid API call occurred.

- The right insertion rail shows static miniature examples of the corresponding block. Pointer transfer, leave, Escape and keyboard focus work without executing HTML/JS or fetching media.
- Supported insertion buttons drag real schema blocks before/after the block at the drop coordinates. A marker shows the location. The scoped, in-process token is one-use; source loss, document/revision/body changes and cancellation invalidate it. Existing BlockNote transactions and isolated Undo history publish through the same body writer.
- Asynchronous URL/page/media/database pickers retain the explicit anchor and recheck scope, revision, selection, pending inputs, recovery and IME before editing. Cancel and invalid drops leave the body intact.
- Document, Canvas, Present and Site use one Lucide stroke family, accessible names and restrained hover/focus labels. Narrow/coarse-pointer layouts keep visible labels. Create Website keeps a short label because its meaning is less obvious.
- The page picker offers 98 line icons plus 24 emoji, search and categories, modal keyboard focus and Escape restoration. The title, tree, library and hover use the same renderer; a cover thumbnail retains an icon badge. Existing emoji, empty removal and unknown strings are preserved.

Selected static SVG data comes from the host's installed Lucide 0.468.0. No runtime dependency was added. ISC and Feather MIT notices are in the source and emitted JS; the build also shifts the source map to preserve mappings. The extraction script uses TypeScript AST parsing rather than evaluating upstream modules.

Verification and material limits are in the adjacent `-verification.md` and `-pa-contract.md`. Original port49290 stopped during verification; .19 checks use an isolated SQLite backup and the same read-only host source at5208. The original .18 service was subsequently restored at49290 with its original saved store, preserving installed files and avoiding automatic reconnection reloads. This does not establish `.19` adoption or the user’s current screen contents. The production example and SDK also ship a separate icon license notice; downstream bundled distributions must retain it.
