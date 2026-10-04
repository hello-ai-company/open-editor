const SOURCE_UNAVAILABLE_STATUS = "The selected text changed or is no longer available. Select the example text again.";

export const DEMO_AI_SOURCE = "A focused workspace keeps the content clear and the tools close at hand.";

export function composeDemoRewrite({ clarity, reach }) {
  let text = DEMO_AI_SOURCE;
  if (clarity) text = text.replace("the content", "content");
  if (reach) text = text.replace("the tools close at hand", "tools within reach");
  return text;
}

export function isDemoAiBusy(action) {
  return action === "preparing" || action === "accepting" || action === "rejecting";
}

export function canImproveDemoSelection(hasSelection, action) {
  return hasSelection && !isDemoAiBusy(action);
}

// Compare the whole block: text alone would miss later formatting or child edits.
export function canUndoDemoSuggestion(currentBlock, acceptedBlock) {
  return Boolean(currentBlock && acceptedBlock) &&
    JSON.stringify(currentBlock) === JSON.stringify(acceptedBlock);
}

export function resolveDemoAiSource(blocks, blockId, selectedText) {
  const block = blocks.find((candidate) => candidate.id === blockId);
  const sourceText = block?.type === "paragraph" && Array.isArray(block.content)
    ? block.content.map((item) => item && typeof item === "object" && "text" in item && typeof item.text === "string" ? item.text : "").join("")
    : null;

  return block?.type === "paragraph" && sourceText === selectedText
    ? { action: null, block, status: null }
    : { action: "stale", block: null, status: SOURCE_UNAVAILABLE_STATUS };
}
