# Notes candidate 0.3.0-notes.25

Local-only common SDK follow-up to .24. Existing .24 artifacts are preserved. No publication, host installation, schema, grants or AI changes.

Code's native pointer completion and navigation key boundaries now synchronize a validated, focused Code caret/range through public selection transactions. This prevents pending ProseMirror focus work from restoring a stale model selection after the user has moved it. Copy still requires a nonempty current Code range and uses the existing BlockNote serializer and formats. No native input is canceled or reimplemented, and no wait/timer/private vendor access is added.

The unchanged public Document feature includes this guard. Optional Code highlighting uses the same factory identity, so each editor installs it once. Other editor surfaces, native input widgets, composing and readonly states retain their existing handlers. No new root export is required.

Acceptance is scoped to common SDK tests and synthetic fixtures. PA .24's saved focus-timer stack was reviewed, but its port5391 was unavailable during direct rerun. PA adoption of .25 and the exact host insertion flow remain pending. Columns canonical save rejection belongs to the host contract and is outside this change.
