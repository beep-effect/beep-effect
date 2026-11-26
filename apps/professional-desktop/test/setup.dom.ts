/**
 * jsdom polyfills for browser APIs the desktop shell mounts in tests.
 */

import { ControllableResizeObserver } from "@beep/dock-react/internal/ResizeObserverHarness";

globalThis.ResizeObserver = ControllableResizeObserver;

// fallow-ignore-next-line code-duplication -- jsdom matchMedia shim repeats the browser setup that sibling UI test setups need. Owner: @beep/professional-desktop. Exit: import a shared DOM test setup from @beep/test-utils once it provides one.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList compatibility mock must implement its legacy DOM members. Owner: @beep/professional-desktop. Exit: lib.dom drops the deprecated MediaQueryList listener members.
      addListener: () => {},
      // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList compatibility mock must implement its legacy DOM members. Owner: @beep/professional-desktop. Exit: lib.dom drops the deprecated MediaQueryList listener members.
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
