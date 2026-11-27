/**
 * Effect service wrapper for Playwright browser contexts, including pages,
 * storage state, tracing, credentials, and event streams.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { makeBrowser } from "./Browser.ts";
import { makeClock } from "./Clock.ts";
import { makeDialog, makeDownload, makeRequest, makeResponse, makeWorker } from "./Common.ts";
import { makeCredentials } from "./Credentials.ts";
import { makeFrame } from "./Frame.ts";
import { useHelper } from "./internal/use.ts";
import { makePage } from "./Page.ts";
import { makeTracing } from "./Tracing.ts";
import type { LazyArg } from "effect/Function";
import type {
  ConsoleMessage,
  BrowserContext as CoreBrowserContext,
  Dialog as CoreDialog,
  Download as CoreDownload,
  Frame as CoreFrame,
  Page as CorePage,
  Request as CoreRequest,
  Response as CoreResponse,
  Worker as CoreWorker,
  WebError,
} from "playwright";
import type { BrowserShape } from "./Browser.ts";
import type { ClockShape } from "./Clock.ts";
import type { DialogShape, DownloadShape, RequestShape, ResponseShape, WorkerShape } from "./Common.ts";
import type { CredentialsShape } from "./Credentials.ts";
import type { FrameShape } from "./Frame.ts";
import type { PageShape } from "./Page.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";
import type { PageFunction } from "./PlaywrightTypes.ts";
import type { TracingShape } from "./Tracing.ts";

const $I = $PlaywrightId.create("BrowserContext");

interface BrowserContextEvents {
  readonly backgroundpage: CorePage;
  readonly close: CoreBrowserContext;
  readonly console: ConsoleMessage;
  readonly dialog: CoreDialog;
  readonly dialogclosed: CoreDialog;
  readonly download: CoreDownload;
  readonly frameattached: CoreFrame;
  readonly framedetached: CoreFrame;
  readonly framenavigated: CoreFrame;
  readonly page: CorePage;
  readonly pageclose: CorePage;
  readonly pageload: CorePage;
  readonly request: CoreRequest;
  readonly requestfailed: CoreRequest;
  readonly requestfinished: CoreRequest;
  readonly response: CoreResponse;
  readonly serviceworker: CoreWorker;
  readonly weberror: WebError;
}

interface BrowserContextEventValues {
  readonly backgroundpage: PageShape;
  readonly close: BrowserContextShape;
  readonly console: ConsoleMessage;
  readonly dialog: DialogShape;
  readonly dialogclosed: DialogShape;
  readonly download: DownloadShape;
  readonly frameattached: FrameShape;
  readonly framedetached: FrameShape;
  readonly framenavigated: FrameShape;
  readonly page: PageShape;
  readonly pageclose: PageShape;
  readonly pageload: PageShape;
  readonly request: RequestShape;
  readonly requestfailed: RequestShape;
  readonly requestfinished: RequestShape;
  readonly response: ResponseShape;
  readonly serviceworker: WorkerShape;
  readonly weberror: WebError;
}

type EventMappings = {
  readonly [K in keyof BrowserContextEvents]: (value: BrowserContextEvents[K]) => BrowserContextEventValues[K];
};

type EventListeners = {
  readonly [K in keyof BrowserContextEvents]: (
    listener: (value: BrowserContextEvents[K]) => void
  ) => readonly [subscribe: LazyArg<unknown>, unsubscribe: LazyArg<unknown>];
};

const eventMappings: EventMappings = {
  backgroundpage: (page) => makePage(page),
  close: (context) => makeBrowserContext(context),
  console: identity,
  dialog: (dialog) => makeDialog(dialog),
  dialogclosed: (dialog) => makeDialog(dialog),
  download: (download) => makeDownload(download),
  frameattached: (frame) => makeFrame(frame),
  framedetached: (frame) => makeFrame(frame),
  framenavigated: (frame) => makeFrame(frame),
  page: (page) => makePage(page),
  pageclose: (page) => makePage(page),
  pageload: (page) => makePage(page),
  request: (request) => makeRequest(request),
  requestfailed: (request) => makeRequest(request),
  requestfinished: (request) => makeRequest(request),
  response: (response) => makeResponse(response),
  serviceworker: (worker) => makeWorker(worker),
  weberror: identity,
};

const eventListeners = (context: CoreBrowserContext): EventListeners => ({
  backgroundpage: (listener) => [
    () => context.on("backgroundpage", listener),
    () => context.off("backgroundpage", listener),
  ],
  close: (listener) => [() => context.on("close", listener), () => context.off("close", listener)],
  console: (listener) => [() => context.on("console", listener), () => context.off("console", listener)],
  dialog: (listener) => [() => context.on("dialog", listener), () => context.off("dialog", listener)],
  dialogclosed: (listener) => [() => context.on("dialogclosed", listener), () => context.off("dialogclosed", listener)],
  download: (listener) => [() => context.on("download", listener), () => context.off("download", listener)],
  frameattached: (listener) => [
    () => context.on("frameattached", listener),
    () => context.off("frameattached", listener),
  ],
  framedetached: (listener) => [
    () => context.on("framedetached", listener),
    () => context.off("framedetached", listener),
  ],
  framenavigated: (listener) => [
    () => context.on("framenavigated", listener),
    () => context.off("framenavigated", listener),
  ],
  page: (listener) => [() => context.on("page", listener), () => context.off("page", listener)],
  pageclose: (listener) => [() => context.on("pageclose", listener), () => context.off("pageclose", listener)],
  pageload: (listener) => [() => context.on("pageload", listener), () => context.off("pageload", listener)],
  request: (listener) => [() => context.on("request", listener), () => context.off("request", listener)],
  requestfailed: (listener) => [
    () => context.on("requestfailed", listener),
    () => context.off("requestfailed", listener),
  ],
  requestfinished: (listener) => [
    () => context.on("requestfinished", listener),
    () => context.off("requestfinished", listener),
  ],
  response: (listener) => [() => context.on("response", listener), () => context.off("response", listener)],
  serviceworker: (listener) => [
    () => context.on("serviceworker", listener),
    () => context.off("serviceworker", listener),
  ],
  weberror: (listener) => [() => context.on("weberror", listener), () => context.off("weberror", listener)],
});

/**
 * Effect-friendly operations for an isolated Playwright browser context.
 *
 * **When to use**
 *
 * Use a context to isolate cookies, permissions, storage, pages, and tracing
 * within one browser. Contexts created by `Browser.newContext` are scoped and
 * close automatically when their scope ends.
 *
 * @category models
 * @since 0.0.0
 */
export interface BrowserContextShape {
  /**
   * Sets the cookies for the browser context.
   *
   * @see {@link CoreBrowserContext.addCookies} for the wrapped Playwright method.
   */
  readonly addCookies: (
    cookies: Parameters<CoreBrowserContext["addCookies"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Adds a script which would be evaluated in one of the following scenarios:
   * - Whenever a page is created in the browser context or is navigated.
   * - Whenever a child frame is attached or navigated. In this case, the script is evaluated in the context of the newly attached frame.
   *
   * @see {@link CoreBrowserContext.addInitScript} for the wrapped Playwright method.
   */
  readonly addInitScript: <Arg>(
    script: PageFunction<Arg, unknown> | { path?: string; content?: string },
    arg?: Arg,
    options?: Parameters<CoreBrowserContext["addInitScript"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the browser that the context belongs to.
   *
   * @see {@link CoreBrowserContext.browser} for the wrapped Playwright method.
   */
  readonly browser: () => O.Option<BrowserShape>;
  /**
   * Clears the cookies from the browser context.
   *
   * @see {@link CoreBrowserContext.clearCookies} for the wrapped Playwright method.
   */
  readonly clearCookies: (options?: {
    name?: string | RegExp;
    domain?: string | RegExp;
    path?: string | RegExp;
  }) => Effect.Effect<void, PlaywrightError>;
  /**
   * Clears the permissions from the browser context.
   *
   * @see {@link CoreBrowserContext.clearPermissions} for the wrapped Playwright method.
   */
  readonly clearPermissions: Effect.Effect<void, PlaywrightError>;
  /**
   * Access the clock.
   *
   * @see {@link CoreBrowserContext.clock} for the wrapped Playwright property.
   */
  readonly clock: ClockShape;
  /**
   * Closes the browser context.
   *
   * @see {@link CoreBrowserContext.close} for the wrapped Playwright method.
   */
  readonly close: Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the cookies for the browser context.
   *
   * @see {@link CoreBrowserContext.cookies} for the wrapped Playwright method.
   */
  readonly cookies: (
    urls?: string | string[]
  ) => Effect.Effect<Awaited<ReturnType<CoreBrowserContext["cookies"]>>, PlaywrightError>;
  /**
   * Access the virtual WebAuthn credentials manager.
   *
   * @see {@link CoreBrowserContext.credentials} for the wrapped Playwright property.
   */
  readonly credentials: CredentialsShape;
  /**
   * Streams browser-context events after adapting their payloads to wrapper
   * values.
   *
   * **Details**
   *
   * Event listeners are removed when stream consumption ends. The stream also
   * ends when the browser context closes.
   *
   * @see {@link CoreBrowserContext.on} for the wrapped Playwright method.
   */
  readonly eventStream: <K extends keyof BrowserContextEvents>(event: K) => Stream.Stream<BrowserContextEventValues[K]>;
  /**
   * Grants permissions to the browser context.
   *
   * @see {@link CoreBrowserContext.grantPermissions} for the wrapped Playwright method.
   */
  readonly grantPermissions: (
    permissions: Parameters<CoreBrowserContext["grantPermissions"]>[0],
    options?: Parameters<CoreBrowserContext["grantPermissions"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Indicates that the browser context is in the process of closing or has already been closed.
   *
   * @see {@link CoreBrowserContext.isClosed} for the wrapped Playwright method.
   */
  readonly isClosed: () => boolean;
  /**
   * Opens a new page in the browser context.
   *
   * @see {@link CoreBrowserContext.newPage} for the wrapped Playwright method.
   */
  readonly newPage: Effect.Effect<PageShape, PlaywrightError>;
  /**
   * Returns the list of all open pages in the browser context.
   *
   * @see {@link CoreBrowserContext.pages} for the wrapped Playwright method.
   */
  readonly pages: () => Array<PageShape>;
  /**
   * Sets the default navigation timeout for the browser context.
   *
   * @see {@link CoreBrowserContext.setDefaultNavigationTimeout} for the wrapped Playwright method.
   */
  readonly setDefaultNavigationTimeout: (timeout: number) => void;
  /**
   * Sets the default timeout for the browser context.
   *
   * @see {@link CoreBrowserContext.setDefaultTimeout} for the wrapped Playwright method.
   */
  readonly setDefaultTimeout: (timeout: number) => void;
  /**
   * Sets the extra HTTP headers for the browser context.
   *
   * @see {@link CoreBrowserContext.setExtraHTTPHeaders} for the wrapped Playwright method.
   */
  readonly setExtraHTTPHeaders: (
    headers: Parameters<CoreBrowserContext["setExtraHTTPHeaders"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sets the geolocation for the browser context.
   *
   * @see {@link CoreBrowserContext.setGeolocation} for the wrapped Playwright method.
   */
  readonly setGeolocation: (
    geolocation: Parameters<CoreBrowserContext["setGeolocation"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sets the offline state for the browser context.
   *
   * @see {@link CoreBrowserContext.setOffline} for the wrapped Playwright method.
   */
  readonly setOffline: (offline: boolean) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sets the storage state for the browser context.
   *
   * @see {@link CoreBrowserContext.setStorageState} for the wrapped Playwright method.
   */
  readonly setStorageState: (
    options: Parameters<CoreBrowserContext["setStorageState"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns storage state for this browser context, contains current cookies, local storage snapshot and IndexedDB
   * snapshot.
   *
   * @see {@link CoreBrowserContext.storageState} for the wrapped Playwright method.
   */
  readonly storageState: (
    options?: Parameters<CoreBrowserContext["storageState"]>[0]
  ) => Effect.Effect<Awaited<ReturnType<CoreBrowserContext["storageState"]>>, PlaywrightError>;
  /**
   * Access the tracing.
   *
   * @see {@link CoreBrowserContext.tracing} for the wrapped Playwright property.
   */
  readonly tracing: TracingShape;
}

/**
 * Service for the active {@link BrowserContextShape}.
 *
 * **Example** (Open a page in the provided context)
 *
 * ```ts
 * import { BrowserContext } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const opened = Effect.gen(function* () {
 *   const context = yield* BrowserContext
 *   const page = yield* context.newPage
 *   yield* page.setContent("<h1>Effect</h1>")
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BrowserContext extends Context.Service<BrowserContext, BrowserContextShape>()($I`BrowserContext`) {}

/**
 * Creates a `BrowserContext` from a Playwright `BrowserContext` instance.
 *
 * **Example** (Wrap a native browser context)
 *
 * ```ts
 * import { makeBrowserContext } from "@beep/playwright"
 * import type { BrowserContext } from "playwright"
 *
 * const openPage = (context: BrowserContext) => makeBrowserContext(context).newPage
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBrowserContext = (context: CoreBrowserContext): BrowserContextShape => {
  const use = useHelper(context);
  const listeners = eventListeners(context);

  return BrowserContext.of({
    clock: makeClock(context.clock),
    credentials: makeCredentials(context.credentials),
    tracing: makeTracing(context.tracing),
    pages: () => A.map(context.pages(), makePage),
    newPage: use((c) => c.newPage().then(makePage)),
    close: use((c) => c.close()),
    isClosed: () => context.isClosed(),
    addInitScript: Effect.fn("BrowserContext.addInitScript")(
      <Arg>(
        script: PageFunction<Arg, unknown> | { path?: string; content?: string },
        arg?: Arg,
        options?: Parameters<CoreBrowserContext["addInitScript"]>[2]
      ) =>
        use((c) => c.addInitScript<Arg>(script as Parameters<typeof c.addInitScript<Arg>>[0], arg, options)).pipe(
          Effect.asVoid
        )
    ),
    browser: () => O.map(O.fromNullishOr(context.browser()), makeBrowser),
    clearCookies: Effect.fn("BrowserContext.clearCookies")((options) => use((c) => c.clearCookies(options))),
    clearPermissions: use((c) => c.clearPermissions()),
    cookies: Effect.fn("BrowserContext.cookies")((urls) => use((c) => c.cookies(urls))),
    addCookies: Effect.fn("BrowserContext.addCookies")((cookies) => use((c) => c.addCookies(cookies))),
    grantPermissions: Effect.fn("BrowserContext.grantPermissions")((permissions, options) =>
      use((c) => c.grantPermissions(permissions, options))
    ),
    setExtraHTTPHeaders: Effect.fn("BrowserContext.setExtraHTTPHeaders")((headers) =>
      use((c) => c.setExtraHTTPHeaders(headers))
    ),
    setGeolocation: Effect.fn("BrowserContext.setGeolocation")((geolocation) =>
      use((c) => c.setGeolocation(geolocation))
    ),
    setOffline: Effect.fn("BrowserContext.setOffline")((offline) => use((c) => c.setOffline(offline))),
    setDefaultNavigationTimeout: (timeout) => context.setDefaultNavigationTimeout(timeout),
    setDefaultTimeout: (timeout) => context.setDefaultTimeout(timeout),
    storageState: Effect.fn("BrowserContext.storageState")((options) => use((c) => c.storageState(options))),
    setStorageState: Effect.fn("BrowserContext.setStorageState")((options) => use((c) => c.setStorageState(options))),
    eventStream: <K extends keyof BrowserContextEvents>(event: K) =>
      Stream.callback<BrowserContextEvents[K]>((queue) => {
        const [subscribe, unsubscribe] = listeners[event]((value) => {
          Queue.offerUnsafe(queue, value);
        });
        const end = () => {
          Queue.endUnsafe(queue);
        };
        return Effect.acquireRelease(
          Effect.sync(() => {
            subscribe();
            context.once("close", end);
          }),
          () =>
            Effect.sync(() => {
              unsubscribe();
              context.off("close", end);
            })
        );
      }).pipe(Stream.map((value) => eventMappings[event](value))),
  });
};
