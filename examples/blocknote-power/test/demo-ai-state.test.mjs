import assert from "node:assert/strict";
import test from "node:test";
import {
  canImproveDemoSelection,
  canUndoDemoSuggestion,
  composeDemoRewrite,
  DEMO_AI_SOURCE,
  isDemoAiBusy,
  resolveDemoAiSource
} from "../src/demoAiState.mjs";

const selectedText = "A focused workspace keeps the content clear and the tools close at hand.";

test("partial review applies only selected phrases and keeps the source immutable", () => {
  assert.equal(composeDemoRewrite({ clarity: false, reach: false }), DEMO_AI_SOURCE);
  assert.equal(composeDemoRewrite({ clarity: true, reach: false }), "A focused workspace keeps content clear and the tools close at hand.");
  assert.equal(composeDemoRewrite({ clarity: false, reach: true }), "A focused workspace keeps the content clear and tools within reach.");
  assert.equal(composeDemoRewrite({ clarity: true, reach: true }), "A focused workspace keeps content clear and tools within reach.");
  assert.equal(DEMO_AI_SOURCE, selectedText);
});

test("AI undo preserves subsequent text, formatting, children and deletion", () => {
  const accepted = { id: "source", type: "paragraph", content: [{ type: "text", text: "Accepted", styles: {} }], children: [] };
  assert.equal(canUndoDemoSuggestion(structuredClone(accepted), accepted), true);
  for (const current of [
    undefined,
    { ...accepted, content: [{ type: "text", text: "My edit", styles: {} }] },
    { ...accepted, content: [{ type: "text", text: "Accepted", styles: { bold: true } }] },
    { ...accepted, children: [{ id: "child", type: "paragraph" }] }
  ]) assert.equal(canUndoDemoSuggestion(current, accepted), false);
  assert.equal(canUndoDemoSuggestion(undefined, undefined), false);
});

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
