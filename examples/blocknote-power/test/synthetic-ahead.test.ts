import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseSuggestionGroup, type AgentRequest, type AgentRunEvent } from "@hello-ai-company/editor-ai";
import { createSyntheticAheadAdapter } from "../src/syntheticAhead";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function request(phase = "outline", direction = ""): AgentRequest {
  return { runId: "test-run", instruction: "Write a story", context: [{ id: "doc", kind: "document", trust: "untrusted", text: JSON.stringify({ schemaVersion: 1, blocks: [{ id: "human", type: "paragraph", content: "Keep me" }] }) }], metadata: { phase, direction } };
}
async function collect(adapter: ReturnType<typeof createSyntheticAheadAdapter>, input: AgentRequest) {
  const events: AgentRunEvent[] = [];
  for await (const event of adapter.start(input)) events.push(event);
  return events;
}
it("produces validated synthetic scaffolding without network requests", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const adapter = createSyntheticAheadAdapter(), pending = collect(adapter, request());
  await vi.advanceTimersByTimeAsync(700);
  const events = await pending;
  const proposal = events.find(event => event.type === "suggestion");
  expect(proposal?.type).toBe("suggestion");
  if (proposal?.type !== "suggestion") throw new Error("Missing proposal");
  const group = parseSuggestionGroup(proposal.payload);
  expect(group.changes).toHaveLength(2);
  expect(group.baseDocument.blocks[0]!.content).toBe("Keep me");
  expect(group.summary).toContain("合成例");
  expect(fetch).not.toHaveBeenCalled();
});
it("labels research as unchecked and previews a fixed eerie sample only when requested", async () => {
  for (const [phase, direction, expected] of [["research", "", "実際の検索や出典の確認は行っていません"], ["draft", "もっと不気味な雰囲気にして", "消したはずの明かり"]]) {
    const pending = collect(createSyntheticAheadAdapter(), request(phase, direction));
    await vi.advanceTimersByTimeAsync(700);
    expect(JSON.stringify(await pending)).toContain(expected);
  }
});
it("acknowledges cancellation and yields no proposal afterward", async () => {
  const adapter = createSyntheticAheadAdapter(), stream = adapter.start(request())[Symbol.asyncIterator]();
  expect((await stream.next()).value.type).toBe("status");
  const next = stream.next(); await adapter.cancel("test-run");
  expect((await next).done).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect((await stream.next()).done).toBe(true);
});
