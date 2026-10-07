# Notes candidate 0.3.0-notes.2 — HTML host contract

Local, unpublished package candidate following source `23a5efc` / `0.3.0-notes.1`. This release fixes the shared HTML compatibility codec only. Existing `.0` and `.1` artifacts remain immutable; output is `output/candidate/0.3.0-notes.2/`. Source manifests remain official `0.2.0`. No PersonalAI source, authorization, credentials, execution policy or column licensing was changed. No push, merge, install, publish or deployment.

## HTML read precedence

For both `editorTool` and `editor_tool` with `toolKind: "htmlEmbed"`:

1. Parse existing `toolData` as a JSON object, or retain its existing object representation. Malformed JSON still fails explicitly.
2. If the data object has its own `html` key, that value is authoritative **including the empty string**. It must be a string; a malformed present value fails rather than silently falling back.
3. If `html` is absent, use `toolBody` when present, otherwise an empty string. A present fallback body must be a string.
4. CSS and JS retain the existing data-field mapping, including legacy `js` spelling. No JS executes.

Thus `{toolBody:"old",toolData:'{"html":"new"}'}` projects HTML `new`. `{toolBody:"old"}` projects HTML `old`. `{toolBody:"old",toolData:'{"html":""}'}` projects empty HTML, preserving an intentional deletion.

## Save behavior

- **No source edit:** retain exact raw fields, JSON-string formatting, missing-field shape and even a pre-existing body/data mismatch. A title-only edit also leaves source fields alone. This avoids discarding old data during unrelated saves. Consumers must apply the same read precedence.
- **An HTML/CSS/JS source edit:** write canonical `html` to both `toolData.html` and `toolBody`. Preserve unknown current data keys, host metadata, IDs/version and existing `js` alias. Existing string data stays a string; existing object data stays an object. Previously absent/null data becomes a serialized JSON source object.
- **New HTML widget:** emit both serialized `toolData` and `toolBody`, with identical HTML, including empty HTML.
- **Concurrent body edit:** before source synchronization, compare the archived body to the fresh current host body. A changed body, even when hidden by unchanged canonical `data.html`, blocks the save. Refresh before attempting another reviewed edit. Host revision CAS is still required at persistence time.

The archive remains host-private; toolData-only future keys and other host metadata do not enter AI context. Arbitrary markup/JS source is stored as data and previews keep sandbox/CSP script/network restrictions. This release never enables HTML JS execution.

## Acceptance

Regression fixtures cover the host-reported old→new example, body-only legacy blocks, both type aliases, string/object data, mismatches, explicit empty data HTML, CSS-only data with body fallback, title-only edits, new creation, repeated import/export/edit, unknown current fields and hidden concurrent body edits. A real BlockNote schema edit/save test covers the body-only path. Aggregated final type/test/build results are in `docs/notes-candidate-0.3.0-notes.2-verification.md`; packed public-import/type checks exercise the reported cases without host compensation.

The existing `.1` provider APIs and limitations continue: context/revision-bound quiet proposals; explicit secretary approval and receipt/read verification; host-owned authorization/CAS/history; revisioned named-field row patches and operation lookup/recovery journal. Production integration still needs those host capabilities. Existing legacy full-row DB writers/local Quiet demo are not automatically upgraded. Eleven property kinds have explicit editing validators; full 22-property parity, real model quality, native OS IME and hours/days durability are not newly certified by this focused codec fix. See the previous `.1` host contract for those APIs.
