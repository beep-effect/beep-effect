/**
 * Effect service wrapper for Playwright browsers, including scoped context and
 * page creation, lifecycle operations, and browser event streams.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { makeBrowserContext } from "./BrowserContext.ts";
import { useHelper } from "./internal/use.ts";
import { makePage } from "./Page.ts";
import type { LazyArg } from "effect/Function";
import type * as Scope from "effect/Scope";
import type { BrowserType, Browser as CoreBrowser, BrowserContext as CoreBrowserContext, chromium } from "playwright";
import type { BrowserContextShape } from "./BrowserContext.ts";
import type { PageShape } from "./Page.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Browser");

/**
 * Options for launching a Playwright browser.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LaunchOptions = Parameters<typeof chromium.launch>[0];
/**
 * Options for creating a page directly from a browser.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NewPageOptions = Parameters<CoreBrowser["newPage"]>[0];
/**
 * Options for creating a browser context.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NewContextOptions = Parameters<CoreBrowser["newContext"]>[0];

interface BrowserEvents {
  readonly context: CoreBrowserContext;
  readonly disconnected: CoreBrowser;
}

interface BrowserEventValues {
  readonly context: BrowserContextShape;
  readonly disconnected: BrowserShape;
}

type EventMappings = {
  readonly [K in keyof BrowserEvents]: (value: BrowserEvents[K]) => BrowserEventValues[K];
};

type EventListeners = {
  readonly [K in keyof BrowserEvents]: (
    listener: (value: BrowserEvents[K]) => void
  ) => readonly [subscribe: LazyArg<unknown>, unsubscribe: LazyArg<unknown>];
};

const eventMappings: EventMappings = {
  disconnected: (browser) => makeBrowser(browser),
  context: (context) => makeBrowserContext(context),
};

const eventListeners = (browser: CoreBrowser): EventListeners => ({
  disconnected: (listener) => [() => browser.on("disconnected", listener), () => browser.off("disconnected", listener)],
  context: (listener) => [() => browser.on("context", listener), () => browser.off("context", listener)],
});

/**
 * Effect-friendly operations for a running Playwright browser.
 *
 * **When to use**
 *
 * Use this service to create pages or isolated browser contexts, inspect the
 * browser, consume browser events, or access an unsupported native operation.
 * Prefer `Playwright.launchScoped` or `PlaywrightSpawner.withBrowser` when this
 * service owns the browser process.
 *
 * @category models
 * @since 0.0.0
 */
export interface BrowserShape {
  /**
   * Binds the browser to a title.
   *
   * @see {@link CoreBrowser.bind} for the wrapped Playwright method.
   */
  readonly bind: (
    title: string,
    options?: Parameters<CoreBrowser["bind"]>[1]
  ) => Effect.Effect<Awaited<ReturnType<CoreBrowser["bind"]>>, PlaywrightError>;
  /**
   * Returns the browser type (chromium, firefox or webkit) that the browser belongs to.
   *
   * @see {@link CoreBrowser.browserType} for the wrapped Playwright method.
   */
  readonly browserType: () => BrowserType;
  /**
   * An Effect that closes the browser and all of its pages.
   *
   * @see {@link CoreBrowser.close} for the wrapped Playwright method.
   */
  readonly close: Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the list of all open browser contexts.
   *
   * @see {@link CoreBrowser.contexts} for the wrapped Playwright method.
   */
  readonly contexts: () => Array<BrowserContextShape>;
  /**
   * Streams browser events after adapting their payloads to wrapper values.
   *
   * **Details**
   *
   * Event listeners are removed when stream consumption ends. The stream also
   * ends when the browser disconnects.
   *
   * @see {@link CoreBrowser.on} for the wrapped Playwright method.
   */
  readonly eventStream: <K extends keyof BrowserEvents>(event: K) => Stream.Stream<BrowserEventValues[K]>;
  /**
   * Returns whether the browser is connected.
   *
   * @see {@link CoreBrowser.isConnected} for the wrapped Playwright method.
   */
  readonly isConnected: () => boolean;
  /**
   * Creates an isolated browser context managed by the current `Scope`.
   *
   * **Details**
   *
   * The context is closed automatically when the scope ends, including after
   * failure or interruption.
   *
   * @see {@link CoreBrowser.newContext} for the wrapped Playwright method.
   */
  readonly newContext: (
    options?: NewContextOptions
  ) => Effect.Effect<BrowserContextShape, PlaywrightError, Scope.Scope>;
  /**
   * Opens a new page in the browser.
   *
   * @see {@link CoreBrowser.newPage} for the wrapped Playwright method.
   */
  readonly newPage: (options?: NewPageOptions) => Effect.Effect<PageShape, PlaywrightError>;
  /**
   * Unbinds the browser.
   *
   * @see {@link CoreBrowser.unbind} for the wrapped Playwright method.
   */
  readonly unbind: Effect.Effect<void, PlaywrightError>;
  /**
   * Runs an asynchronous operation against the underlying Playwright `Browser`.
   *
   * **When to use**
   *
   * Use this escape hatch only when `BrowserShape` does not expose the native
   * Playwright operation you need.
   *
   * **Gotchas**
   *
   * The callback must return a `Promise`. The browser remains owned by the
   * service that created it, so do not close it here when using scoped
   * acquisition.
   *
   * **Example** (Read the native browser version)
   *
   * ```ts
   * import { Browser } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const browser = yield* Browser
   *   return yield* browser.use(async (nativeBrowser) => nativeBrowser.version())
   * })
   * ```
   *
   * @param f - A function that receives the native browser and returns a promise.
   * @see {@link CoreBrowser} for the wrapped Playwright browser.
   */
  readonly use: <T>(f: (browser: CoreBrowser) => Promise<T>) => Effect.Effect<T, PlaywrightError>;
  /**
   * Returns the version of the browser.
   *
   * @see {@link CoreBrowser.version} for the wrapped Playwright method.
   */
  readonly version: () => string;
}

/**
 * Service for the active {@link BrowserShape}.
 *
 * **Example** (Open a page in the provided browser)
 *
 * ```ts
 * import { Browser } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const opened = Effect.gen(function* () {
 *   const browser = yield* Browser
 *   const page = yield* browser.newPage()
 *   yield* page.setContent("<h1>Effect</h1>")
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Browser extends Context.Service<Browser, BrowserShape>()($I`Browser`) {}

/**
 * Creates a `Browser` from a Playwright `Browser` instance.
 *
 * **Example** (Wrap a native browser)
 *
 * ```ts
 * import { makeBrowser } from "@beep/playwright"
 * import type { Browser } from "playwright"
 *
 * const versionOf = (browser: Browser) => makeBrowser(browser).version()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBrowser = (browser: CoreBrowser): BrowserShape => {
  const use = useHelper(browser);
  const listeners = eventListeners(browser);

  return Browser.of({
    newPage: Effect.fn("Browser.newPage")((options) => use((b) => b.newPage(options).then(makePage))),
    close: use((b) => b.close()),
    contexts: () => A.map(browser.contexts(), makeBrowserContext),
    newContext: Effect.fn("Browser.newContext")((options) =>
      Effect.acquireRelease(
        use((b) => b.newContext(options).then(makeBrowserContext)),
        (context) => context.close.pipe(Effect.ignore({ log: true }))
      )
    ),
    browserType: () => browser.browserType(),
    version: () => browser.version(),
    isConnected: () => browser.isConnected(),
    bind: Effect.fn("Browser.bind")((title, options) => use((b) => b.bind(title, options))),
    unbind: use((b) => b.unbind()),
    eventStream: <K extends keyof BrowserEvents>(event: K) =>
      Stream.callback<BrowserEvents[K]>((queue) => {
        const [subscribe, unsubscribe] = listeners[event]((value) => {
          Queue.offerUnsafe(queue, value);
        });
        const end = () => {
          Queue.endUnsafe(queue);
        };
        return Effect.acquireRelease(
          Effect.sync(() => {
            subscribe();
            browser.once("disconnected", end);
          }),
          () =>
            Effect.sync(() => {
              unsubscribe();
              browser.off("disconnected", end);
            })
        );
      }).pipe(Stream.map((value) => eventMappings[event](value))),
    use,
  });
};
