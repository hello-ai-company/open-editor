# .25 verification

See output/focus25/HANDOFF.md, verification.json and frozen-deliverables.json for final counts, package/source identity and complete evidence. Initial failed/invalid diagnostic fixtures are retained and excluded from PASS counts.

The controlled ProseMirror tests demonstrate stale selection restoration without synchronization and preservation after keyboard or pointer completion. They additionally cover another editor's ownership, native textarea focus, readonly, composition and disposed listener cleanup. The timer and view are real; delayed selection-event delivery and time are controlled in JSDOM.

Native Chrome fixture checks immediate focus→Shift→copy→actual receiver with no selection wait, fake range, injected clipboard event, clipboard permissions or readText. Common synthetic browser success is not equivalent to completion of PA adoption. Safari, physical IME/touch, rich HTML reconstruction and all cross-block/cut/Shadow DOM conditions remain uncertified.

The old Chromium144 CPU4 paint/paste figures are not compared. Build size is reported only against the same example build; no runtime performance improvement is claimed.
