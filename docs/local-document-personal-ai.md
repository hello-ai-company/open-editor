# Local Document persistence and Personal-AI host contract

This follows OpenEditor PR31 (`0508598f7945412cc5b4740b41e5cd1c5db69bf1`),
which depends on PR30 (`9afd81847a5fabd0ba58169f1db2572ddf1bb681`).
The Personal-AI contract is pinned to PR119 at
`7b03a8ce39581e1f1cb65599d5c2d2dced5ca044`. Its source was obtained through
the GitHub API in a separate temporary copy; no Personal-AI source was modified.

## Three separate storage surfaces

| Surface | Stored data | Durability and scope |
| --- | --- | --- |
| Normal Document | Validated `EditorDocument` blocks, UUID, title, revision and timestamp | IndexedDB `open-editor.documents.v1`, separate actor/workspace keys. Survives reload and browser process restart in the same browser profile/origin. |
| Selected-context demo | Fixed synthetic text, proposal and undo lineage | Existing explicitly saved `open-editor.synthetic-selected-context.v1` state; remains independent of normal Document. External imports are preview-only. |
| Opt-in Personal-AI local test | Synthetic documents, approved synthetic memories, proposals and undo receipts | Separate local SQLite host on `127.0.0.1:8189`. No browser memory cache, production account, model generation, OAuth or cloud database. |

Normal Document loads before mounting the editor. Every actual block change is
saved after a short coalescing delay; Save and Cmd/Ctrl+S offer explicit saves.
Closing while dirty requests the browser's unsaved-change warning. This does not
claim that an interrupted write was saved. Clear-site-data/private browsing can
remove IndexedDB; Export backup downloads a portable copy. External page records,
database rows, view settings and Canvas layout remain host-owned/session state.

Creation/open/save does not overwrite older documents. The read/check/write uses
one IndexedDB transaction with a revision comparison, including between tabs.
A losing writer retains its text and can save a separate recovered copy or
explicitly replace its edits with the stored version. Quota/storage failures retain
the in-memory text and previous canonical version, with Retry and Export actions.
Corrupt, oversized, foreign-scope or unsupported records fail closed without
replacing their bytes. A failed editor mount permits exporting saved content.
No schema migration or existing-data deletion is performed.

BlockNote emits an update when `isEditable` changes even without block changes.
Persistence checks `getChanges()`; locking/unmounting an older view cannot save
that view over a freshly accepted host revision. Review receipts remain visible
after decisions to prevent a second click hitting controls or the document below.
The writing guide initially opens for empty documents, and remains available in
Tools for other documents. Mobile Outline's close control stays above the header.

## Local host and authority

The regular app performs no Personal-AI request. On a loopback preview,
**Personal-AI local test** explicitly switches to the synthetic host; returning
keeps browser documents. If the host is absent, opening fails without falling
back to a different account or storage surface. The equivalent URL parameter is
`?host=personal-ai-local`. No other API origin is accepted by this client adapter.

The host is an opt-in test harness, not production authentication. It requires an
explicit synthetic argument and a dedicated SQLite filename, binds only loopback,
accepts known test identities and exact test origins, sets `Cache-Control: no-store`,
and mounts only the relevant PR119 routers. Owner, membership, workspace and document
authorization is performed by the real PR119 service over real synthetic DB rows.
Another workspace owner still cannot access the creator's personal context.
Generation, recording ingestion, import/export/restore and conversation creation
are blocked by the harness. No worker or paid provider is started.

Approved-memory selection displays only bounded summary fields, without fetching
full conversation transcripts. The client calls the exact PR119 `editor-context`
route with the document ID/version and explicit memory IDs/versions. Proposals are
deterministic labeled append operations, not AI-generated output. Human adoption
chooses a subset; arbitrary imported JSON or client-authored replacement content
cannot serve as approval. Acceptance revalidates the current sources and exact
target, and serializes authority through one SQLite transaction and document CAS.
Rejected/paused/deleted/superseded/stale sources, deleted source turns, another
document/user/workspace, duplicate/unselected IDs and human edits reject without
a partial write. The editor is locked during the short commit; no network/model
operation holds the DB transaction open.

Undo is a persisted host receipt with the exact accepted revision and content.
Later human saves expire undo and pending proposals. Undo removes the new change
without needing that removed memory's approval; if it would restore older
memory-derived content, those sources must still have current approval. Thus an
undo cannot resurrect previously deleted or stopped memories.

### PR119 seams that must be addressed upstream

PR119 `editor_context()` commits internally, while the ordinary document PATCH
does not accept an expected version. Calling them as separate requests cannot
guarantee atomic approval plus writing. This harness uses a scoped `DeferredSession`
to retain the existing service's locks/commit until document persistence finishes.
That technique is deliberately confined to the test harness. Production needs an
explicit transaction-aware service seam plus a host-owned CAS/review/undo endpoint;
it must not treat a fetched snapshot as a grant. PR117's Secretary/production
writer path is not assumed to provide this contract.

PR119 stores source timestamps in UTC, but SQLite loses their timezone metadata.
The harness restores this known convention on load/refresh for its own sessions,
including multiple selected memories from the same source. It never invents an
offset for an external imported snapshot. Postgres and the production adapter must
preserve explicit offsets themselves. The two bridge contract files are verified
against SHA-256 fingerprints from the pinned source before the harness imports it.

## Reproduction and verification

Use a separate checkout of the exact Personal-AI SHA above and its frozen `uv.lock`
(`uv sync --frozen --extra dev`). Point `PERSONAL_AI_SOURCE` at that source, and use
its virtual-environment Python to run:

```sh
python scripts/local_personal_ai_host.py --synthetic --database /tmp/open-editor-synthetic-example.sqlite
python -m pytest scripts/test_local_personal_ai_host.py -q
ruff check scripts/local_personal_ai_host.py scripts/test_local_personal_ai_host.py
ruff format --check scripts/local_personal_ai_host.py scripts/test_local_personal_ai_host.py
```

Build `examples/blocknote-power` and preview it on `127.0.0.1:5177` (the harness
also permits preview port 5176). The API test environment is external and pinned;
it is not installed as an npm dependency or started by the public package.

Verified with synthetic data only:

- Workspace typecheck, tests and build; example typecheck/build; repository
  security scan and npm production-dependency audit (zero vulnerabilities).
- Five document/host boundary tests alongside the fourteen existing example tests.
- Local API tests cover restart/undo, partial adoption, repeated requests,
  source revocation/deletion, owner, workspace and document separation, human conflicts,
  complete rollback on commit failure, concurrent writers, invalid input and UTC
  restoration for multiple memories sharing one source.
- Production Chromium: normal editing/autosave/reload/full browser restart;
  two actual tabs and recovery copies; injected quota error/retry; new document;
  a 300-paragraph synthetic clipboard paste and reload; 320px and Reduced Motion;
  corrupt storage retention; real loopback API permission checking, partial
  double-click adoption, persisted reload and guarded undo.
- Existing review regression: partial accept/reject/undo, later human edits,
  all modes, keyboard/Escape, 320px with enlarged text, Reduced Motion/Save Data,
  decorative playback and lazy-chunk failure returning to the original document.

Generated profiles, synthetic DBs, raw logs and screenshots remain local and are
excluded from the public change. Earlier failed trials were corrected and are not
claimed as passes. The inherited large-bundle warning remains. No new runtime
dependency was added; this change has no matched before/after performance timing,
so PR31's historical numbers do not establish performance for this version.

## Remaining real-operation gates

This completes local normal-document persistence and the synthetic local integration
contract, not a production Personal-AI writer switch. Real authenticated principals,
secure private storage/retention, the upstream transactional endpoint, real model
proposals, multi-device sync, Safari/Firefox, physical touch and assistive technology
still require verification. Actual background visibility remains unverified as
recorded in PR31. No production DB migration, auth/key/permission setting change,
package publication, deployment or real AI call is part of this implementation.
