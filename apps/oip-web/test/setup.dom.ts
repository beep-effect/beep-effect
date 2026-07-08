/**
 * jsdom polyfills for browser APIs the test environment omits but client
 * components rely on: `matchMedia` (used by embla-carousel and the hero video's
 * reduced-motion guard), the `requestIdleCallback` pair (hero video defers its
 * fetch to idle), and `localStorage` (the OIP Atom runtime and progressive
 * theme script). Each is installed only when missing.
 *
 * The coverage lane runs plain-node vitest (v8 instrumentation) where Node's
 * native experimental `localStorage` getter resolves to `undefined` unless
 * `--localstorage-file` is passed, shadowing jsdom's own store; the Bun test
 * lane instead inherits Bun's working native `localStorage`. Installing an
 * in-memory store when the environment's `localStorage` is unusable keeps both
 * lanes' client code and tests backed by a real Web Storage.
 */

const localStorageIsUsable = (): boolean => {
  try {
    // A real Web Storage exposes the whole API together, so probing one
    // method distinguishes it from Node's native getter (which yields
    // `undefined`) without enumerating the surface.
    const store = window.localStorage as Storage | undefined;
    return typeof store?.clear === "function";
  } catch {
    return false;
  }
};

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    clear: (): void => store.clear(),
    getItem: (key: string): string | null => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string): void => {
      store.delete(key);
    },
    setItem: (key: string, value: string): void => {
      store.set(key, String(value));
    },
  } as Storage;
};

if (typeof window !== "undefined" && !localStorageIsUsable()) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
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

if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): ReadonlyArray<IntersectionObserverEntry> {
      return [];
    }
  }
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof window !== "undefined" && typeof window.requestIdleCallback !== "function") {
  window.requestIdleCallback = ((callback: IdleRequestCallback): number =>
    window.setTimeout(
      () => callback({ didTimeout: false, timeRemaining: () => 50 }),
      1
    ) as unknown as number) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = ((handle: number): void => {
    window.clearTimeout(handle);
  }) as typeof window.cancelIdleCallback;
}
