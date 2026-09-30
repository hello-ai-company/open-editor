export type DemoAiAction = "preparing" | "review" | "accepting" | "accepted" | "rejecting" | "rejected" | "stale" | "error" | null;

export type DemoAiSourceBlock = {
  readonly id: string;
  readonly type: string;
  readonly content?: unknown;
};

export type DemoAiSourceResolution<Block extends DemoAiSourceBlock> =
  | { readonly action: null; readonly block: Block; readonly status: null }
  | { readonly action: "stale"; readonly block: null; readonly status: string };

export function isDemoAiBusy(action: DemoAiAction): boolean;
export function canImproveDemoSelection(hasSelection: boolean, action: DemoAiAction): boolean;
export function resolveDemoAiSource<Block extends DemoAiSourceBlock>(
  blocks: readonly Block[],
  blockId: string,
  selectedText: string
): DemoAiSourceResolution<Block>;
