import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const dialogStack: HTMLElement[] = [];

/** Keeps keyboard and programmatic focus inside an open modal and restores its opener. */
export function useDialogFocusTrap<T extends HTMLElement>(
  open: boolean,
  dialogRef: RefObject<T | null>
): void {
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogStack.push(dialog);
    const getFocusable = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[hidden], [inert], [aria-hidden='true']")
      );
    const focusFirst = () => (getFocusable()[0] ?? dialog).focus();

    if (!dialog.contains(document.activeElement)) focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== dialog || event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeIndex = focusable.findIndex(
        (element) =>
          element === document.activeElement || element.contains(document.activeElement)
      );
      if (activeIndex < 0) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeIndex === focusable.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (dialogStack[dialogStack.length - 1] !== dialog) return;
      if (!dialog.contains(event.target as Node)) focusFirst();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      const stackIndex = dialogStack.lastIndexOf(dialog);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, dialogRef]);
}
