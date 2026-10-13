# .25 PA contract

Public API and stored shapes are unchanged from .24. This candidate fixes only selection/caret synchronization in Code. It does not confer write authority, persist a body, provide credentials, invoke AI, or make unsupported widget saves succeed.

PA .24 evidence reviewed: personal-ai-notes24-host/mac-evidence/notes24/HANDOFF.md and CODE-SELECTION-BLOCKER.json. Recorded vendor focus20ms callback restored lagging model selection to DOM during native Shift selection, before copying. The host scroll guard was excluded as the cause and replaceBlocks calls were zero.

Direct repeat against that host returned connection refused on5391. Host artifacts, server process and SQLite store were not changed. Common controlled tests retain the actual vendor timer and simulate delayed selection-event delivery; they are distinguished from native browser clipboard acceptance. Host integration must confirm the fix against its saved reproduction before full PA acceptance.
