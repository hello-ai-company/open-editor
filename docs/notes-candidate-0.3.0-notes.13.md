# Notes .13 — database views and target-specific Canvas

Local candidate based on immutable .12 source
`f35b319680aae5a1aa9f0aad220bf3ee33fe7da3`. Previous candidates and PersonalAI
sources/data remain intact. Standalone Notes continues to use the left edge and
the entire supplied width; only explicit `hostFrame=reference` reserves host chrome.

This iteration connects the eleven existing database rendering engines to the
Notes preset. Table gains an explicit row-open action; ten individual-row views
route through the existing Notes controller/tab writer. Dashboard is a loaded-row
aggregate, with an explicit incomplete-dataset notice. Rows remain provider-owned;
the document stores database/view identity, never embedded row snapshots.

Search/filter input is cached synchronously in its source controller. IME does
not issue intermediate queries. Pending view preferences prevent navigation until
the provider save settles; rejection retains the exact configuration for Retry.
Forced unmount retains input. Controller/scope/target changes, newer external
input, hydration races and late acknowledgements cannot clear or overwrite it.
Retained property-bound settings are revalidated against current metadata/schema.
This controller cache does not claim unsaved-input survival across browser restart.

The Canvas factory may return undefined for individual targets. A row without
Canvas entitlement uses its existing document/property surface without fabricating
Canvas permissions or suppressing Notes input/receipt guards. Notes-owned map pins
retain their engine geometry/color despite generic button CSS. Nearby world-map
pins can still overlap; the accessible companion list opens each row.

The new synthetic route is `?notes=synthetic&classic&parity=database`, with separate
`parity13-v1` records and layout. It exposes read-only DB rows, authorized local
Gallery/Feed images, host paging/filter/sort and synthetic presentation preferences.
Named Notes property operations still use the existing scoped writer. No DB CRUD,
real AI/provider, authentication change, publication or deployment is enabled.

This is an incremental candidate, not full Notes replacement. Every one of the
59 application removal gates remains false. Actual PA DB/schema/row-body admission,
table binding, historical preview formats, native gallery/cover/emoji/selection
tools, Secretary provenance and full35 CSS/native browser acceptance remain open.
The PA contract report separates SDK results from actual host acceptance.

See the host delta, PA contract report, verification report and machine-readable
`NOTES12-ACCEPTANCE.json` (retained artifact filename, candidate value .13).
