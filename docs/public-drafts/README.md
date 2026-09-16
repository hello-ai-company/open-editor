# @hello-ai-company/editor-core

> **DRAFT — NOT PUBLISHED.** This file is a *future* public README stored at `docs/public-drafts/README.md`. It is **not** the repository root README. The live root README remains a **PRIVATE EXTRACTION WORKSPACE** banner. Do not treat the install commands below as working public instructions. Placeholders only.

Host-neutral TypeScript document model, JSON serialization, and optional provider seams for an editor core.

- Document trees (`EditorDocument` / `EditorBlock`) with `schemaVersion` `1`
- JSON serialize / deserialize with unknown block types round-tripping
- Optional provider **types** only (no network clients, no UI)

This draft assumes a later owner-authorized public release. **No such release has occurred.**

## Status

| Item | Placeholder (OWNER DECISION PENDING) |
| --- | --- |
| License | Not applied — live package is `UNLICENSED` |
| npmjs | Not published |
| GitHub visibility | PRIVATE |
| Version | Not the private prerelease `0.0.0-phase3.e17b4b5` — first public version is an owner decision |

## Install (placeholders)

These commands are **illustrative**. They will fail or be unauthorized until a human selects registry, license, and version and a later phase actually publishes.

```bash
# Placeholder — npmjs public scoped package (only if that path is chosen later)
npm install @hello-ai-company/editor-core

# Placeholder — GitHub Packages (current private registry; requires org auth)
# npm install @hello-ai-company/editor-core --registry=https://npm.pkg.github.com
```

Pin a concrete version once one exists. Do not install `0.0.0-phase3.e17b4b5` from npmjs; that identifier is the **private** GitHub Packages prerelease.

Requirements: Node.js `>=20`, ESM (`"type": "module"`). No CommonJS `require` export.

## Usage (API unchanged from the private freeze)

```ts
import {
  createEditorDocument,
  serializeEditorDocument,
  deserializeEditorDocument
} from "@hello-ai-company/editor-core";

const doc = createEditorDocument({
  blocks: [{ id: "b1", type: "paragraph", content: { text: "Hello" } }]
});

const json = serializeEditorDocument(doc);
const roundTrip = deserializeEditorDocument(json);
```

Public runtime and type lists: see `docs/public-api.md` in this repository (private freeze; not an OSS announcement).

## What this package is not

- Not a BlockNote / React editor
- Not a host app, sync layer, or HTTP client
- Not a place for host-specific methods (`openEmployees` and similar stay on the host via `NativeBridge.hostRequest`)

## Contributing / security

Drafts: [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md). Security contact is **OWNER DECISION REQUIRED**.

## Support (optional)

Using, modifying, forking, self-hosting, and commercially using this core is intended to stay **free** (subject to the eventual license). **Payment is never required.**

If the owner later offers voluntary GitHub Sponsors or donations, that support would help sustain maintenance only. Sponsorship **does not** unlock exclusive core functionality, paid feature flags, Cloud/Enterprise SKUs, or a commercial plugin.

**SPONSOR LINK — OWNER SETUP REQUIRED.** No approved destination exists yet. Do not treat any URL as official. `.github/FUNDING.yml` is **intentionally absent** until the owner supplies a real, approved link.

## License

**Not selected.** Live files `LICENSE` and `packages/core/LICENSE` remain proprietary `UNLICENSED`. This draft must not be copied to the repo root until an owner applies an SPDX license in an authorized phase.
