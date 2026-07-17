/**
 * jsdom polyfills for browser APIs the desktop shell mounts in tests.
 */

import { ControllableResizeObserver } from "@beep/dock-react/internal/ResizeObserverHarness";

// jsdom has no layout, so it ships no ResizeObserver. The dock shell and the
// resizable chat panes measure themselves with one, and without it the whole
// shell fails to mount. The dock adapter's controllable harness is the honest
// stand-in: it observes silently by default, and a test that needs real
// geometry drives it explicitly with `resize()`.
globalThis.ResizeObserver = ControllableResizeObserver;

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
