# Security boundaries

- **Core:** document JSON is versioned and validated. Guards and cloning reject cycles, more than 20,000 blocks, block nesting deeper than 128, and JSON values over 50,000 nodes or 128 levels.
- **Suggestions:** parse untrusted agent payloads before display or acceptance. Apply only after an explicit decision, against the unchanged base document. Persist provenance separately in host-controlled storage.
- **Agent context:** keep trusted task instructions separate from context explicitly marked untrusted. OpenEditor does not grant tools or permissions.
- **Personal AI:** the editor adapter submits user instructions through Secretary Work Intake only. It rejects document context because that API cannot carry a separate untrusted context field. Task execution remains in Personal AI.
- **Plugins:** feature registrations are checked for duplicate IDs, schema-key collisions, and command collisions. Plugins are trusted JavaScript running in the host; the registry is not a sandbox.
- **Publishing:** static output uses a block allowlist, escapes text/attributes, rejects unsafe URLs, omits hidden/private content, and does not emit executable scripts or embeds. The Q&A projection is marked untrusted input.
- **Media:** BlockNote page/child-page/database media paths reject executable and protocol-relative URLs before rendering.

Hosts still own authorization, tenancy, private/public selection, storage, CSP/security headers, and runtime policy. A local passing suite is not a substitute for a deployment security review.
