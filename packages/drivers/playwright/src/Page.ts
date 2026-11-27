/**
 * Effect service wrapper for Playwright pages, including navigation, DOM
 * interaction, evaluation, media capture, and event streams.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow, identity } from "effect/Function";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { makeBrowserContext } from "./BrowserContext.ts";
import { makeClock } from "./Clock.ts";
import { makeDialog, makeDownload, makeFileChooser, makeRequest, makeResponse, makeWorker } from "./Common.ts";
import { makeFrame } from "./Frame.ts";
import { makeFrameLocator } from "./FrameLocator.ts";
import { useHelper } from "./internal/use.ts";
import { makeKeyboard } from "./Keyboard.ts";
import { makeLocator } from "./Locator.ts";
import { makeMouse } from "./Mouse.ts";
import { makeScreencast } from "./Screencast.ts";
import { makeTouchscreen } from "./Touchscreen.ts";
import { makeWebMCP } from "./WebMCP.ts";
import { makeWebStorage } from "./WebStorage.ts";
import type {
  ConsoleMessage,
  Dialog as CoreDialog,
  Download as CoreDownload,
  FileChooser as CoreFileChooser,
  Frame as CoreFrame,
  Page as CorePage,
  Request as CoreRequest,
  Response as CoreResponse,
  Worker as CoreWorker,
  ElementHandle,
  WebSocket,
} from "playwright";
import type { BrowserContextShape } from "./BrowserContext.ts";
import type { ClockShape } from "./Clock.ts";
import type {
  DialogShape,
  DownloadShape,
  FileChooserShape,
  RequestShape,
  ResponseShape,
  WorkerShape,
} from "./Common.ts";
import type { FrameShape } from "./Frame.ts";
import type { FrameLocatorShape } from "./FrameLocator.ts";
import type { PatchedEvents } from "./internal/events.ts";
import type { KeyboardShape } from "./Keyboard.ts";
import type { LocatorShape } from "./Locator.ts";
import type { MouseShape } from "./Mouse.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";
import type { AriaSnapshotJSON, PageFunction } from "./PlaywrightTypes.ts";
import type { ScreencastShape } from "./Screencast.ts";
import type { TouchscreenShape } from "./Touchscreen.ts";
import type { WebMCPShape } from "./WebMCP.ts";
import type { WebStorageShape } from "./WebStorage.ts";

const $I = $PlaywrightId.create("Page");

interface CorePageEventMap {
  close: CorePage;
  console: ConsoleMessage;
  crash: CorePage;
  dialog: CoreDialog;
  dialogclosed: CoreDialog;
  domcontentloaded: CorePage;
  download: CoreDownload;
  filechooser: CoreFileChooser;
  frameattached: CoreFrame;
  framedetached: CoreFrame;
  framenavigated: CoreFrame;
  load: CorePage;
  pageerror: Error;
  popup: CorePage;
  request: CoreRequest;
  requestfailed: CoreRequest;
  requestfinished: CoreRequest;
  response: CoreResponse;
  websocket: WebSocket;
  worker: CoreWorker;
}

/**
 * Values emitted by {@link PageShape.eventStream} for each supported page
 * event, with native Playwright values converted to this package's wrappers
 * where a wrapper exists.
 *
 * @category models
 * @since 0.0.0
 */
export interface PageEventMap {
  readonly close: PageShape;
  readonly console: ConsoleMessage;
  readonly crash: PageShape;
  readonly dialog: DialogShape;
  readonly dialogclosed: DialogShape;
  readonly domcontentloaded: PageShape;
  readonly download: DownloadShape;
  readonly filechooser: FileChooserShape;
  readonly frameattached: FrameShape;
  readonly framedetached: FrameShape;
  readonly framenavigated: FrameShape;
  readonly load: PageShape;
  readonly pageerror: Error;
  readonly popup: PageShape;
  readonly request: RequestShape;
  readonly requestfailed: RequestShape;
  readonly requestfinished: RequestShape;
  readonly response: ResponseShape;
  readonly websocket: WebSocket;
  readonly worker: WorkerShape;
}

type PageWithPatchedEvents = PatchedEvents<CorePage, CorePageEventMap>;

/**
 * Effect-friendly operations for a Playwright page.
 *
 * **When to use**
 *
 * Use for navigation, DOM interaction, evaluation, page state, and page event
 * streams. Operations that can fail return `Effect`; safe synchronous
 * observations remain plain functions, and nullable Playwright results are
 * represented with `Option`.
 *
 * @category models
 * @since 0.0.0
 */
export interface PageShape {
  /**
   * Adds a script which would be evaluated whenever the page is navigated, and
   * whenever a child frame is attached or navigated, in which case the script
   * is evaluated in the context of the newly attached frame.
   *
   * @see {@link CorePage.addInitScript} for the wrapped Playwright method.
   */
  readonly addInitScript: <Arg>(
    script: PageFunction<Arg, unknown> | { path?: string; content?: string },
    arg?: Arg,
    options?: Parameters<CorePage["addInitScript"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Adds a `<script>` tag into the page with the desired url or content.
   *
   * @see {@link CorePage.addScriptTag} for the wrapped Playwright method.
   */
  readonly addScriptTag: (
    options: Parameters<CorePage["addScriptTag"]>[0]
  ) => Effect.Effect<ElementHandle, PlaywrightError>;
  /**
   * Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content.
   *
   * @see {@link CorePage.addStyleTag} for the wrapped Playwright method.
   */
  readonly addStyleTag: (
    options: Parameters<CorePage["addStyleTag"]>[0]
  ) => Effect.Effect<ElementHandle, PlaywrightError>;
  /**
   * Captures the aria snapshot of the page.
   *
   * @see {@link CorePage.ariaSnapshot} for the wrapped Playwright method.
   */
  readonly ariaSnapshot: (options?: Parameters<CorePage["ariaSnapshot"]>[0]) => Effect.Effect<string, PlaywrightError>;
  /**
   * Captures the page's accessibility tree as a JSON value.
   *
   * @see {@link CorePage.ariaSnapshotJSON} for the wrapped Playwright method.
   */
  readonly ariaSnapshotJSON: (
    options?: Parameters<CorePage["ariaSnapshotJSON"]>[0]
  ) => Effect.Effect<AriaSnapshotJSON, PlaywrightError>;
  /**
   * Brings page to front (activates tab).
   *
   * @see {@link CorePage.bringToFront} for the wrapped Playwright method.
   */
  readonly bringToFront: Effect.Effect<void, PlaywrightError>;
  /**
   * Cancels the locator picking mode.
   *
   * @see {@link CorePage.cancelPickLocator} for the wrapped Playwright method.
   */
  readonly cancelPickLocator: Effect.Effect<void, PlaywrightError>;
  /**
   * Clears stored console messages.
   *
   * @see {@link CorePage.clearConsoleMessages} for the wrapped Playwright method.
   */
  readonly clearConsoleMessages: Effect.Effect<void, PlaywrightError>;
  /**
   * Clears stored page errors.
   *
   * @see {@link CorePage.clearPageErrors} for the wrapped Playwright method.
   */
  readonly clearPageErrors: Effect.Effect<void, PlaywrightError>;
  /**
   * Clicks an element matching the given selector.
   *
   * @deprecated Use {@link PageShape.locator} to create a locator and then call `click` on it instead.
   * @see {@link CorePage.click} for the wrapped Playwright method.
   */
  readonly click: (
    selector: string,
    options?: Parameters<CorePage["click"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Access the clock.
   */
  readonly clock: ClockShape;
  /**
   * Closes the page.
   *
   * @see {@link CorePage.close} for the wrapped Playwright method.
   */
  readonly close: Effect.Effect<void, PlaywrightError>;
  /**
   * Returns all messages that have been logged to the console.
   *
   * @see {@link CorePage.consoleMessages} for the wrapped Playwright method.
   */
  readonly consoleMessages: (
    options?: Parameters<CorePage["consoleMessages"]>[0]
  ) => Effect.Effect<ReadonlyArray<ConsoleMessage>, PlaywrightError>;
  /**
   * Returns the full HTML contents of the page, including the doctype.
   *
   * **Details**
   *
   * Pass `includeShadow: true` to serialize open shadow roots as declarative
   * shadow DOM.
   *
   * @see {@link CorePage.content} for the wrapped Playwright method.
   */
  readonly content: (options?: Parameters<CorePage["content"]>[0]) => Effect.Effect<string, PlaywrightError>;
  /**
   * Get the browser context that the page belongs to.
   *
   * @see {@link CorePage.context} for the wrapped Playwright method.
   */
  readonly context: () => BrowserContextShape;
  /**
   * Drags a source element to a target element and drops it.
   *
   * @see {@link CorePage.dragAndDrop} for the wrapped Playwright method.
   */
  readonly dragAndDrop: (
    source: Parameters<CorePage["dragAndDrop"]>[0],
    target: Parameters<CorePage["dragAndDrop"]>[1],
    options?: Parameters<CorePage["dragAndDrop"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * This method changes the CSS media type through the media argument,
   * and/or the 'prefers-colors-scheme' media feature, using the colorScheme argument.
   *
   * @see {@link CorePage.emulateMedia} for the wrapped Playwright method.
   */
  readonly emulateMedia: (options?: Parameters<CorePage["emulateMedia"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Evaluates a function in the context of the page.
   *
   * **Example** (Evaluating browser-side code)
   *
   * ```ts
   * import { Page } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const doubled = Effect.gen(function* () {
   *   const page = yield* Page
   *   return yield* page.evaluate((value: number) => value * 2, 21)
   * })
   * ```
   *
   * @see {@link CorePage.evaluate} for the wrapped Playwright method.
   */
  readonly evaluate: <R, Arg = void>(
    pageFunction: PageFunction<Arg, R>,
    arg?: Arg,
    options?: Parameters<CorePage["evaluate"]>[2]
  ) => Effect.Effect<R, PlaywrightError>;
  /**
   * Streams page events after adapting supported payloads to wrapper values.
   *
   * **Details**
   *
   * Event listeners are removed when stream consumption ends. The stream also
   * ends when the page closes.
   *
   * **Example** (Reading the first console event)
   *
   * ```ts
   * import { Page } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import * as Stream from "effect/Stream"
   *
   * const firstConsoleMessage = Effect.gen(function* () {
   *   const page = yield* Page
   *   return yield* page.eventStream("console").pipe(Stream.runHead)
   * })
   * ```
   *
   * @see {@link CorePage.on} for the wrapped Playwright event registration.
   */
  readonly eventStream: <K extends keyof PageEventMap>(event: K) => Stream.Stream<PageEventMap[K]>;
  /**
   * Identical to {@link PageShape.exposeFunction} but meant to be used with a
   * static `Effect` that needs no arguments and runs in the application
   * context.
   *
   * **Example** (Exposing a static Effect)
   *
   * ```ts
   * import { Browser } from "@beep/playwright"
   * import * as Console from "effect/Console"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const browser = yield* Browser
   *   const page = yield* browser.newPage()
   *
   *   yield* page.exposeEffect("ping", Console.log("pong"))
   *
   *   yield* page.evaluate("window.ping()")
   * })
   * ```
   *
   * @see {@link CorePage.exposeFunction} for the wrapped Playwright method.
   */
  readonly exposeEffect: <A, E, R>(
    name: Parameters<CorePage["exposeFunction"]>[0],
    playwrightFunction: Effect.Effect<A, E, R>
  ) => Effect.Effect<void, PlaywrightError, R>;
  /**
   * Adds a function called `name` on the `window` object of every frame in this page.
   *
   * **Details**
   *
   * The provided function must return an `Effect`, which is executed with the
   * current context when the function is called from the browser. Use
   * {@link PageShape.exposeEffect} when the function takes no arguments.
   *
   * **Example** (Exposing an Effect-based function to the browser)
   *
   * ```ts
   * import { Browser } from "@beep/playwright"
   * import * as Console from "effect/Console"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const browser = yield* Browser
   *   const page = yield* browser.newPage()
   *
   *   yield* page.exposeFunction("logMessage", (message: string) => Console.log(`Message from browser: ${message}`))
   *
   *   yield* page.evaluate("window.logMessage('Hello from the other side!')")
   * })
   * ```
   *
   * **Example** (Reaching application services from the browser)
   *
   * ```ts
   * import { Browser } from "@beep/playwright"
   * import * as Context from "effect/Context"
   * import * as Effect from "effect/Effect"
   *
   * class Database extends Context.Service<
   *   Database,
   *   { readonly insertProduct: (name: string, price: number) => Effect.Effect<void> }
   * >()("Database") {}
   *
   * const program = Effect.gen(function* () {
   *   const browser = yield* Browser
   *   const page = yield* browser.newPage()
   *
   *   yield* page.exposeFunction(
   *     "saveProduct",
   *     Effect.fn(function* (name: string, price: number) {
   *       const db = yield* Database
   *       yield* db.insertProduct(name, price)
   *     })
   *   )
   *
   *   yield* page.evaluate("window.saveProduct('Widget', 9)")
   * })
   * ```
   *
   * @see {@link CorePage.exposeFunction} for the wrapped Playwright method.
   */
  readonly exposeFunction: <A, E, R, Args extends unknown[]>(
    name: Parameters<CorePage["exposeFunction"]>[0],
    playwrightFunction: (...args: Args) => Effect.Effect<A, E, R>
  ) => Effect.Effect<void, PlaywrightError, R>;
  /**
   * Returns a frame matching the specified criteria.
   *
   * @see {@link CorePage.frame} for the wrapped Playwright method.
   */
  readonly frame: (frameSelector: Parameters<CorePage["frame"]>[0]) => O.Option<FrameShape>;
  /**
   * Creates a frame locator that searches the page's frame subtree.
   *
   * **Details**
   *
   * When `selector` is omitted, the locator searches the main frame and all
   * descendant frames.
   *
   * @see {@link CorePage.frameLocator} for the wrapped Playwright method.
   */
  readonly frameLocator: (selector?: Parameters<CorePage["frameLocator"]>[0]) => FrameLocatorShape;
  /**
   * Returns all frames attached to the page.
   *
   * @see {@link CorePage.frames} for the wrapped Playwright method.
   */
  readonly frames: Effect.Effect<ReadonlyArray<FrameShape>, PlaywrightError>;
  /**
   * Returns a locator that matches the given alt text.
   *
   * @see {@link CorePage.getByAltText} for the wrapped Playwright method.
   */
  readonly getByAltText: (
    text: Parameters<CorePage["getByAltText"]>[0],
    options?: Parameters<CorePage["getByAltText"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given label.
   *
   * @see {@link CorePage.getByLabel} for the wrapped Playwright method.
   */
  readonly getByLabel: (
    label: Parameters<CorePage["getByLabel"]>[0],
    options?: Parameters<CorePage["getByLabel"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given placeholder.
   *
   * @see {@link CorePage.getByPlaceholder} for the wrapped Playwright method.
   */
  readonly getByPlaceholder: (
    text: Parameters<CorePage["getByPlaceholder"]>[0],
    options?: Parameters<CorePage["getByPlaceholder"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator for the element with the given aria ref, such as `e2`.
   *
   * **Details**
   *
   * Refs are reported by {@link PageShape.ariaSnapshot} in `"ai"` mode and
   * resolve against the latest snapshot taken in the element's frame.
   *
   * @see {@link CorePage.getByRef} for the wrapped Playwright method.
   */
  readonly getByRef: (ref: string) => LocatorShape;
  /**
   * Returns a locator that matches the given role.
   *
   * @see {@link CorePage.getByRole} for the wrapped Playwright method.
   */
  readonly getByRole: (
    role: Parameters<CorePage["getByRole"]>[0],
    options?: Parameters<CorePage["getByRole"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given test id.
   *
   * @see {@link CorePage.getByTestId} for the wrapped Playwright method.
   */
  readonly getByTestId: (testId: Parameters<CorePage["getByTestId"]>[0]) => LocatorShape;
  /**
   * Returns a locator that matches the given text.
   *
   * @see {@link CorePage.getByText} for the wrapped Playwright method.
   */
  readonly getByText: (
    text: Parameters<CorePage["getByText"]>[0],
    options?: Parameters<CorePage["getByText"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given title.
   *
   * @see {@link CorePage.getByTitle} for the wrapped Playwright method.
   */
  readonly getByTitle: (
    text: Parameters<CorePage["getByTitle"]>[0],
    options?: Parameters<CorePage["getByTitle"]>[1]
  ) => LocatorShape;
  /**
   * Navigate to the previous page in history.
   *
   * @see {@link CorePage.goBack} for the wrapped Playwright method.
   */
  readonly goBack: (
    options?: Parameters<CorePage["goBack"]>[0]
  ) => Effect.Effect<O.Option<ResponseShape>, PlaywrightError>;
  /**
   * Navigate to the next page in history.
   *
   * @see {@link CorePage.goForward} for the wrapped Playwright method.
   */
  readonly goForward: (
    options?: Parameters<CorePage["goForward"]>[0]
  ) => Effect.Effect<O.Option<ResponseShape>, PlaywrightError>;
  /**
   * Navigates the page to the given URL and returns the main resource
   * response, or `None` when there is none, such as for `about:blank` or a
   * change of the URL hash.
   *
   * **Details**
   *
   * It succeeds whatever HTTP status the server answers with, including 404
   * and 500, so read the status from the response.
   *
   * **Example** (Reading the status of the page)
   *
   * ```ts
   * import { Page } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   *
   * const status = Effect.gen(function* () {
   *   const page = yield* Page
   *   const response = yield* page.goto("http://status.test/")
   *   return O.map(response, (response) => response.status())
   * })
   * ```
   *
   * @see {@link CorePage.goto} for the wrapped Playwright method.
   */
  readonly goto: (
    url: string,
    options?: Parameters<CorePage["goto"]>[1]
  ) => Effect.Effect<O.Option<ResponseShape>, PlaywrightError>;
  /**
   * Clears all highlights.
   *
   * @see {@link CorePage.hideHighlight} for the wrapped Playwright method.
   */
  readonly hideHighlight: Effect.Effect<void, PlaywrightError>;
  /**
   * Indicates that the page has been closed.
   *
   * @see {@link CorePage.isClosed} for the wrapped Playwright method.
   */
  readonly isClosed: () => boolean;
  /**
   * Access the keyboard.
   */
  readonly keyboard: KeyboardShape;
  /**
   * Access local storage for the page's current origin.
   *
   * @see {@link CorePage.localStorage} for the wrapped Playwright property.
   */
  readonly localStorage: WebStorageShape;
  /**
   * Returns a locator for the given selector.
   *
   * **Gotchas**
   *
   * This method causes a defect if `options.has` or `options.hasNot` are provided and belong to a different frame.
   *
   * @see {@link CorePage.locator} for the wrapped Playwright method.
   */
  readonly locator: (selector: string, options?: Parameters<CorePage["locator"]>[1]) => LocatorShape;
  /**
   * The page's main frame. Page is guaranteed to have a main frame which persists during navigations.
   *
   * @see {@link CorePage.mainFrame} for the wrapped Playwright method.
   */
  readonly mainFrame: () => FrameShape;
  /**
   * Access the mouse.
   */
  readonly mouse: MouseShape;
  /**
   * Returns the opener for popup pages and `None` for others, including
   * popups whose opener has been closed already.
   *
   * @see {@link CorePage.opener} for the wrapped Playwright method.
   */
  readonly opener: Effect.Effect<O.Option<PageShape>, PlaywrightError>;
  /**
   * Returns all errors that have been thrown in the page.
   *
   * @see {@link CorePage.pageErrors} for the wrapped Playwright method.
   */
  readonly pageErrors: (
    options?: Parameters<CorePage["pageErrors"]>[0]
  ) => Effect.Effect<ReadonlyArray<Error>, PlaywrightError>;
  /**
   * Pauses the script execution.
   *
   * @see {@link CorePage.pause} for the wrapped Playwright method.
   */
  readonly pause: Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the PDF buffer.
   *
   * **Details**
   *
   * `page.pdf()` generates a pdf of the page with `print` css media. To
   * generate a pdf with `screen` media, call {@link PageShape.emulateMedia}
   * first.
   *
   * @see {@link CorePage.pdf} for the wrapped Playwright method.
   */
  readonly pdf: (options?: Parameters<CorePage["pdf"]>[0]) => Effect.Effect<Buffer, PlaywrightError>;
  /**
   * Enters an interactive mode where hovering over elements highlights them and shows the corresponding locator.
   *
   * @see {@link CorePage.pickLocator} for the wrapped Playwright method.
   */
  readonly pickLocator: Effect.Effect<LocatorShape, PlaywrightError>;
  /**
   * Reloads the page and returns the main resource response, or `None` when
   * there is none, such as for `about:blank`.
   *
   * **Details**
   *
   * It succeeds whatever HTTP status the server answers with, including 404
   * and 500, so read the status from the response.
   *
   * @see {@link CorePage.reload} for the wrapped Playwright method.
   */
  readonly reload: (
    options?: Parameters<CorePage["reload"]>[0]
  ) => Effect.Effect<O.Option<ResponseShape>, PlaywrightError>;
  /**
   * Request the page to perform garbage collection. Note that there is no guarantee that all unreachable objects will
   * be collected.
   *
   * @see {@link CorePage.requestGC} for the wrapped Playwright method.
   */
  readonly requestGC: Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the most recent network requests from the page.
   *
   * @see {@link CorePage.requests} for the wrapped Playwright method.
   */
  readonly requests: Effect.Effect<ReadonlyArray<RequestShape>, PlaywrightError>;
  /**
   * Access the screencast.
   */
  readonly screencast: ScreencastShape;
  /**
   * Captures a screenshot of the page.
   *
   * @see {@link CorePage.screenshot} for the wrapped Playwright method.
   */
  readonly screenshot: (options?: Parameters<CorePage["screenshot"]>[0]) => Effect.Effect<Buffer, PlaywrightError>;
  /**
   * Access session storage for the page's current origin.
   *
   * @see {@link CorePage.sessionStorage} for the wrapped Playwright property.
   */
  readonly sessionStorage: WebStorageShape;
  /**
   * This method internally calls [document.write()](https://developer.mozilla.org/en-US/docs/Web/API/Document/write),
   * inheriting all its specific characteristics and behaviors.
   *
   * @see {@link CorePage.setContent} for the wrapped Playwright method.
   */
  readonly setContent: (
    html: string,
    options?: Parameters<CorePage["setContent"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * This setting will change the default maximum navigation time for
   * {@link PageShape.goBack}, {@link PageShape.goForward}, {@link PageShape.goto},
   * {@link PageShape.reload}, {@link PageShape.setContent} and
   * {@link PageShape.waitForURL}.
   *
   * @see {@link CorePage.setDefaultNavigationTimeout} for the wrapped Playwright method.
   */
  readonly setDefaultNavigationTimeout: (timeout: Parameters<CorePage["setDefaultNavigationTimeout"]>[0]) => void;
  /**
   * This setting will change the default maximum time for all the methods accepting `timeout` option.
   *
   * @see {@link CorePage.setDefaultTimeout} for the wrapped Playwright method.
   */
  readonly setDefaultTimeout: (timeout: Parameters<CorePage["setDefaultTimeout"]>[0]) => void;
  /**
   * The extra HTTP headers will be sent with every request the page initiates.
   *
   * @see {@link CorePage.setExtraHTTPHeaders} for the wrapped Playwright method.
   */
  readonly setExtraHTTPHeaders: (
    headers: Parameters<CorePage["setExtraHTTPHeaders"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sets the viewport size for the page.
   *
   * @see {@link CorePage.setViewportSize} for the wrapped Playwright method.
   */
  readonly setViewportSize: (
    viewportSize: Parameters<CorePage["setViewportSize"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the page title.
   *
   * @see {@link CorePage.title} for the wrapped Playwright method.
   */
  readonly title: Effect.Effect<string, PlaywrightError>;
  /**
   * Access the touchscreen.
   */
  readonly touchscreen: TouchscreenShape;
  /**
   * Returns the current URL of the page.
   *
   * @see {@link CorePage.url} for the wrapped Playwright method.
   */
  readonly url: () => string;
  /**
   * Runs an asynchronous operation against the underlying Playwright `Page`.
   *
   * **When to use**
   *
   * Use as an escape hatch only when {@link PageShape} does not expose the
   * native Playwright operation you need.
   *
   * **Gotchas**
   *
   * The callback must return a `Promise`. The native page has the same lifetime
   * as this wrapper; closing it also closes the wrapped page.
   *
   * **Example** (Reading the title through the native page)
   *
   * ```ts
   * import { Page } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const page = yield* Page
   *   return yield* page.use((nativePage) => nativePage.title())
   * })
   * ```
   *
   * @see {@link CorePage} for the wrapped Playwright page.
   */
  readonly use: <T>(f: (page: CorePage) => Promise<T>) => Effect.Effect<T, PlaywrightError>;
  /**
   * Returns the viewport size.
   *
   * @see {@link CorePage.viewportSize} for the wrapped Playwright method.
   */
  readonly viewportSize: () => O.Option<{ width: number; height: number }>;
  /**
   * Waits for the page to reach the given load state.
   *
   * **Gotchas**
   *
   * Most of the time, this method is not needed because Playwright auto-waits before every action.
   *
   * @see {@link CorePage.waitForLoadState} for the wrapped Playwright method.
   */
  readonly waitForLoadState: (
    state?: Parameters<CorePage["waitForLoadState"]>[0],
    options?: Parameters<CorePage["waitForLoadState"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Waits for the given timeout in milliseconds.
   *
   * @see {@link CorePage.waitForTimeout} for the wrapped Playwright method.
   */
  readonly waitForTimeout: (timeout: number) => Effect.Effect<void, PlaywrightError>;
  /**
   * Waits for the page to navigate to the given URL.
   *
   * @see {@link CorePage.waitForURL} for the wrapped Playwright method.
   */
  readonly waitForURL: (
    url: Parameters<CorePage["waitForURL"]>[0],
    options?: Parameters<CorePage["waitForURL"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Access the tools that the main frame registers through the experimental
   * WebMCP browser API.
   *
   * **Details**
   *
   * Shortcut for `page.mainFrame().webmcp`. Child frames expose their tools
   * through their own {@link FrameShape.webmcp}.
   *
   * @see {@link CorePage.webmcp} for the wrapped Playwright property.
   */
  readonly webmcp: WebMCPShape;
  /**
   * Returns all workers.
   *
   * @see {@link CorePage.workers} for the wrapped Playwright method.
   */
  readonly workers: () => ReadonlyArray<WorkerShape>;
}

/**
 * Service for the active {@link PageShape}.
 *
 * **Example** (Reading the title of the active page)
 *
 * ```ts
 * import { Page } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const title = Effect.gen(function* () {
 *   const page = yield* Page
 *   yield* page.setContent("<title>Hello</title>")
 *   return yield* page.title
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Page extends Context.Service<Page, PageShape>()($I`Page`) {}

/**
 * Creates a `Page` from a Playwright `Page` instance.
 *
 * **Example** (Wrap a native page)
 *
 * ```ts
 * import { makePage } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const readTitle = (page: Page) => makePage(page).title
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePage = (page: CorePage): PageShape => {
  const events = page as PageWithPatchedEvents;
  const use = useHelper(page);
  const optionalResponse = Effect.map(flow(O.fromNullishOr<CoreResponse | null>, O.map(makeResponse)));

  return Page.of({
    clock: makeClock(page.clock),
    localStorage: makeWebStorage(page.localStorage),
    keyboard: makeKeyboard(page.keyboard),
    mouse: makeMouse(page.mouse),
    touchscreen: makeTouchscreen(page.touchscreen),
    screencast: makeScreencast(page.screencast),
    sessionStorage: makeWebStorage(page.sessionStorage),
    webmcp: makeWebMCP(page.webmcp),
    goto: Effect.fn("Page.goto")((url, options) => use((p) => p.goto(url, options)), optionalResponse),
    setContent: Effect.fn("Page.setContent")((html, options) => use((p) => p.setContent(html, options))),
    waitForTimeout: Effect.fn("Page.waitForTimeout")((timeout) => use((p) => p.waitForTimeout(timeout))),
    setDefaultNavigationTimeout: (timeout) => page.setDefaultNavigationTimeout(timeout),
    setDefaultTimeout: (timeout) => page.setDefaultTimeout(timeout),
    setExtraHTTPHeaders: Effect.fn("Page.setExtraHTTPHeaders")((headers) => use((p) => p.setExtraHTTPHeaders(headers))),
    setViewportSize: Effect.fn("Page.setViewportSize")((viewportSize) => use((p) => p.setViewportSize(viewportSize))),
    viewportSize: () => O.fromNullishOr(page.viewportSize()),
    waitForURL: Effect.fn("Page.waitForURL")((url, options) => use((p) => p.waitForURL(url, options))),
    waitForLoadState: Effect.fn("Page.waitForLoadState")((state, options) =>
      use((p) => p.waitForLoadState(state, options))
    ),
    title: use((p) => p.title()),
    content: Effect.fn("Page.content")((options) => use((p) => p.content(options))),
    evaluate: Effect.fn("Page.evaluate")(function* <R, Arg = void>(
      pageFunction: PageFunction<Arg, R>,
      arg?: Arg,
      options?: Parameters<CorePage["evaluate"]>[2]
    ): Effect.fn.Return<R, PlaywrightError> {
      return yield* use((p) =>
        p.evaluate<R, Arg | undefined>(
          pageFunction as unknown as Parameters<typeof p.evaluate<R, Arg | undefined>>[0],
          arg,
          options
        )
      );
    }),
    addInitScript: Effect.fn("Page.addInitScript")(function* <Arg>(
      script: PageFunction<Arg, unknown> | { path?: string; content?: string },
      arg?: Arg,
      options?: Parameters<CorePage["addInitScript"]>[2]
    ): Effect.fn.Return<void, PlaywrightError> {
      yield* use((p) =>
        p.addInitScript<Arg>(script as unknown as Parameters<typeof p.addInitScript<Arg>>[0], arg, options)
      );
    }),
    addScriptTag: Effect.fn("Page.addScriptTag")((options) => use((p) => p.addScriptTag(options))),
    addStyleTag: Effect.fn("Page.addStyleTag")((options) => use((p) => p.addStyleTag(options))),
    exposeFunction: Effect.fn("Page.exposeFunction")(function* <A, E, R, Args extends unknown[]>(
      name: string,
      effectFn: (...args: Args) => Effect.Effect<A, E, R>
    ): Effect.fn.Return<void, PlaywrightError, R> {
      const context = yield* Effect.context<R>();
      const runPromise = Effect.runPromiseWith(context);
      yield* use((p) => p.exposeFunction(name, (...args: Args) => runPromise(effectFn(...args))));
    }),
    exposeEffect: Effect.fn("Page.exposeEffect")(function* <A, E, R>(
      name: string,
      effect: Effect.Effect<A, E, R>
    ): Effect.fn.Return<void, PlaywrightError, R> {
      const context = yield* Effect.context<R>();
      const runPromise = Effect.runPromiseWith(context);
      yield* use((p) => p.exposeFunction(name, () => runPromise(effect)));
    }),
    locator: (selector, options) => makeLocator(page.locator(selector, options)),
    frameLocator: (selector) => makeFrameLocator(page.frameLocator(selector)),
    getByRole: (role, options) => makeLocator(page.getByRole(role, options)),
    getByText: (text, options) => makeLocator(page.getByText(text, options)),
    getByLabel: (label, options) => makeLocator(page.getByLabel(label, options)),
    getByTestId: (testId) => makeLocator(page.getByTestId(testId)),
    getByRef: (ref) => makeLocator(page.getByRef(ref)),
    getByAltText: (text, options) => makeLocator(page.getByAltText(text, options)),
    getByPlaceholder: (text, options) => makeLocator(page.getByPlaceholder(text, options)),
    getByTitle: (text, options) => makeLocator(page.getByTitle(text, options)),
    url: () => page.url(),
    hideHighlight: use((p) => p.hideHighlight()),
    clearConsoleMessages: use((p) => p.clearConsoleMessages()),
    clearPageErrors: use((p) => p.clearPageErrors()),
    consoleMessages: Effect.fn("Page.consoleMessages")((options) => use((p) => p.consoleMessages(options))),
    pageErrors: Effect.fn("Page.pageErrors")((options) => use((p) => p.pageErrors(options))),
    requests: use((p) => p.requests()).pipe(Effect.map(A.map(makeRequest))),
    pickLocator: use((p) => p.pickLocator().then(makeLocator)),
    cancelPickLocator: use((p) => p.cancelPickLocator()),
    ariaSnapshot: Effect.fn("Page.ariaSnapshot")((options) => use((p) => p.ariaSnapshot(options))),
    ariaSnapshotJSON: Effect.fn("Page.ariaSnapshotJSON")((options) => use((p) => p.ariaSnapshotJSON(options))),
    context: () => makeBrowserContext(page.context()),
    opener: use((p) => p.opener()).pipe(Effect.map(flow(O.fromNullishOr, O.map(makePage)))),
    workers: () => A.map(page.workers(), makeWorker),
    frame: (frameSelector) => O.map(O.fromNullishOr(page.frame(frameSelector)), makeFrame),
    frames: use((p) => Promise.resolve(A.map(p.frames(), makeFrame))),
    mainFrame: () => makeFrame(page.mainFrame()),
    reload: Effect.fn("Page.reload")((options) => use((p) => p.reload(options)), optionalResponse),
    goBack: Effect.fn("Page.goBack")((options) => use((p) => p.goBack(options)), optionalResponse),
    goForward: Effect.fn("Page.goForward")((options) => use((p) => p.goForward(options)), optionalResponse),
    requestGC: use((p) => p.requestGC()),
    bringToFront: use((p) => p.bringToFront()),
    pause: use((p) => p.pause()),
    close: use((p) => p.close()),
    isClosed: () => page.isClosed(),
    screenshot: Effect.fn("Page.screenshot")((options) => use((p) => p.screenshot(options))),
    pdf: Effect.fn("Page.pdf")((options) => use((p) => p.pdf(options))),
    dragAndDrop: Effect.fn("Page.dragAndDrop")((source, target, options) =>
      use((p) => p.dragAndDrop(source, target, options))
    ),
    click: Effect.fn("Page.click")((selector, options) => use((p) => p.click(selector, options))),
    emulateMedia: Effect.fn("Page.emulateMedia")((options) => use((p) => p.emulateMedia(options))),
    eventStream: <K extends keyof CorePageEventMap>(event: K) =>
      Stream.callback<CorePageEventMap[K]>((queue) => {
        const emit = (value: CorePageEventMap[K]) => {
          Queue.offerUnsafe(queue, value);
        };
        const end = () => {
          Queue.endUnsafe(queue);
        };
        return Effect.acquireRelease(
          Effect.sync(() => {
            events.on(event, emit);
            events.once("close", end);
          }),
          () =>
            Effect.sync(() => {
              events.off(event, emit);
              events.off("close", end);
            })
        );
      }).pipe(Stream.map(eventMappings[event])),
    use,
  });
};

const eventMappings: {
  readonly [K in keyof CorePageEventMap]: (value: CorePageEventMap[K]) => PageEventMap[K];
} = {
  close: (page) => makePage(page),
  console: identity,
  crash: (page) => makePage(page),
  dialog: (dialog) => makeDialog(dialog),
  dialogclosed: (dialog) => makeDialog(dialog),
  domcontentloaded: (page) => makePage(page),
  download: (download) => makeDownload(download),
  filechooser: (fileChooser) => makeFileChooser(fileChooser),
  frameattached: (frame) => makeFrame(frame),
  framedetached: (frame) => makeFrame(frame),
  framenavigated: (frame) => makeFrame(frame),
  load: (page) => makePage(page),
  pageerror: identity,
  popup: (page) => makePage(page),
  request: (request) => makeRequest(request),
  requestfailed: (request) => makeRequest(request),
  requestfinished: (request) => makeRequest(request),
  response: (response) => makeResponse(response),
  websocket: identity,
  worker: (worker) => makeWorker(worker),
};
