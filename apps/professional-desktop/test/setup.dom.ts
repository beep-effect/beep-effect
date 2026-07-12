/**
 * jsdom polyfills for browser APIs the desktop shell mounts in tests.
 */

// jsdom has no layout, so it ships no ResizeObserver. The resizable chat panes
// measure themselves with one, and without it the whole shell fails to mount.
// Observing nothing is the honest stub: there are no size changes to report.
if (typeof globalThis.ResizeObserver !== "function") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

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
