# Notes workspace local candidate 0.3.0-notes.7

This is an immutable local integration candidate, not an npm release or a completed application migration. It builds on the separately protected quiet-review UI candidate .6. Main, .0–.6 acceptance artifacts and existing application records remain intact.

The BlockNote package adds the public `@hello-ai-company/editor-blocknote/notes` entry for presentation configuration, scoped host contracts, document controllers, property definitions, layout state and independently authored drawing/shared-block features. `@hello-ai-company/editor-blocknote/react` exports the Notes workspace, both sidebar families, insertion picker, row/property/schema UI, tabs/splits/preview, mode adapters, conflict review and proposal presentation.

Hosts supply authorized canonical reads, per-command capabilities and persistence semantics. Every write requires captured scope and revisions, a durable recovery ticket, exact reviewed payload, history and canonical operation evidence. Unknown results retain input and require lookup; local absence must never be presented as a remote fence. Config and visible controls do not grant permission.

Body/title and local forms remain separate drafts. Pending comment/property/schema/HTML-source inputs block navigation, survive component unmount while their controller lives, and may be explicitly cancelled or backed up. A matching operation and draft version clears only its own input; later input survives delayed acknowledgment. Optional host draft storage is required for session restart durability.

The example `?notes=synthetic` uses isolated synthetic IndexedDB records and public components. It has no authentication, user data, paid provider or external traffic. Its test-only receipts do not establish production readiness. Optional media/shared/database insertion controls appear only when matching scoped providers and schema bindings exist.

Read the bundled `NOTES-WORKSPACE-HOST.md` and `NOTES-WORKSPACE-ACCEPTANCE.md` before connecting an application. The acceptance matrix distinguishes public functionality, fixture evidence, preservation-only legacy records and unconnected services. Real host transactions/auth/storage, several specialized legacy block editors and full configured application parity remain completion gates. Do not delete old application UI or data based on this candidate.

No push, merge, publication, deployment, credentials/security change or paid model call is part of this migration candidate.
