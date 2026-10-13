# Host delta from .22

No canonical schema, command, endpoint, storage format, capability, authorization or persistence changes. No new automatic saves or page requests beyond the existing metadata provider. PageSnapshotStatus adds `unavailable` and `forbidden`; exhaustive host switches should handle them. PageCardDisplay/ChildPageDisplay add optional `status`/`statusLabel`; existing missing/loading/error fields remain, but an error is now missing=false. Ready references require an existing onOpen callback to be enabled.

`createPageRuntimeStore()` without getPage returns unavailable, not missing. `getPage(id)` returning null is the explicit absent/deleted result. An ordinary thrown error yields error. To signal an authorized read's explicit access denial, throw `PageRuntimeAccessDeniedError` exported from `@hello-ai-company/editor-blocknote`; the SDK does not guess from HTTP-like properties/error messages. This signal only changes presentation and grants no access. Hosts may use ordinary errors when denial cannot be distinguished safely.

Configured store labels survive resolution, with explicit runtime labels taking precedence. Local titleHint is retained for non-missing references solely as existing local data; it never authorizes opening or supplies authoritative provider metadata. Failed/unavailable/restricted displays contain no fetched preview/image data.

`createPageRuntimesFromStore().resolve` starts only idle loads. To recover a failed read, explicitly call store.load(id), or invalidate then load. Retained denied/unavailable snapshots require explicit invalidation/rebinding. Metadata remains instance-scoped and generation-fenced.

HTML updateBlock is synchronous under the BlockNote public contract. Apply compares all three canonical source fields after the call. A silent veto/mismatch retains raw/cache and alerts; it does not invent a receipt or retry automatically. Host focus alignment must respect native widget controls/iframes instead of scrolling to an unrelated body caret.
