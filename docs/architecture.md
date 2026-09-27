# Architecture

OpenEditor uses a small portable document core with separate editing, AI, canvas, publishing, and host-integration layers. `EditorDocument` schema version 1 remains the semantic document format; view and host state stay outside it.

## Packages

| Package | Responsibility |
| --- | --- |
| `@hello-ai-company/editor-core` | Versioned document model, JSON validation/serialization, and optional host provider types |
| `@hello-ai-company/editor-blocknote` | BlockNote editing adapter, workspace primitives, commands, and instance-scoped feature registry |
| `@hello-ai-company/editor-ai` | Agent contracts, suggestion validation/application, provenance results, and explicit learning decisions |
| `@hello-ai-company/editor-canvas` | Responsive layout specs that reference semantic block IDs, theme tokens, Magic Layout, and derived slide groupings |
| `@hello-ai-company/editor-publish` | Allowlisted static HTML rendering and a public knowledge projection |

The AI, canvas, and publishing packages are experimental and have not been published. They are not dependencies of `editor-core` or `editor-blocknote`.

## Data boundaries

- The core document stays `{ schemaVersion: 1, blocks }`. Its wire shape is unchanged; validators and clone helpers now reject cyclic or over-limit structures (20,000 blocks, 128 block levels, 50,000 JSON nodes, 128 JSON levels).
- Block IDs are stable references. Canvas nodes point to those IDs rather than copying block content. Hosts own persistence for canvas and other view settings.
- Knowledge indexes, comments, and versions use provider seams or host storage. The core does not own a backend or a workspace-wide database.
- AI output is untrusted. `editor-ai` validates a complete suggestion against a base document and produces a changed document only after an explicit accept decision. Stale proposals return without a document mutation.
- Provenance and learning signals are returned as host-owned records; they are not injected into document JSON or automatically persisted.
- Public rendering uses a semantic allowlist and omits hidden/private content. It does not execute arbitrary HTML, JavaScript, CSS, or embeds.

## Personal AI boundary

Personal AI implements its own adapter outside OpenEditor. Its current bridge routes explicit user instructions through Secretary Work Intake. The bridge does not create `AgentTask` records directly, run tools, or send document content through an endpoint that cannot represent untrusted context separately. Personal AI and its policy/runtime modules are not dependencies of OpenEditor.

## Compatibility

`editor-core` remains host-neutral and schema version 1. `editor-blocknote` targets BlockNote `^0.54.2`. Additions in this work are in separate package surfaces or additive BlockNote helpers; package publication is outside this change.
