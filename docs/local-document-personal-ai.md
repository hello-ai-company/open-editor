# Local Document persistence and Personal-AI host contract

This follows OpenEditor PR31 (`0508598f7945412cc5b4740b41e5cd1c5db69bf1`),
which depends on PR30 (`9afd81847a5fabd0ba58169f1db2572ddf1bb681`).
The local integration uses Personal-AI PR120 at
`b4e541c49b2e5b3c6988dc48b99532b6c89aaa74`, which includes PR119 at
`7b03a8ce39581e1f1cb65599d5c2d2dced5ca044`. Its exact source was obtained
through the GitHub API into a separate temporary copy; no original Personal-AI
worktree was changed. See the pinned
[host contract](https://github.com/hello-ai-company/personal-ai/blob/b4e541c49b2e5b3c6988dc48b99532b6c89aaa74/docs/architecture/OPENEDITOR_PERSONAL_DOCUMENT_HOST_CONTRACT.md).

## Separate storage surfaces

| Surface | Stored data | Durability and scope |
| --- | --- | --- |
| Normal Document | Validated `EditorDocument`, UUID, title, revision and timestamp | IndexedDB `open-editor.documents.v1`, separate actor and workspace keys. Survives reload and process restart in the same browser profile and origin. |
| Selected-context demo | Fixed synthetic text, proposal and undo lineage | Existing explicitly saved `open-editor.synthetic-selected-context.v1` state; external imports remain preview-only. |
| Opt-in Personal-AI local test | Synthetic server documents, approved memories and document history | Separate SQLite host on `127.0.0.1:8189`, actual PR120 owner read and transactional save APIs; proposal generation is a client mock. |

Normal Document loads before mounting the editor. Actual block changes save after
300ms of quiet time; Save and Cmd/Ctrl+S offer explicit saves. Closing while dirty
requests the browser's unsaved-change warning. An interrupted write is not claimed
as saved. Clear-site-data or private browsing can remove IndexedDB; Export backup
downloads a portable copy. External page records, database rows, view settings,
attachments and Canvas layout remain host-owned or session state.

Creation, opening and saving retain older documents. The revision check and write
share one IndexedDB transaction, including between tabs. A losing writer keeps its
text and can create a recovered copy or explicitly replace its edits with the saved
version. Quota failures keep current text and the previous canonical version, with
Retry and Export actions. Corrupt, oversized, foreign-scope and unsupported records
fail closed without replacing their bytes. Failed editor mounts allow exporting the
saved content. No existing-data deletion or browser schema migration is performed.

BlockNote emits updates when `isEditable` changes without block changes. Checking
`getChanges()` prevents an older view's lock/unmount from overwriting a newly saved
host revision. Review receipts retain their controls after a decision to prevent a
second click falling through. The guide opens initially for empty documents and is
available in Tools otherwise. The mobile Outline close control stays above the header.

## Actual Personal-AI owner, CAS and history APIs

The regular app makes no Personal-AI requests. On a loopback preview, **Personal-AI
local test** explicitly selects the synthetic host; returning keeps browser documents.
The URL is `?host=personal-ai-local`. Missing host access fails without switching
accounts or storage. The adapter accepts only `http://127.0.0.1:8189`.

The synthetic fixture requires explicit opt-in and a dedicated SQLite filename.
It binds only loopback, accepts known synthetic identities and exact test origins,
and sets `Cache-Control: no-store`. Its middleware permits only the relevant read,
create, save, context and fixture-summary paths. No real authentication, worker,
recording ingestion, conversation generation, model provider or external DB is started.
The mounted Personal-AI routers and services are unchanged. The previous experimental
PR119 `DeferredSession` transaction workaround has been removed.

Owner reads use `GET /api/v1/documents/{id}?personal_owner=true`. Before enabling
writes, the adapter requires `personal_save_contract: owner_cas_history_v1`, validates
the owner, workspace, document ID and all blocks, and checks the exact content token.
An older server ignoring the query fails closed. Block trees and rich OpenEditor
content round-trip through bounded `properties.metadata.open_editor`; host source
and privacy fields are retained. Native simple text can be read, while unsupported
foreign rich blocks fail instead of being silently reduced to plain text.

Every write uses `PUT /api/v1/documents/{id}/blocks/restore` with the current
`expected_content_revision` and `personal_save.expected_document_version`. The
server saves the old title/body history, new title/body, audit and events in one
transaction under owner and document locks. Returned server block versions replace
the cached versions. Neither a fetched snapshot nor a browser cache is a grant.

Only approved synthetic memory summaries are shown. Preparing a mock proposal
calls the actual `editor-context` POST with explicit target ID/version and selected
memory IDs/versions. Statements and inferences remain labeled, with source ID/date
and rationale visible. Adoption appends only the chosen changes, but submits **all**
preview memory references unchanged for atomic server revalidation. A stopped,
deleted or stale reference prevents the entire write, including references whose
body change was not selected. There is no retry that drops rejected references.
Human edits invalidate older proposals. The editor is locked during the short write.

History uses the actual `GET /api/v1/documents/{id}/versions` endpoint. Undo is
available only for the immediately preceding OpenEditor AI review, with no later
human save. It restores that history's title and blocks using the **current** owner
read's CAS values, never the historical token. Undo creates another server history
entry. Historical block source metadata supplies memory references for revalidation;
it cannot automatically reintroduce a revoked memory. This is body undo, separate
from document-trash restoration, and does not roll back metadata or provider rows.

A timeout, lost or malformed successful write response, or server failure can mean
the write already committed. The client keeps the text, stops autosave/shortcut
retries and offers **Check saved version**. An explicit owner read confirms identical
content; differing content retains human edits until the user chooses a recovered
copy or the saved version. No automatic write uses a newly fetched CAS token.

SQLite loses timezone offsets on locally seeded UTC source dates. The fixture's
own session load/refresh listeners restore that known local convention; external
snapshots and the pinned source files are never rewritten. Production storage must
preserve explicit offsets itself. Four contract files are fingerprint-checked before
import; the fixture refuses a mismatched source.

## Reproduction and verification

Use a separate checkout of the exact Personal-AI PR120 SHA above and its frozen
`uv.lock` (`uv sync --frozen --extra dev`). Set `PERSONAL_AI_SOURCE` to that checkout,
and use its virtual environment:

```sh
python scripts/local_personal_ai_host.py --synthetic --database /tmp/open-editor-synthetic-example.sqlite
python -m pytest scripts/test_local_personal_ai_host.py -q
ruff check scripts/local_personal_ai_host.py scripts/test_local_personal_ai_host.py
ruff format --check scripts/local_personal_ai_host.py scripts/test_local_personal_ai_host.py
```

Build `examples/blocknote-power` and preview on `127.0.0.1:5177` (5176 is also
permitted). The pinned Python environment remains external; no npm runtime
requirement or public package startup behavior changes.

Verified using synthetic data and mock generation only:

- Workspace typecheck, tests and build; example typecheck/build; security scan
  and npm production-dependency audit with zero vulnerabilities. No JS lint script
  exists; Python Ruff checks pass.
- Nine document/adapter/codec tests and the fourteen existing example tests.
- Eleven local actual-API tests: partial adoption, reload/restart, history undo,
  duplicate/stale document and block revisions, foreign/duplicate blocks, all-preview
  source revocation, another user, opt-in/origin restrictions, complete commit-failure
  rollback, concurrent request writers and revoked historical sources.
- The pinned upstream's ten `test_personal_document.py` cases also pass.
- Production Chromium: normal edit/autosave/reload/full process restart; two actual
  tabs and recovery copies; injected quota failure/retry; New document; 300-paragraph
  clipboard paste/reload; all modes; 320px; Reduced Motion; corrupt storage retention;
  actual loopback API partial double-click adoption, reload and history undo.
- Continuous typing starts no host save; the quiet period produces one save and
  retains the text on reload. Repeated rejection writes nothing; a later human
  save invalidates the proposal; delayed explicit recovery locks editing.
- A real API PUT was allowed to commit before its response was deliberately lost:
  human text survived, Cmd+S made no additional PUT, owner GET reconciled the saved
  body, and reload retained it.
- Existing review regression covers partial accept/reject/undo, later human edits,
  keyboard/Escape, enlarged narrow layouts, Reduced Motion/Save Data, decorative
  playback and failed lazy chunks returning to the original document.

Generated profiles, synthetic DBs, raw logs and screenshots remain local and are
excluded from public commits. Corrected failed trials are not claimed as passes.
The inherited large-bundle warning remains. No new runtime dependency was added.

## Remaining real-operation gates

Normal browser persistence and this actual synthetic API integration are verified.
Real authenticated principals, private storage retention, deployment of the host
contract and its migration, real model proposals, multi-device sync, Safari/Firefox,
physical touch and assistive technology still require verification. Actual native
background visibility remains unverified as recorded in PR31. No production DB
migration, auth/key/permission setting change, package publication, deployment or
real AI call is part of this change.

## Matched performance comparison

The retained original R3 build and this production build were remeasured with the
same insertion harness: Chromium 153.0.8010.12, 1440×900, CPU throttle 4×,
Reduced Motion and five fresh browser contexts per build. Both inserted the same
500-block HTML at the same sample paragraph and ended with 511 blocks every time.
Input timing measures two animation frames; samples are synthetic, not a claim
about physical keyboard latency. Earlier historical measurements are not combined.

| Median | Retained R3 build | Current build |
| --- | ---: | ---: |
| Editor paint | 405.5ms | 352.0ms |
| First contentful paint | 344ms | 148ms |
| Normal input | 14.0ms | 16.1ms |
| Input after insertion | 14.2ms | 14.8ms |
| 500-block paste | 623ms | 531ms |

Startup and paste were faster in this run; input was slower. Durable validation and
saving add work, and these measurements do not establish which change caused the
difference or a universal speedup. Main JS grew from 1333.58kB/gzip401.79kB to
1373.91kB/gzip414.46kB. The existing large-chunk warning remains.
