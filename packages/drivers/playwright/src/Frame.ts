/**
 * Effect service wrapper for Playwright frames and frame operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { makeResponse } from "./Common.ts";
import { makeFrameLocator } from "./FrameLocator.ts";
import { useHelper } from "./internal/use.ts";
import { makeLocator } from "./Locator.ts";
import { makePage } from "./Page.ts";
import { makeWebMCP } from "./WebMCP.ts";
import type { Frame as CoreFrame, ElementHandle } from "playwright";
import type { ResponseShape } from "./Common.ts";
import type { FrameLocatorShape } from "./FrameLocator.ts";
import type { LocatorShape } from "./Locator.ts";
import type { PageShape } from "./Page.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";
import type { PageFunction } from "./PlaywrightTypes.ts";
import type { WebMCPShape } from "./WebMCP.ts";

const $I = $PlaywrightId.create("Frame");

/**
 * A frame of a page, either its main frame or an iframe, with navigation,
 * evaluation and locator operations.
 *
 * @category models
 * @since 0.0.0
 */
export interface FrameShape {
  /**
   * Returns an array of child frames.
   *
   * @see {@link CoreFrame.childFrames} for the wrapped Playwright method.
   */
  readonly childFrames: () => ReadonlyArray<FrameShape>;
  /**
   * Clicks an element matching the given selector.
   *
   * @deprecated Use {@link FrameShape.locator} to create a locator and then call `click` on it instead.
   * @see {@link CoreFrame.click} for the wrapped Playwright method.
   */
  readonly click: (
    selector: string,
    options?: Parameters<CoreFrame["click"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the full HTML contents of the frame, including the doctype.
   *
   * **Details**
   *
   * Pass `includeShadow: true` to serialize open shadow roots as declarative
   * shadow DOM.
   *
   * @see {@link CoreFrame.content} for the wrapped Playwright method.
   */
  readonly content: (options?: Parameters<CoreFrame["content"]>[0]) => Effect.Effect<string, PlaywrightError>;
  /**
   * Evaluates a function in the context of the frame.
   *
   * @see {@link CoreFrame.evaluate} for the wrapped Playwright method.
   */
  readonly evaluate: <R, Arg = void>(
    pageFunction: PageFunction<Arg, R>,
    arg?: Arg,
    options?: Parameters<CoreFrame["evaluate"]>[2]
  ) => Effect.Effect<R, PlaywrightError>;
  /**
   * Returns the owner iframe element for the frame.
   *
   * @see {@link CoreFrame.frameElement} for the wrapped Playwright method.
   */
  readonly frameElement: Effect.Effect<ElementHandle, PlaywrightError>;
  /**
   * Creates a frame locator that searches this frame's subtree.
   *
   * **Details**
   *
   * When `selector` is omitted, the locator searches this frame and all
   * descendant frames.
   *
   * @see {@link CoreFrame.frameLocator} for the wrapped Playwright method.
   */
  readonly frameLocator: (selector?: Parameters<CoreFrame["frameLocator"]>[0]) => FrameLocatorShape;
  /**
   * Returns a locator that matches the given alt text.
   *
   * @see {@link CoreFrame.getByAltText} for the wrapped Playwright method.
   */
  readonly getByAltText: (
    text: Parameters<CoreFrame["getByAltText"]>[0],
    options?: Parameters<CoreFrame["getByAltText"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given label.
   *
   * @see {@link CoreFrame.getByLabel} for the wrapped Playwright method.
   */
  readonly getByLabel: (
    label: Parameters<CoreFrame["getByLabel"]>[0],
    options?: Parameters<CoreFrame["getByLabel"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given placeholder.
   *
   * @see {@link CoreFrame.getByPlaceholder} for the wrapped Playwright method.
   */
  readonly getByPlaceholder: (
    text: Parameters<CoreFrame["getByPlaceholder"]>[0],
    options?: Parameters<CoreFrame["getByPlaceholder"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given role.
   *
   * @see {@link CoreFrame.getByRole} for the wrapped Playwright method.
   */
  readonly getByRole: (
    role: Parameters<CoreFrame["getByRole"]>[0],
    options?: Parameters<CoreFrame["getByRole"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given test id.
   *
   * @see {@link CoreFrame.getByTestId} for the wrapped Playwright method.
   */
  readonly getByTestId: (testId: Parameters<CoreFrame["getByTestId"]>[0]) => LocatorShape;
  /**
   * Returns a locator that matches the given text.
   *
   * @see {@link CoreFrame.getByText} for the wrapped Playwright method.
   */
  readonly getByText: (
    text: Parameters<CoreFrame["getByText"]>[0],
    options?: Parameters<CoreFrame["getByText"]>[1]
  ) => LocatorShape;
  /**
   * Returns a locator that matches the given title.
   *
   * @see {@link CoreFrame.getByTitle} for the wrapped Playwright method.
   */
  readonly getByTitle: (
    text: Parameters<CoreFrame["getByTitle"]>[0],
    options?: Parameters<CoreFrame["getByTitle"]>[1]
  ) => LocatorShape;
  /**
   * Navigates the frame to the given URL and returns the main resource
   * response, or `None` when there is none, such as for `about:blank` or a
   * change of the URL hash.
   *
   * **Details**
   *
   * It succeeds whatever HTTP status the server answers with, including 404
   * and 500, so read the status from the response.
   *
   * @see {@link CoreFrame.goto} for the wrapped Playwright method.
   */
  readonly goto: (
    url: string,
    options?: Parameters<CoreFrame["goto"]>[1]
  ) => Effect.Effect<O.Option<ResponseShape>, PlaywrightError>;
  /**
   * Returns whether the frame is detached.
   *
   * @see {@link CoreFrame.isDetached} for the wrapped Playwright method.
   */
  readonly isDetached: () => boolean;
  /**
   * Returns a locator for the given selector.
   *
   * **Gotchas**
   *
   * This method causes a defect if `options.has` or `options.hasNot` are
   * provided and belong to a different frame.
   *
   * @see {@link CoreFrame.locator} for the wrapped Playwright method.
   */
  readonly locator: (selector: string, options?: Parameters<CoreFrame["locator"]>[1]) => LocatorShape;
  /**
   * Returns the frame name.
   *
   * @see {@link CoreFrame.name} for the wrapped Playwright method.
   */
  readonly name: () => string;
  /**
   * Returns the page that the frame belongs to.
   *
   * @see {@link CoreFrame.page} for the wrapped Playwright method.
   */
  readonly page: () => PageShape;
  /**
   * Returns the parent frame, if any.
   *
   * @see {@link CoreFrame.parentFrame} for the wrapped Playwright method.
   */
  readonly parentFrame: () => O.Option<FrameShape>;
  /**
   * Sets the HTML content of the frame.
   *
   * @see {@link CoreFrame.setContent} for the wrapped Playwright method.
   */
  readonly setContent: (
    html: string,
    options?: Parameters<CoreFrame["setContent"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the frame title.
   *
   * @see {@link CoreFrame.title} for the wrapped Playwright method.
   */
  readonly title: Effect.Effect<string, PlaywrightError>;
  /**
   * Returns the current URL of the frame.
   *
   * @see {@link CoreFrame.url} for the wrapped Playwright method.
   */
  readonly url: () => string;
  /**
   * Runs any promise-based method on the underlying Playwright `Frame`.
   *
   * **When to use**
   *
   * Use when {@link FrameShape} does not expose the Frame functionality you need.
   *
   * @see {@link CoreFrame} for the wrapped Playwright frame.
   */
  readonly use: <T>(f: (frame: CoreFrame) => Promise<T>) => Effect.Effect<T, PlaywrightError>;
  /**
   * Waits for the frame to reach the given load state.
   *
   * @see {@link CoreFrame.waitForLoadState} for the wrapped Playwright method.
   */
  readonly waitForLoadState: (
    state?: Parameters<CoreFrame["waitForLoadState"]>[0],
    options?: Parameters<CoreFrame["waitForLoadState"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Waits for the given timeout in milliseconds.
   *
   * @see {@link CoreFrame.waitForTimeout} for the wrapped Playwright method.
   */
  readonly waitForTimeout: (timeout: number) => Effect.Effect<void, PlaywrightError>;
  /**
   * Waits for the frame to navigate to the given URL.
   *
   * @see {@link CoreFrame.waitForURL} for the wrapped Playwright method.
   */
  readonly waitForURL: (
    url: Parameters<CoreFrame["waitForURL"]>[0],
    options?: Parameters<CoreFrame["waitForURL"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Access the tools that the frame registers through the experimental
   * WebMCP browser API.
   *
   * @see {@link CoreFrame.webmcp} for the wrapped Playwright property.
   */
  readonly webmcp: WebMCPShape;
}

/**
 * Service for a {@link FrameShape}.
 *
 * **Example** (Read a frame's title)
 *
 * ```ts
 * import { Frame } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const title = Effect.gen(function* () {
 *   const frame = yield* Frame
 *   return yield* frame.title
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Frame extends Context.Service<Frame, FrameShape>()($I`Frame`) {}

/**
 * Creates a {@link FrameShape} from a Playwright `Frame` instance.
 *
 * **Example** (Wrap a page's main frame)
 *
 * ```ts
 * import { makeFrame } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const mainFrameTitle = (page: Page) => makeFrame(page.mainFrame()).title
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFrame = (frame: CoreFrame): FrameShape => {
  const use = useHelper(frame);

  return Frame.of({
    goto: Effect.fn("Frame.goto")((url, options) =>
      use((f) => f.goto(url, options)).pipe(Effect.map(O.fromNullishOr), Effect.map(O.map(makeResponse)))
    ),
    waitForURL: Effect.fn("Frame.waitForURL")((url, options) => use((f) => f.waitForURL(url, options))),
    waitForLoadState: Effect.fn("Frame.waitForLoadState")((state, options) =>
      use((f) => f.waitForLoadState(state, options))
    ),
    evaluate: Effect.fn("Frame.evaluate")(
      <R, Arg = void>(
        pageFunction: PageFunction<Arg, R>,
        arg?: Arg,
        options?: Parameters<CoreFrame["evaluate"]>[2]
      ): Effect.Effect<R, PlaywrightError> =>
        use((f) =>
          f.evaluate<R, Arg | undefined>(
            pageFunction as unknown as Parameters<typeof f.evaluate<R, Arg | undefined>>[0],
            arg,
            options
          )
        )
    ),
    title: use((f) => f.title()),
    use,
    locator: (selector, options) => makeLocator(frame.locator(selector, options)),
    frameLocator: (selector) => makeFrameLocator(frame.frameLocator(selector)),
    getByRole: (role, options) => makeLocator(frame.getByRole(role, options)),
    getByText: (text, options) => makeLocator(frame.getByText(text, options)),
    getByLabel: (label, options) => makeLocator(frame.getByLabel(label, options)),
    getByTestId: (testId) => makeLocator(frame.getByTestId(testId)),
    getByPlaceholder: (text, options) => makeLocator(frame.getByPlaceholder(text, options)),
    getByAltText: (text, options) => makeLocator(frame.getByAltText(text, options)),
    getByTitle: (text, options) => makeLocator(frame.getByTitle(text, options)),
    page: () => makePage(frame.page()),
    parentFrame: () => O.fromNullishOr(frame.parentFrame()).pipe(O.map(makeFrame)),
    childFrames: () => A.map(frame.childFrames(), makeFrame),
    isDetached: () => frame.isDetached(),
    waitForTimeout: Effect.fn("Frame.waitForTimeout")((timeout) => use((f) => f.waitForTimeout(timeout))),
    setContent: Effect.fn("Frame.setContent")((html, options) => use((f) => f.setContent(html, options))),
    url: () => frame.url(),
    content: Effect.fn("Frame.content")((options) => use((f) => f.content(options))),
    webmcp: makeWebMCP(frame.webmcp),
    frameElement: use((f) => f.frameElement()),
    name: () => frame.name(),
    click: Effect.fn("Frame.click")((selector, options) => use((f) => f.click(selector, options))),
  });
};
