# Unpublished 0.3 candidate / immutable 0.2 compatibility

The npm 0.2 releases remain immutable; historical release records and frozen 0.2 BlockNote fixture are retained. The cumulative source adds public APIs/behavior, so BlockNote, AI, Canvas and Publish use new 0.3.0 candidate identities. Core source, runtime API, schemaVersion 1 and package version 0.2.0 are unchanged. No document migration or automatic host dependency upgrade is performed.

- Existing 0.2 consumers stay on their old ^0.2 ranges; those ranges do not silently select 0.3.
- New BlockNote keeps Core ^0.2.0, BlockNote ^0.54.2 and React 18/19 peers. Its ordinary root/react/notes entries remain usable without editor-ai.
- Only the opt-in `@hello-ai-company/editor-blocknote/agent-chat` entry needs `@hello-ai-company/editor-ai@^0.3.0`. AI 0.2 lacks these runtime APIs. Transcript persistence, auth/scope and actual model execution remain host owned; private chat is omitted from public projections.
- Canvas 0.3 uses Core ^0.2.0. Publish 0.3 uses Canvas ^0.3.0 plus Core ^0.2.0, with existing docx dependency unchanged.

The non-publishing preflight must validate exact reviewed exports, peers, files, lifecycle commands, licenses, packed inventory, isolated runtime/types and all existing quality gates. Guards continue rejecting altered metadata, unexpected files, registry ambiguity, already-published candidates and mismatched reviewed SHA. New candidate agent-chat/AI consumers install actual local tarballs, never workspace links or a silently substituted registry AI 0.2.

A future separately authorized release must verify registry state and follow dependency order (existing Core 0.2 proof, AI 0.3 and Canvas 0.3, BlockNote 0.3 and Publish 0.3). Optional AI must be published before recommending agent-chat installation. Existing main/ref/reviewed-SHA/manual-confirmation/environment/immutable-artifact gates remain. Core 0.2 must never be republished. Historical first-publication bootstrap is not the release path for already existing packages. This task does not dispatch workflows, publish npm, create tags/Releases, deploy or change credentials/access.

Verification limitations: synthetic SDK/consumer contracts are not actual model or host production acceptance. Personal AI vendor packages and its lockfile are not changed here. The repo has no lint command/config; type, unit, security, API, package/consumer and whitespace gates are used without inventing a linter.
