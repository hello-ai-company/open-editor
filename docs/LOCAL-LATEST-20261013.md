# Paired SDK source on Mac

Source comes from verified Personal AI v26 part2 ZIP, SHA256 `ff483496e0ac2bcf7d5d4ecdcbdc6d0c8c31a2c7890ae0fa02736619c4f17eb4`. Current upstream main was cloned before applying the SDK candidate overlay; original working trees are unchanged.

The root typecheck now builds editor-ai before consumers. Immutable 0.2 release guard tests use a frozen upstream package fixture, and an additional test verifies the extended local candidate remains rejected by the unchanged release guard. This source is not authorized for npm publication.

Mac validation: build/typecheck passed after dependency ordering; AI 373, Canvas 30, Core 57 and Publish 37 unit tests passed. BlockNote 1543 passed, 1 timed out during the parallel full run; both native popover cases passed in a focused rerun. Release-guard suite passed (123 tests before the additional candidate-denial test). Whole-suite success is not asserted until CI confirms. Supplied lockfile reports 9 dependency advisories, including 2 critical.

Install `npm ci --ignore-scripts`, then `npm run typecheck`, `npm test`, `npm run build`. Personal AI consumes the verified vendor tarballs supplied in v26; this SDK checkout does not silently replace those packages.
