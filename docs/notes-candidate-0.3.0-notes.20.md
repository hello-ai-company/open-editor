# Notes .20 — quiet feedback and stable selection UI

Local separate candidate based on accepted notes.19 / bc6c3ac. Existing .19 source, tarballs, paused CRUD WIP and original user tabs/store are preserved. No host install, push, merge, deployment, publication or paid AI call is part of this candidate.

Insertion/replacement/export completions use one pane-scoped, nonmodal peripheral notification, with opacity/3px translation and three-second expiry. Errors persist until explicit dismissal or pane identity change, and unrelated success cannot overwrite them. Unsaved backup, retained selection input and Undo remain actionable after notices expire. Saving cancellation, unknown-result lookup, conflict/denial recovery remain persistent. No automatic retry or inferred save success was added.

The document and right rail occupy exactly two grid cells. Fragment notices cannot become another grid cell. Selection AI/comment controls float near the owning selection, follow scroll/resize, preserve the live range, support F8/arrow keys/Escape and touch-equivalent activation. The explicit review dialog retains existing CAS, permission, revision and cancellation checks. A host-provided proposal becomes a peripheral explicit-review signal; its input stays mounted while closed. No model opt-in or implicit body replacement was added.

This closes the scoped overlay/layout stage, not the user's whole-product quality request. Whiteboard controls, all-source/all-UI inventory and unified visual refinement continue as a separate candidate. Performance improvement and every edge/collision scenario are not certified. See verification and PA contract for limits.
