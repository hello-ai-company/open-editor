# OpenEditor 0.3.0-notes.6 — local quiet review UI

The synthetic Document example now keeps writing first. Desktop reserves a right-hand review rail; proposals never resize the document or automatically move the page. Short title/placement/link summaries lead to optional details and explicit approval, dismissal and original-preserving Undo. Settings, independent opt-ins, save-result lookup and draft backup remain accessible in a native dialog.

At narrow widths or short viewport heights, a small proposal button occupies the permanent header. It opens a native sheet only on request. Keyboard focus trapping/return, IME Escape protection, viewport zoom, reduced motion, long-document caret visibility and permission invalidation are covered by local browser probes. Unknown saves remain visibly unconfirmed until authoritative lookup; synthetic data is clearly labeled and no external pages or AI services are contacted.

This candidate changes the example UI and QA, retaining .5 public runtime contracts, capability checks, atomic CAS/receipts and legacy codecs. It does not claim complete PersonalAI Notes migration. That work has a separate branch and acceptance inventory. Source package versions remain 0.2.0; only isolated tarballs use this candidate version. Earlier .0–.5 artifacts are retained unchanged. No push, publication, deployment or production host integration is part of this local candidate.

See `docs/notes-candidate-0.3.0-notes.6-verification.md` and `output/verification-notes6/` for checks and actual screens. Native macOS IME and production provider behavior remain unverified. Existing columns keep their MPL-2.0 boundaries.
