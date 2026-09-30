import assert from "node:assert/strict";
import test from "node:test";
import {
  canImproveDemoSelection,
  isDemoAiBusy,
  resolveDemoAiSource
} from "../src/demoAiState.mjs";

const selectedText = "A focused workspace keeps the content clear and the tools close at hand.";

for (const { name, blocks } of [
  { name: "removed source paragraph", blocks: [] },
  {
    name: "changed source paragraph",
    blocks: [{ id: "source", type: "paragraph", content: [{ type: "text", text: "Edited while loading." }] }]
  }
]) {
  test(`preparing recovers when the ${name} becomes unavailable`, () => {
    const document = { blocks: structuredClone(blocks) };
    const documentBeforeResolution = structuredClone(document);
    let action = "preparing";
    let status = "Preparing the local suggestion…";
    let suggestion = null;

    assert.equal(isDemoAiBusy(action), true);
    const source = resolveDemoAiSource(document.blocks, "source", selectedText);
    if (source.action === "stale") {
      action = source.action;
      status = source.status;
    } else {
      suggestion = source.block;
    }

    assert.equal(action, "stale");
    assert.equal(isDemoAiBusy(action), false);
    assert.equal(canImproveDemoSelection(true, action), true);
    assert.match(status, /changed or is no longer available/i);
    assert.match(status, /select the example text again/i);
    assert.equal(suggestion, null);
    assert.deepEqual(document, documentBeforeResolution);
  });
}
