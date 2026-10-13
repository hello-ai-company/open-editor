# Notes local candidate 0.3.0-notes.9

Local presentation candidate based on immutable .8 (`c8bd9ddf87917b73f1bf3dadb412d59e9ac1e15b`). No npm release, production migration, complete PersonalAI parity or old UI removal is implied. Previous .0–.8 archives remain unchanged.

## Changes

- Standalone OpenEditor uses the entire viewport, including the left edge. The synthetic comparison workbench reserves excluded PersonalAI chrome only with explicit `hostFrame=reference`; `baseline` alone never creates an empty left frame. Public Notes components fill their supplied container and need no PersonalAI placeholder. Mobile body width stays full after closing the tool drawer.
- Classic presentation adds breadcrumb/title/icon/tag/cover-control structure, an integrated Document/Canvas/Present/Site toolbar, twelve page-style previews, localized Insert/Style/Info tools, page Body/Child pages controls, a Library in the detail pane, and explicit Focus entry/exit. Existing default presentation is retained.
- `NotesPageAppearanceOptions` from the public `/react` entry maps `icon`, `tags`, `style`, `cover` to host-declared metadata keys. A mapping does not grant a capability. Named patches require the existing command authorization, ready state, composition/draft barriers and confirmed receipts. Unknown metadata and malformed tags remain intact. Changing/removing a mapping blocks an older draft. Cover control is an optional authorized host-rendered slot; the fallback stays disabled.
- Library and tool-category changes keep the existing document/content-tool writer mounted. Closing/reopening import or switching tool categories preserves source input. An open import/export dialog blocks category changes. Compact drawers keep active tools interactive and surrounding content inert; Tab/Shift+Tab and Escape retain focus correctly. Selecting a split menu action closes that menu; save-status feedback does not move the document.
- Changes are scoped to opt-in classic CSS; `notesWorkspace.css`, storage codecs, canonical host commits and existing Notes session/Canvas guards are retained. No new dependency or provider was installed.

## Verification and limits

Workspace typecheck, all 1,267 tests (including 14 independent new regressions), workspace/example build and `git diff --check` pass. There is no lint script. Browser checks use synthetic records/mocks and block external traffic; paid calls are zero. Recorded coverage includes default editing/insert/widget/modes, save/reload and uncertain-ack recovery, five standalone widths (1600/1100/840/720/390), both drawer keyboard paths, Focus entry/exit, import-input retention, Library card geometry and writer retention, and long documents.

35 original-reference states were recaptured under Chrome154, 1600×1000 where applicable, DPR1, en-US, light global scheme, fonts ready and Reduced Motion. The twelve-theme title/body/block-content/rail computed subset matches 768/768 values. These sampled values are **not** full-screen equality or complete interaction acceptance. The comparison retains raw reference rectangles and separately inferred document coordinates: the older reference harness omitted scroll offsets, so sticky/fixed/internal-scroll positions need separate review.

Known portable presentation gaps remain: distinct per-action icon paths, six-choice icon picker versus the original searchable/paginated picker, cover banner/native style gallery, richer Document Info/backlink/related and Library metadata, and details of split-pane layout. Unavailable studio DB/HTML/columns and original Secretary proposal UI do not count as matched screenshots. No accepted 36th reference capture or open-picker/focus/non-Document mode reference was supplied.

Host integration still owns authorized rich DB/property/schema/row data, asset/cover/template/shared providers, canonical legacy preservation, history restore and Secretary review/Undo. The existing PA .8 partial host integration is preserved and described separately in `notes-candidate-0.3.0-notes.9-host-delta.md`; .9 does not replace it or alter signing keys.

Performance uses the same synthetic route, Chrome154, 1440×900, CPU4× and five samples. The historical 391ms/598ms figures used different browser/route/metrics and are not comparable. Small .8/.9 median differences are reported as measurements, without a speed-improvement claim. The example retains the existing >500KB chunk warning. Real native IME, Safari, production auth/concurrency, uploads and actual model transport are unverified.
