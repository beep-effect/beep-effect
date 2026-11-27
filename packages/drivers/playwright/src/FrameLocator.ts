/**
 * Effect service wrapper for Playwright frame locators.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import { makeLocator } from "./Locator.ts";
import type { FrameLocator as CoreFrameLocator, Locator as CoreLocator } from "playwright";
import type { LocatorShape } from "./Locator.ts";

const $I = $PlaywrightId.create("FrameLocator");

/**
 * Locator for an iframe that produces locators scoped to the iframe's content.
 *
 * @category models
 * @since 0.0.0
 */
export interface FrameLocatorShape {
  /**
   * The underlying Playwright FrameLocator instance.
   *
   * @internal
   */
  readonly _raw: CoreFrameLocator;
  /**
   * Returns locator to the first matching frame.
   *
   * @see {@link CoreFrameLocator.first} for the wrapped Playwright method.
   */
  readonly first: () => FrameLocatorShape;
  /**
   * When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements
   * in that iframe.
   *
   * @see {@link CoreFrameLocator.frameLocator} for the wrapped Playwright method.
   */
  readonly frameLocator: (selector: string) => FrameLocatorShape;
  /**
   * Allows locating elements by their alt text.
   *
   * @see {@link CoreFrameLocator.getByAltText} for the wrapped Playwright method.
   */
  readonly getByAltText: (
    text: Parameters<CoreFrameLocator["getByAltText"]>[0],
    options?: Parameters<CoreFrameLocator["getByAltText"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their label text.
   *
   * @see {@link CoreFrameLocator.getByLabel} for the wrapped Playwright method.
   */
  readonly getByLabel: (
    text: Parameters<CoreFrameLocator["getByLabel"]>[0],
    options?: Parameters<CoreFrameLocator["getByLabel"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their placeholder text.
   *
   * @see {@link CoreFrameLocator.getByPlaceholder} for the wrapped Playwright method.
   */
  readonly getByPlaceholder: (
    text: Parameters<CoreFrameLocator["getByPlaceholder"]>[0],
    options?: Parameters<CoreFrameLocator["getByPlaceholder"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their ARIA role.
   *
   * @see {@link CoreFrameLocator.getByRole} for the wrapped Playwright method.
   */
  readonly getByRole: (
    role: Parameters<CoreFrameLocator["getByRole"]>[0],
    options?: Parameters<CoreFrameLocator["getByRole"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their test id.
   *
   * @see {@link CoreFrameLocator.getByTestId} for the wrapped Playwright method.
   */
  readonly getByTestId: (testId: Parameters<CoreFrameLocator["getByTestId"]>[0]) => LocatorShape;
  /**
   * Allows locating elements that contain given text.
   *
   * @see {@link CoreFrameLocator.getByText} for the wrapped Playwright method.
   */
  readonly getByText: (
    text: Parameters<CoreFrameLocator["getByText"]>[0],
    options?: Parameters<CoreFrameLocator["getByText"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their title attribute.
   *
   * @see {@link CoreFrameLocator.getByTitle} for the wrapped Playwright method.
   */
  readonly getByTitle: (
    text: Parameters<CoreFrameLocator["getByTitle"]>[0],
    options?: Parameters<CoreFrameLocator["getByTitle"]>[1]
  ) => LocatorShape;
  /**
   * Returns locator to the last matching frame.
   *
   * @see {@link CoreFrameLocator.last} for the wrapped Playwright method.
   */
  readonly last: () => FrameLocatorShape;
  /**
   * Finds an element matching the specified selector in the locator's subtree.
   *
   * @see {@link CoreFrameLocator.locator} for the wrapped Playwright method.
   */
  readonly locator: (
    selectorOrLocator: string | CoreLocator | LocatorShape,
    options?: Parameters<CoreFrameLocator["locator"]>[1]
  ) => LocatorShape;
  /**
   * Returns locator to the n-th matching frame.
   *
   * @see {@link CoreFrameLocator.nth} for the wrapped Playwright method.
   */
  readonly nth: (index: number) => FrameLocatorShape;
  /**
   * Returns a `Locator` object pointing to the same `iframe` as this frame locator.
   *
   * @see {@link CoreFrameLocator.owner} for the wrapped Playwright method.
   */
  readonly owner: () => LocatorShape;
}

/**
 * Service for a {@link FrameLocatorShape}.
 *
 * **Example** (Read text inside an iframe)
 *
 * ```ts
 * import { FrameLocator } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const heading = Effect.gen(function* () {
 *   const frameLocator = yield* FrameLocator
 *   return yield* frameLocator.getByRole("heading").textContent()
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FrameLocator extends Context.Service<FrameLocator, FrameLocatorShape>()($I`FrameLocator`) {}

/**
 * Creates a {@link FrameLocatorShape} from a Playwright `FrameLocator` instance.
 *
 * **Example** (Wrap a native frame locator)
 *
 * ```ts
 * import { makeFrameLocator } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const frameText = (page: Page) => makeFrameLocator(page.frameLocator("#embed")).locator("p").textContent()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFrameLocator = (frameLocator: CoreFrameLocator): FrameLocatorShape => {
  const unwrap = Match.type<string | CoreLocator | LocatorShape>().pipe(
    Match.when(P.hasProperty("_raw"), (wrapped) => wrapped._raw),
    Match.orElse((native) => native)
  );

  return FrameLocator.of({
    _raw: frameLocator,
    first: () => makeFrameLocator(frameLocator.first()),
    frameLocator: (selector) => makeFrameLocator(frameLocator.frameLocator(selector)),
    last: () => makeFrameLocator(frameLocator.last()),
    nth: (index) => makeFrameLocator(frameLocator.nth(index)),
    owner: () => makeLocator(frameLocator.owner()),
    locator: (selectorOrLocator, options) => makeLocator(frameLocator.locator(unwrap(selectorOrLocator), options)),
    getByRole: (role, options) => makeLocator(frameLocator.getByRole(role, options)),
    getByText: (text, options) => makeLocator(frameLocator.getByText(text, options)),
    getByLabel: (text, options) => makeLocator(frameLocator.getByLabel(text, options)),
    getByPlaceholder: (text, options) => makeLocator(frameLocator.getByPlaceholder(text, options)),
    getByAltText: (text, options) => makeLocator(frameLocator.getByAltText(text, options)),
    getByTitle: (text, options) => makeLocator(frameLocator.getByTitle(text, options)),
    getByTestId: (testId) => makeLocator(frameLocator.getByTestId(testId)),
  });
};
