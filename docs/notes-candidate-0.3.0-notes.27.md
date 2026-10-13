# Notes .27: durable unapplied HTML source

Local, unpublished candidate based on accepted .26. Existing table editing, DB raw journals and private operation tickets retain their owners. This candidate covers one HTML source input boundary; PA host adoption and the wider #57 plan remain separate acceptance work.

An optional versioned sourceDraftJournal stores exact HTML/CSS/JavaScript input with actor/workspace/target/block identity, original revisions and source, per-edit sequence, language and editing/applied stage. Complete-value compare-and-swap protects other readers. Hydration restores input for review without applying it to the document, saving it or executing JavaScript. Invalid syntax, IME input and oversized preview input remain available for review and export.

Source Apply changes only the local document. The raw backup remains until an exact checked body-save receipt confirms the captured source sequence. Denial, conflict, unknown acknowledgement or cleanup failure preserve the backup; unknown outcomes use the existing fixed-ID lookup. A new process can hydrate retained source alongside its private recovery ticket before that lookup. Explicit Cancel removes only the matching record. Storage failure blocks leave and does not claim durability for memory-only input.

Input immediately before page/tab/Split transitions, old controller callbacks, delayed imports and active composition are fenced. The existing single document writer and table resource writer remain in place. Hosts without the journal retain the existing cache path. See notes-candidate-0.3.0-notes.27-pa-contract.md for the public journal types, atomic host obligations and differences from PA's preparation branch.

Evidence is supplied in output/html27/HANDOFF.md and verification.json. No publication, push, host installation, real API/AI call, original-store write, new grant or security-setting change is performed. Physical IME, Safari and touch require separate verification.
