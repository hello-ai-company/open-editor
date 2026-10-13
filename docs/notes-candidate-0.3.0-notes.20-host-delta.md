# Notes .20 host delta

No required host API/schema/persistence change. Existing .19 behavior and saved bytes remain compatible. NotesEditorBridge adds optional getSelectionBounds, getInputBounds, getSelectionIdentity and focusEditor methods; the built-in writer supplies these. Third-party writers can omit them, retaining fallback placement.

Feedback is scoped to controller/actor/workspace/target using notesPanelIdentity. Ordinary notifications use a nonmodal body portal, owner-clipped and pointer-transparent except actions. Modal review retains its separate focus trap and z-index. Document children have one .oe-notes-document-cell wrapper in both the workspace and Modes. The separate personal-ai-notes19-layout-host .notesMigrationDocumentSlot containment can remain; margins are not doubled because the common 18px margin applies only to its direct document child.

Adoption belongs to the host owner. Use both .20 tarballs, verify byte hashes in manifest.json, rebuild a separate host entry and test actual isolated canonical save/reload before changing navigation. Existing .19 user tabs/unsaved input must not reload automatically. Original5209 API must not receive synthetic writes. The common owner used the host layout source read-only with isolated5206 API; this is not a .20 install into port49290.

Host-provided props.proposal is covered. Host components appended outside NotesWorkspace, such as trial-only SyntheticProposal/DatabaseExplorer, are owned by the host and are not globally restyled or implicitly migrated.
