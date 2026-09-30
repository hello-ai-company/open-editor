const SOURCE_UNAVAILABLE_STATUS = "The selected text changed or is no longer available. Select the example text again.";

export function isDemoAiBusy(action) {
  return action === "preparing" || action === "accepting" || action === "rejecting";
}

export function canImproveDemoSelection(hasSelection, action) {
  return hasSelection && !isDemoAiBusy(action);
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
