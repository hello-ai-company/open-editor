# BlockNote compatibility matrix (Phase 4F-5B)

Machine-verified against `@hello-ai-company/editor-blocknote@0.1.0` source and packed tarball.
Raw JSON: [blocknote-compat-matrix.json](./blocknote-compat-matrix.json).
Harness: `node scripts/blocknote-compat-matrix.mjs` (no `--force` / `--legacy-peer-deps`).

## Decision

**Supported peer range: `@blocknote/core` + `@blocknote/react` `^0.54.2`.**

Do **not** widen to include Personal AI’s `^0.52.1` line.

## Matrix summary

| Layer | BlockNote `0.52.1` | BlockNote `0.54.2` |
| --- | --- | --- |
| A. As-published peer resolve (`^0.54.2`) | **FAIL** — npm `ERESOLVE` | **PASS** |
| B. API probe (matrix-only widened peers) | install + typecheck + runtime **PASS** | **PASS** |
| C. Source `tsc` (`tsconfig.build.json`) | **FAIL** — `@blocknote/code-block` lacks `syntaxHighlighter`; `math-block` / `diagram-block` **404** on 0.52.1 | **PASS** |

## Why not `^0.52.1 || ^0.54.2`

1. **Source floor is 0.54.x** — optional `./code` imports `syntaxHighlighter` from `@blocknote/code-block` (present in 0.54.2, absent in 0.52.1).
2. **Optional power features** — `@blocknote/math-block` and `@blocknote/diagram-block` first appear on the 0.54 line (npm 404 for `0.52.1`).
3. **Honest peers** — layer B shows a *built* tarball can smoke against 0.52.1 if peers are artificially rewritten; that is **not** a supported configuration. Shipping a wide peer range would invite hosts to install an unsupported matrix.
4. **No legacy peer flags** — OpenEditor refuses `--legacy-peer-deps` / `--force` for production installs; as-published peers must resolve cleanly on the supported line only.

## Personal AI implication

Personal AI today pins BlockNote `^0.52.1`. To consume `@hello-ai-company/editor-blocknote` it must:

1. Upgrade host `@blocknote/*` to `^0.54.2`, **or**
2. Stay on 0.52.1 and integrate **only** `@hello-ai-company/editor-core` (document model / providers) until the upgrade lands.

Shadow / guarded editor mount (Phase 4F-5D/5E) therefore depends on a BlockNote upgrade on the Personal AI side — not on widening OpenEditor peers.

## editor-core

`@hello-ai-company/editor-core@0.1.0` is already published on npmjs and unchanged in this phase (no version bump, no republish). `editor-blocknote` depends on `^0.1.0`.
