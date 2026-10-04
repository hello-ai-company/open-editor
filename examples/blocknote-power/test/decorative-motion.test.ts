// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installDecorativeMotion } from "../src/decorativeMotion.mjs";

let notify: (visible: boolean) => void;
let reduced = false;
let saveData = false;
let memory = 8;
const cleanup: Array<() => void> = [];

beforeEach(() => {
  reduced = false; saveData = false; memory = 8;
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(navigator, "connection", { configurable: true, get: () => ({ saveData, addEventListener() {}, removeEventListener() {} }) });
  Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => memory });
  vi.stubGlobal("matchMedia", (query: string) => ({ get matches() { return query.includes("reduced-motion") ? reduced : true; }, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: unknown[]) => void) {}
    observe(well: HTMLElement) { notify = (visible) => this.callback([{ target: well, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); }
    disconnect() {}
  });
});
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(once = { current: false }) {
  const well = document.createElement("div");
  well.innerHTML = '<img alt="" src="/motion/idea-unfold/reduced-motion.webp">';
  document.body.append(well);
  const controller = installDecorativeMotion(well, { assetBase: "/motion/idea-unfold", once });
  cleanup.push(controller.dispose);
  return { well, controller };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("decorative media lifecycle", () => {
  for (const mode of ["reduced", "save-data", "low-memory"] as const) {
    it(`does not create or fetch a video with ${mode}`, async () => {
      reduced = mode === "reduced"; saveData = mode === "save-data"; memory = mode === "low-memory" ? 4 : 8;
      const { well } = mount(); notify(true); await flush();
      expect(well.querySelector("video")).toBeNull();
      expect(well.querySelector("img")?.hidden).toBe(false);
    });
  }
  it("waits for visibility, plays one mobile source and does not replay after stop or remount", async () => {
    const once = { current: false };
    const { well, controller } = mount(once);
    expect(well.querySelector("video")).toBeNull();
    notify(true); await flush();
    const video = well.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/motion/idea-unfold/motion-mobile.mp4");
    expect(video.loop).toBe(false); expect(video.muted).toBe(true); expect(video.preload).toBe("none");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(well.querySelector("video")).toBeNull();
    notify(true); await flush(); expect(well.querySelector("video")).toBeNull();
    controller.dispose();
    const next = mount(once); notify(true); await flush(); expect(next.well.querySelector("video")).toBeNull();
  });
  for (const interruption of ["ended", "error", "offscreen", "background"] as const) {
    it(`returns to a useful still after ${interruption}`, async () => {
      const { well } = mount(); notify(true); await flush();
      if (interruption === "offscreen") notify(false);
      else if (interruption === "background") {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      } else well.querySelector("video")!.dispatchEvent(new Event(interruption));
      expect(well.querySelector("video")).toBeNull(); expect(well.querySelector("img")?.hidden).toBe(false);
      notify(true); await flush(); expect(well.querySelector("video")).toBeNull();
    });
  }
  it("catches autoplay rejection and cleans up a pending play on disposal", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("autoplay denied"));
    const { well } = mount(); notify(true); await flush();
    expect(well.querySelector("video")).toBeNull(); expect(well.querySelector("img")?.hidden).toBe(false);
    let resolvePlay!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() => new Promise<void>(resolve => { resolvePlay = resolve; }));
    const next = mount(); notify(true); next.controller.dispose(); resolvePlay(); await flush();
    expect(next.well.querySelector("video")).toBeNull(); expect(next.well.querySelector("img")?.hidden).toBe(false);
  });
});
