# Cross-mode compatibility

The modes serve different purposes. Document is the interactive editing surface; Canvas previews semantic blocks in a responsive layout; Present and Site use the static Publish allowlist. Static modes do not resolve private workspace IDs or fetch host metadata and database rows.

| Content | Document | Canvas preview | Present | Site |
| --- | --- | --- | --- | --- |
| Paragraphs, headings, quotes, code, images, callouts, status | Interactive editor blocks | Static semantic projection | Allowlisted static projection | Allowlisted static projection |
| Bullet and numbered lists | Interactive editor blocks | Static semantic lists | Allowlisted static lists | Allowlisted static lists |
| Checklist items | Interactive editor block | Static disabled checkbox and label | Omitted by Publish allowlist | Omitted by Publish allowlist |
| Tables | Interactive table editor | Static cell-text table, capped at 40 rows × 12 columns and 300 characters per cell; formatting and merges are not preserved | Omitted by Publish allowlist | Omitted by Publish allowlist |
| Page mentions/cards, transclusions, block references, database relations | Host-backed references where configured | Visible text or `titleHint`; otherwise a generic safe placeholder; no raw IDs or host reads | Omitted by Publish projection | Omitted by Publish projection |
| `databaseView` | Host-backed database view | Explicit placeholder; never fetches rows | Omitted by Publish allowlist | Omitted by Publish allowlist |
| Unsupported or private blocks | Depends on the installed schema and host policy | Generic static placeholder from visible text or `titleHint` | Omitted by Publish projection | Omitted by Publish projection |

If a Site or Present Canvas layout points to a block excluded by the Publish projection, the layout shows `Content unavailable.` The placeholder does not reveal the excluded block's metadata. Publication allowlist changes require their own privacy review and tests.

## R4 recommendation

Keep collaboration records host-owned. Add comment threads anchored to stable block IDs and document revisions, append-only history/provenance for accepted changes, and Agent proposals tied to a base revision. Require human acceptance before applying proposals; let the host enforce authorization, persistence, and retention. Keep these records outside `EditorDocument` until a concrete portable contract is needed.
