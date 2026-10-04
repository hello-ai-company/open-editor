export function installDecorativeMotion(
  well: HTMLElement,
  options: { assetBase: string; playOnEnter?: boolean; once?: { current: boolean } }
): { stop: () => void; dispose: () => void; readonly state: string };
