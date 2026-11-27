// decision: browser-storage-fixtures
const localStorageIsUsable = (): boolean => {
  try {
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
      // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList compatibility mock must implement its legacy DOM members. Owner: @beep/oip-web. Exit: lib.dom drops the deprecated MediaQueryList listener members.
      addListener: () => {},
      // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList compatibility mock must implement its legacy DOM members. Owner: @beep/oip-web. Exit: lib.dom drops the deprecated MediaQueryList listener members.
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
