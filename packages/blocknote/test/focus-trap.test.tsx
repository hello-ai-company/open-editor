/** @vitest-environment jsdom */
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useDialogFocusTrap } from "../src/react/useDialogFocusTrap.js";

function Dialog({ open }: { open: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(open, dialogRef);
  return (
    <>
      <button data-testid="opener">Open</button>
      {open ? (
        <div ref={dialogRef} role="dialog" tabIndex={-1}>
          <button data-testid="first">First</button>
          <button data-testid="last">Last</button>
        </div>
      ) : null}
      <button data-testid="outside">Outside</button>
    </>
  );
}

describe("modal focus trap", () => {
  it("loops Tab, contains programmatic focus, and restores the opener", () => {
    const priorActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(createElement(Dialog, { open: false })));
    const opener = container.querySelector('[data-testid="opener"]') as HTMLButtonElement;
    opener.focus();
    act(() => root.render(createElement(Dialog, { open: true })));

    const first = container.querySelector('[data-testid="first"]') as HTMLButtonElement;
    const last = container.querySelector('[data-testid="last"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(first);

    last.focus();
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);

    (container.querySelector('[data-testid="outside"]') as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(first);

    act(() => root.render(createElement(Dialog, { open: false })));
    expect(document.activeElement).toBe(opener);
    act(() => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorActFlag;
  });
});
