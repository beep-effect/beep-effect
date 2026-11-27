/**
 * Effect service wrapper for Playwright locators and element operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { makeFrameLocator } from "./FrameLocator.ts";
import { useHelper } from "./internal/use.ts";
import { makePage } from "./Page.ts";
import type { Locator as CoreLocator, ElementHandle, JSHandle } from "playwright";
import type { FrameLocatorShape } from "./FrameLocator.ts";
import type { PageShape } from "./Page.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";
import type { AriaSnapshotJSON, Unboxed } from "./PlaywrightTypes.ts";

const $I = $PlaywrightId.create("Locator");

/**
 * Effect-friendly operations for a Playwright locator.
 *
 * **When to use**
 *
 * Use locators for resilient element selection, interaction, assertions, and
 * browser-side evaluation. Locator-producing operations are synchronous;
 * operations that query or interact with the page return `Effect`.
 *
 * @category models
 * @since 0.0.0
 */
export interface LocatorShape {
  /**
   * The underlying Playwright Locator instance.
   *
   * @internal
   */
  readonly _raw: CoreLocator;
  /**
   * Returns an array of locators pointing to the matched elements.
   *
   * @see {@link CoreLocator.all} for the wrapped Playwright method.
   */
  readonly all: Effect.Effect<ReadonlyArray<LocatorShape>, PlaywrightError>;
  /**
   * Gets all inner texts.
   *
   * @see {@link CoreLocator.allInnerTexts} for the wrapped Playwright method.
   */
  readonly allInnerTexts: Effect.Effect<ReadonlyArray<string>, PlaywrightError>;
  /**
   * Gets all text contents.
   *
   * @see {@link CoreLocator.allTextContents} for the wrapped Playwright method.
   */
  readonly allTextContents: Effect.Effect<ReadonlyArray<string>, PlaywrightError>;
  /**
   * Creates a locator that matches both this locator and the argument locator.
   *
   * @see {@link CoreLocator.and} for the wrapped Playwright method.
   */
  readonly and: (locator: LocatorShape | CoreLocator) => LocatorShape;
  /**
   * Returns the accessibility tree snapshot.
   *
   * @see {@link CoreLocator.ariaSnapshot} for the wrapped Playwright method.
   */
  readonly ariaSnapshot: (
    options?: Parameters<CoreLocator["ariaSnapshot"]>[0]
  ) => Effect.Effect<string, PlaywrightError>;
  /**
   * Captures the matched element's accessibility tree as a JSON value.
   *
   * @see {@link CoreLocator.ariaSnapshotJSON} for the wrapped Playwright method.
   */
  readonly ariaSnapshotJSON: (
    options?: Parameters<CoreLocator["ariaSnapshotJSON"]>[0]
  ) => Effect.Effect<AriaSnapshotJSON, PlaywrightError>;
  /**
   * Removes keyboard focus from the current element.
   *
   * @see {@link CoreLocator.blur} for the wrapped Playwright method.
   */
  readonly blur: (options?: Parameters<CoreLocator["blur"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the bounding box of the element.
   *
   * @see {@link CoreLocator.boundingBox} for the wrapped Playwright method.
   */
  readonly boundingBox: (
    options?: Parameters<CoreLocator["boundingBox"]>[0]
  ) => Effect.Effect<O.Option<{ x: number; y: number; width: number; height: number }>, PlaywrightError>;
  /**
   * Checks the element.
   *
   * @see {@link CoreLocator.check} for the wrapped Playwright method.
   */
  readonly check: (options?: Parameters<CoreLocator["check"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Clear the input field.
   *
   * @see {@link CoreLocator.clear} for the wrapped Playwright method.
   */
  readonly clear: (options?: Parameters<CoreLocator["clear"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Clicks the element.
   *
   * @see {@link CoreLocator.click} for the wrapped Playwright method.
   */
  readonly click: (options?: Parameters<CoreLocator["click"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns a FrameLocator object pointing to the same iframe as this locator.
   *
   * @see {@link CoreLocator.contentFrame} for the wrapped Playwright method.
   */
  readonly contentFrame: () => FrameLocatorShape;
  /**
   * Counts the number of matched elements.
   *
   * @see {@link CoreLocator.count} for the wrapped Playwright method.
   */
  readonly count: Effect.Effect<number, PlaywrightError>;
  /**
   * Double-clicks the element.
   *
   * @see {@link CoreLocator.dblclick} for the wrapped Playwright method.
   */
  readonly dblclick: (options?: Parameters<CoreLocator["dblclick"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Describes the locator.
   *
   * @see {@link CoreLocator.describe} for the wrapped Playwright method.
   */
  readonly describe: (description: string) => LocatorShape;
  /**
   * Returns the description of the locator.
   *
   * @see {@link CoreLocator.description} for the wrapped Playwright method.
   */
  readonly description: () => O.Option<string>;
  /**
   * Dispatches an event.
   *
   * @see {@link CoreLocator.dispatchEvent} for the wrapped Playwright method.
   */
  readonly dispatchEvent: (
    type: Parameters<CoreLocator["dispatchEvent"]>[0],
    eventInit?: Parameters<CoreLocator["dispatchEvent"]>[1],
    options?: Parameters<CoreLocator["dispatchEvent"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Drags the locator to another target locator.
   *
   * @see {@link CoreLocator.dragTo} for the wrapped Playwright method.
   */
  readonly dragTo: (
    target: LocatorShape | CoreLocator,
    options?: Parameters<CoreLocator["dragTo"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Drops the locator.
   *
   * @see {@link CoreLocator.drop} for the wrapped Playwright method.
   */
  readonly drop: (
    data: Parameters<CoreLocator["drop"]>[0],
    options?: Parameters<CoreLocator["drop"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Resolves given locator to the first matching DOM element.
   *
   * @see {@link CoreLocator.elementHandle} for the wrapped Playwright method.
   */
  readonly elementHandle: (
    options?: Parameters<CoreLocator["elementHandle"]>[0]
  ) => Effect.Effect<O.Option<ElementHandle<SVGElement | HTMLElement>>, PlaywrightError>;
  /**
   * Resolves given locator to all matching DOM elements.
   *
   * @see {@link CoreLocator.elementHandles} for the wrapped Playwright method.
   */
  readonly elementHandles: Effect.Effect<ReadonlyArray<ElementHandle>, PlaywrightError>;
  /**
   * Evaluates a function on the matched element.
   *
   * **Example** (Evaluate the matched element)
   *
   * ```ts
   * import { Page } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const buttonContent = Effect.gen(function* () {
   *   const page = yield* Page
   *   const locator = page.locator("button")
   *   return yield* locator.evaluate((button) => button.textContent)
   * })
   * ```
   *
   * @see {@link CoreLocator.evaluate} for the wrapped Playwright method.
   */
  readonly evaluate: <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
    pageFunction: (element: E, arg: Unboxed<Arg>) => R | Promise<R>,
    arg?: Arg,
    options?: Parameters<CoreLocator["evaluate"]>[2]
  ) => Effect.Effect<R, PlaywrightError>;
  /**
   * Evaluates a function on all matched elements.
   *
   * @see {@link CoreLocator.evaluateAll} for the wrapped Playwright method.
   */
  readonly evaluateAll: <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
    pageFunction: (elements: E[], arg: Unboxed<Arg>) => R | Promise<R>,
    arg?: Arg
  ) => Effect.Effect<R, PlaywrightError>;
  /**
   * Evaluates a function on the matched element and returns the result as a handle.
   *
   * @see {@link CoreLocator.evaluateHandle} for the wrapped Playwright method.
   */
  readonly evaluateHandle: <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
    pageFunction: (element: E, arg: Unboxed<Arg>) => R | Promise<R>,
    arg?: Arg,
    options?: Parameters<CoreLocator["evaluateHandle"]>[2]
  ) => Effect.Effect<JSHandle<R>, PlaywrightError>;
  /**
   * Fills the input field.
   *
   * @see {@link CoreLocator.fill} for the wrapped Playwright method.
   */
  readonly fill: (value: string, options?: Parameters<CoreLocator["fill"]>[1]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Narrows existing locator according to the options.
   *
   * @see {@link CoreLocator.filter} for the wrapped Playwright method.
   */
  readonly filter: (options?: Parameters<CoreLocator["filter"]>[0]) => LocatorShape;
  /**
   * Returns a locator that points to the first matched element.
   *
   * @see {@link CoreLocator.first} for the wrapped Playwright method.
   */
  readonly first: () => LocatorShape;
  /**
   * Focuses the element.
   *
   * @see {@link CoreLocator.focus} for the wrapped Playwright method.
   */
  readonly focus: (options?: Parameters<CoreLocator["focus"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Creates a frame locator that will enter the iframe and allow selecting elements in that iframe.
   *
   * @see {@link CoreLocator.frameLocator} for the wrapped Playwright method.
   */
  readonly frameLocator: (selector: string) => FrameLocatorShape;
  /**
   * Gets an attribute value.
   *
   * @see {@link CoreLocator.getAttribute} for the wrapped Playwright method.
   */
  readonly getAttribute: (
    name: string,
    options?: Parameters<CoreLocator["getAttribute"]>[1]
  ) => Effect.Effect<string | null, PlaywrightError>;
  /**
   * Allows locating elements by their alt text.
   *
   * @see {@link CoreLocator.getByAltText} for the wrapped Playwright method.
   */
  readonly getByAltText: (
    text: Parameters<CoreLocator["getByAltText"]>[0],
    options?: Parameters<CoreLocator["getByAltText"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their label text.
   *
   * @see {@link CoreLocator.getByLabel} for the wrapped Playwright method.
   */
  readonly getByLabel: (
    text: Parameters<CoreLocator["getByLabel"]>[0],
    options?: Parameters<CoreLocator["getByLabel"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their placeholder text.
   *
   * @see {@link CoreLocator.getByPlaceholder} for the wrapped Playwright method.
   */
  readonly getByPlaceholder: (
    text: Parameters<CoreLocator["getByPlaceholder"]>[0],
    options?: Parameters<CoreLocator["getByPlaceholder"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their ARIA role, ARIA attributes and accessible name.
   *
   * @see {@link CoreLocator.getByRole} for the wrapped Playwright method.
   */
  readonly getByRole: (
    role: Parameters<CoreLocator["getByRole"]>[0],
    options?: Parameters<CoreLocator["getByRole"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their test id.
   *
   * @see {@link CoreLocator.getByTestId} for the wrapped Playwright method.
   */
  readonly getByTestId: (testId: Parameters<CoreLocator["getByTestId"]>[0]) => LocatorShape;
  /**
   * Allows locating elements that contain given text.
   *
   * @see {@link CoreLocator.getByText} for the wrapped Playwright method.
   */
  readonly getByText: (
    text: Parameters<CoreLocator["getByText"]>[0],
    options?: Parameters<CoreLocator["getByText"]>[1]
  ) => LocatorShape;
  /**
   * Allows locating elements by their title attribute.
   *
   * @see {@link CoreLocator.getByTitle} for the wrapped Playwright method.
   */
  readonly getByTitle: (
    text: Parameters<CoreLocator["getByTitle"]>[0],
    options?: Parameters<CoreLocator["getByTitle"]>[1]
  ) => LocatorShape;
  /**
   * Hides the element highlight previously added by highlight.
   *
   * @see {@link CoreLocator.hideHighlight} for the wrapped Playwright method.
   */
  readonly hideHighlight: Effect.Effect<void, PlaywrightError>;
  /**
   * Highlights the corresponding element(s) on the screen.
   *
   * @see {@link CoreLocator.highlight} for the wrapped Playwright method.
   */
  readonly highlight: (options?: Parameters<CoreLocator["highlight"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Hovers over the element.
   *
   * @see {@link CoreLocator.hover} for the wrapped Playwright method.
   */
  readonly hover: (options?: Parameters<CoreLocator["hover"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Gets the inner HTML.
   *
   * @see {@link CoreLocator.innerHTML} for the wrapped Playwright method.
   */
  readonly innerHTML: (options?: Parameters<CoreLocator["innerHTML"]>[0]) => Effect.Effect<string, PlaywrightError>;
  /**
   * Gets the inner text.
   *
   * @see {@link CoreLocator.innerText} for the wrapped Playwright method.
   */
  readonly innerText: (options?: Parameters<CoreLocator["innerText"]>[0]) => Effect.Effect<string, PlaywrightError>;
  /**
   * Gets the input value.
   *
   * @see {@link CoreLocator.inputValue} for the wrapped Playwright method.
   */
  readonly inputValue: (options?: Parameters<CoreLocator["inputValue"]>[0]) => Effect.Effect<string, PlaywrightError>;
  /**
   * Returns whether the element is checked.
   *
   * @see {@link CoreLocator.isChecked} for the wrapped Playwright method.
   */
  readonly isChecked: (options?: Parameters<CoreLocator["isChecked"]>[0]) => Effect.Effect<boolean, PlaywrightError>;
  /**
   * Returns whether the element is disabled.
   *
   * @see {@link CoreLocator.isDisabled} for the wrapped Playwright method.
   */
  readonly isDisabled: (options?: Parameters<CoreLocator["isDisabled"]>[0]) => Effect.Effect<boolean, PlaywrightError>;
  /**
   * Returns whether the element is editable.
   *
   * @see {@link CoreLocator.isEditable} for the wrapped Playwright method.
   */
  readonly isEditable: (options?: Parameters<CoreLocator["isEditable"]>[0]) => Effect.Effect<boolean, PlaywrightError>;
  /**
   * Returns whether the element is enabled.
   *
   * @see {@link CoreLocator.isEnabled} for the wrapped Playwright method.
   */
  readonly isEnabled: (options?: Parameters<CoreLocator["isEnabled"]>[0]) => Effect.Effect<boolean, PlaywrightError>;
  /**
   * Returns whether the element is hidden.
   *
   * @see {@link CoreLocator.isHidden} for the wrapped Playwright method.
   */
  readonly isHidden: (options?: Parameters<CoreLocator["isHidden"]>[0]) => Effect.Effect<boolean, PlaywrightError>;
  /**
   * Returns whether the element is visible.
   *
   * @see {@link CoreLocator.isVisible} for the wrapped Playwright method.
   */
  readonly isVisible: (options?: Parameters<CoreLocator["isVisible"]>[0]) => Effect.Effect<boolean, PlaywrightError>;
  /**
   * Returns a locator that points to the last matched element.
   *
   * @see {@link CoreLocator.last} for the wrapped Playwright method.
   */
  readonly last: () => LocatorShape;
  /**
   * Returns a locator that points to a matched element.
   *
   * @see {@link CoreLocator.locator} for the wrapped Playwright method.
   */
  readonly locator: (
    selectorOrLocator: string | CoreLocator | LocatorShape,
    options?: Parameters<CoreLocator["locator"]>[1]
  ) => LocatorShape;
  /**
   * Normalizes the locator.
   *
   * @see {@link CoreLocator.normalize} for the wrapped Playwright method.
   */
  readonly normalize: Effect.Effect<LocatorShape, PlaywrightError>;
  /**
   * Returns a locator that points to the nth matched element.
   *
   * @see {@link CoreLocator.nth} for the wrapped Playwright method.
   */
  readonly nth: (index: number) => LocatorShape;
  /**
   * Creates a locator that matches either this locator or the argument locator.
   *
   * @see {@link CoreLocator.or} for the wrapped Playwright method.
   */
  readonly or: (locator: LocatorShape | CoreLocator) => LocatorShape;
  /**
   * A page this locator belongs to.
   *
   * @see {@link CoreLocator.page} for the wrapped Playwright method.
   */
  readonly page: () => PageShape;
  /**
   * Focuses the element, and then uses `keyboard.down` and `keyboard.up`.
   *
   * @see {@link CoreLocator.press} for the wrapped Playwright method.
   */
  readonly press: (
    key: Parameters<CoreLocator["press"]>[0],
    options?: Parameters<CoreLocator["press"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.
   *
   * @see {@link CoreLocator.pressSequentially} for the wrapped Playwright method.
   */
  readonly pressSequentially: (
    text: Parameters<CoreLocator["pressSequentially"]>[0],
    options?: Parameters<CoreLocator["pressSequentially"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Captures a screenshot of the element.
   *
   * @see {@link CoreLocator.screenshot} for the wrapped Playwright method.
   */
  readonly screenshot: (options?: Parameters<CoreLocator["screenshot"]>[0]) => Effect.Effect<Buffer, PlaywrightError>;
  /**
   * Scrolls the element into view if needed.
   *
   * @see {@link CoreLocator.scrollIntoViewIfNeeded} for the wrapped Playwright method.
   */
  readonly scrollIntoViewIfNeeded: (
    options?: Parameters<CoreLocator["scrollIntoViewIfNeeded"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Selects an option in a `<select>` element.
   *
   * @see {@link CoreLocator.selectOption} for the wrapped Playwright method.
   */
  readonly selectOption: (
    values: Parameters<CoreLocator["selectOption"]>[0],
    options?: Parameters<CoreLocator["selectOption"]>[1]
  ) => Effect.Effect<ReadonlyArray<string>, PlaywrightError>;
  /**
   * Selects text.
   *
   * @see {@link CoreLocator.selectText} for the wrapped Playwright method.
   */
  readonly selectText: (options?: Parameters<CoreLocator["selectText"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Checks the element if not already checked.
   *
   * @see {@link CoreLocator.setChecked} for the wrapped Playwright method.
   */
  readonly setChecked: (
    checked: Parameters<CoreLocator["setChecked"]>[0],
    options?: Parameters<CoreLocator["setChecked"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sets the value of the file input.
   *
   * @see {@link CoreLocator.setInputFiles} for the wrapped Playwright method.
   */
  readonly setInputFiles: (
    files: Parameters<CoreLocator["setInputFiles"]>[0],
    options?: Parameters<CoreLocator["setInputFiles"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Taps the element.
   *
   * @see {@link CoreLocator.tap} for the wrapped Playwright method.
   */
  readonly tap: (options?: Parameters<CoreLocator["tap"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Gets the text content.
   *
   * @see {@link CoreLocator.textContent} for the wrapped Playwright method.
   */
  readonly textContent: (
    options?: Parameters<CoreLocator["textContent"]>[0]
  ) => Effect.Effect<string | null, PlaywrightError>;
  /**
   * Returns the string representation of the locator.
   *
   * @see {@link CoreLocator.toString} for the wrapped Playwright method.
   */
  readonly toString: () => string;
  /**
   * Unchecks the element.
   *
   * @see {@link CoreLocator.uncheck} for the wrapped Playwright method.
   */
  readonly uncheck: (options?: Parameters<CoreLocator["uncheck"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Runs an asynchronous operation against the underlying Playwright `Locator`.
   *
   * **When to use**
   *
   * Use when {@link LocatorShape} does not expose the native Playwright
   * operation you need.
   *
   * **Gotchas**
   *
   * The callback must return a `Promise`. Prefer the wrapper API so Playwright
   * failures remain represented by the documented wrapper operations.
   *
   * **Example** (Call a native locator method)
   *
   * ```ts
   * import { Locator } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const locator = yield* Locator
   *   return yield* locator.use((nativeLocator) => nativeLocator.isVisible())
   * })
   * ```
   *
   * @see {@link CoreLocator} for the wrapped Playwright locator.
   */
  readonly use: <T>(f: (locator: CoreLocator) => Promise<T>) => Effect.Effect<T, PlaywrightError>;
  /**
   * Returns a locator that matches only visible elements.
   *
   * @see {@link CoreLocator.visible} for the wrapped Playwright method.
   */
  readonly visible: () => LocatorShape;
  /**
   * Returns when element specified by locator satisfies the `state` option.
   *
   * @see {@link CoreLocator.waitFor} for the wrapped Playwright method.
   */
  readonly waitFor: (options?: Parameters<CoreLocator["waitFor"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns when the matched element satisfies the provided predicate.
   *
   * **Example** (Wait for an element's text)
   *
   * ```ts
   * import { Browser, PlaywrightSpawner } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const browser = yield* Browser
   *   const page = yield* browser.newPage()
   *   yield* page.setContent('<div id="status">Ready</div>')
   *   yield* page.locator("#status").waitForFunction((element, expected) => element.textContent === expected, "Ready")
   * }).pipe(PlaywrightSpawner.withBrowser, Effect.provide(PlaywrightSpawner.layer(chromium)))
   * ```
   *
   * @see {@link CoreLocator.waitForFunction} for the wrapped Playwright method.
   */
  readonly waitForFunction: <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
    pageFunction: (element: E, arg: Unboxed<Arg>) => R | Promise<R>,
    arg?: Arg,
    options?: Parameters<CoreLocator["waitForFunction"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Returns a locator that matches this locator's elements inside each element
   * matched by `locator`.
   *
   * **Details**
   *
   * Relative locators such as {@link LocatorShape.nth} or {@link LocatorShape.first}
   * are resolved separately inside each matched parent.
   *
   * **Example** (Select the third cell of every row)
   *
   * ```ts
   * import { Page } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const page = yield* Page
   *   const thirdColumn = page.getByRole("cell").nth(2).within(page.getByRole("row"))
   *   return yield* thirdColumn.allTextContents
   * })
   * ```
   *
   * @see {@link CoreLocator.within} for the wrapped Playwright method.
   */
  readonly within: (locator: LocatorShape | CoreLocator) => LocatorShape;
}

/**
 * Service for a {@link LocatorShape}.
 *
 * **Example** (Read a located element's text)
 *
 * ```ts
 * import { Locator } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const text = Effect.gen(function* () {
 *   const locator = yield* Locator
 *   return yield* locator.textContent()
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Locator extends Context.Service<Locator, LocatorShape>()($I`Locator`) {}

/**
 * Creates a {@link LocatorShape} from a native Playwright locator.
 *
 * **When to use**
 *
 * Use after an escape-hatch operation returns a native locator that should
 * re-enter the Effect wrapper API.
 *
 * **Example** (Re-wrap a native locator)
 *
 * ```ts
 * import { Locator, makeLocator } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const locator = yield* Locator
 *   const nativeLocator = yield* locator.use(async (nativeLocator) => nativeLocator.locator("button"))
 *   return makeLocator(nativeLocator)
 * })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLocator = (locator: CoreLocator): LocatorShape => {
  const use = useHelper(locator);
  const unwrap = Match.type<CoreLocator | LocatorShape>().pipe(
    Match.when(P.hasProperty("_raw"), (wrapped) => wrapped._raw),
    Match.orElse((native) => native)
  );

  return Locator.of({
    _raw: locator,
    click: Effect.fn("Locator.click")((options) => use((l) => l.click(options))),
    check: Effect.fn("Locator.check")((options) => use((l) => l.check(options))),
    fill: Effect.fn("Locator.fill")((value, options) => use((l) => l.fill(value, options))),
    getAttribute: Effect.fn("Locator.getAttribute")((name, options) => use((l) => l.getAttribute(name, options))),
    innerText: Effect.fn("Locator.innerText")((options) => use((l) => l.innerText(options))),
    innerHTML: Effect.fn("Locator.innerHTML")((options) => use((l) => l.innerHTML(options))),
    inputValue: Effect.fn("Locator.inputValue")((options) => use((l) => l.inputValue(options))),
    textContent: Effect.fn("Locator.textContent")((options) => use((l) => l.textContent(options))),
    allInnerTexts: use((l) => l.allInnerTexts()),
    allTextContents: use((l) => l.allTextContents()),
    ariaSnapshot: Effect.fn("Locator.ariaSnapshot")((options) => use((l) => l.ariaSnapshot(options))),
    ariaSnapshotJSON: Effect.fn("Locator.ariaSnapshotJSON")((options) => use((l) => l.ariaSnapshotJSON(options))),
    boundingBox: Effect.fn("Locator.boundingBox")((options) =>
      use((l) => l.boundingBox(options)).pipe(Effect.map(O.fromNullishOr))
    ),
    describe: (description) => makeLocator(locator.describe(description)),
    description: () => O.fromNullishOr(locator.description()),
    count: use((l) => l.count()),
    first: () => makeLocator(locator.first()),
    last: () => makeLocator(locator.last()),
    nth: (index) => makeLocator(locator.nth(index)),
    all: use((l) => l.all()).pipe(Effect.map(A.map(makeLocator))),
    and: (locatorOrService) => makeLocator(locator.and(unwrap(locatorOrService))),
    contentFrame: () => makeFrameLocator(locator.contentFrame()),
    filter: (options) => makeLocator(locator.filter(options)),
    frameLocator: (selector) => makeFrameLocator(locator.frameLocator(selector)),
    or: (locatorOrService) => makeLocator(locator.or(unwrap(locatorOrService))),
    within: (locatorOrService) => makeLocator(locator.within(unwrap(locatorOrService))),
    page: () => makePage(locator.page()),
    locator: (selectorOrLocator, options) =>
      makeLocator(
        P.isString(selectorOrLocator)
          ? locator.locator(selectorOrLocator, options)
          : locator.locator(unwrap(selectorOrLocator), options)
      ),
    getByRole: (role, options) => makeLocator(locator.getByRole(role, options)),
    getByText: (text, options) => makeLocator(locator.getByText(text, options)),
    getByLabel: (text, options) => makeLocator(locator.getByLabel(text, options)),
    getByPlaceholder: (text, options) => makeLocator(locator.getByPlaceholder(text, options)),
    getByAltText: (text, options) => makeLocator(locator.getByAltText(text, options)),
    getByTitle: (text, options) => makeLocator(locator.getByTitle(text, options)),
    getByTestId: (testId) => makeLocator(locator.getByTestId(testId)),
    isChecked: Effect.fn("Locator.isChecked")((options) => use((l) => l.isChecked(options))),
    isDisabled: Effect.fn("Locator.isDisabled")((options) => use((l) => l.isDisabled(options))),
    isEditable: Effect.fn("Locator.isEditable")((options) => use((l) => l.isEditable(options))),
    isEnabled: Effect.fn("Locator.isEnabled")((options) => use((l) => l.isEnabled(options))),
    isHidden: Effect.fn("Locator.isHidden")((options) => use((l) => l.isHidden(options))),
    isVisible: Effect.fn("Locator.isVisible")((options) => use((l) => l.isVisible(options))),
    visible: () => makeLocator(locator.visible()),
    waitFor: Effect.fn("Locator.waitFor")((options) => use((l) => l.waitFor(options))),
    waitForFunction: Effect.fn("Locator.waitForFunction")(
      <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
        pageFunction: (element: E, arg: Unboxed<Arg>) => R | Promise<R>,
        arg?: Arg,
        options?: Parameters<CoreLocator["waitForFunction"]>[2]
      ) =>
        use((l) =>
          l.waitForFunction<Arg, E>(
            pageFunction as unknown as Parameters<typeof l.waitForFunction<Arg, E>>[0],
            arg,
            options
          )
        )
    ),
    evaluate: Effect.fn("Locator.evaluate")(
      <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
        pageFunction: (element: E, arg: Unboxed<Arg>) => R | Promise<R>,
        arg?: Arg,
        options?: Parameters<CoreLocator["evaluate"]>[2]
      ) =>
        use((l) =>
          l.evaluate<R, Arg, E>(pageFunction as unknown as Parameters<typeof l.evaluate<R, Arg, E>>[0], arg, options)
        )
    ),
    evaluateAll: Effect.fn("Locator.evaluateAll")(
      <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
        pageFunction: (elements: E[], arg: Unboxed<Arg>) => R | Promise<R>,
        arg?: Arg
      ) =>
        use((l) =>
          l.evaluateAll<R, Arg, E>(pageFunction as unknown as Parameters<typeof l.evaluateAll<R, Arg, E>>[0], arg)
        )
    ),
    evaluateHandle: Effect.fn("Locator.evaluateHandle")(
      <R, Arg = void, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(
        pageFunction: (element: E, arg: Unboxed<Arg>) => R | Promise<R>,
        arg?: Arg,
        options?: Parameters<CoreLocator["evaluateHandle"]>[2]
      ): Effect.Effect<JSHandle<R>, PlaywrightError> =>
        use((l) =>
          l.evaluateHandle<R, Arg, E>(
            pageFunction as unknown as Parameters<typeof l.evaluateHandle<R, Arg, E>>[0],
            arg,
            options
          )
        )
    ),
    elementHandle: Effect.fn("Locator.elementHandle")((options) =>
      use((l) => l.elementHandle(options)).pipe(Effect.map(O.fromNullishOr))
    ),
    elementHandles: use((l) => l.elementHandles()),
    highlight: Effect.fn("Locator.highlight")((options) => use((l) => l.highlight(options))),
    hideHighlight: use((l) => l.hideHighlight()),
    drop: Effect.fn("Locator.drop")((data, options) => use((l) => l.drop(data, options))),
    normalize: use((l) => l.normalize()).pipe(Effect.map(makeLocator)),
    screenshot: Effect.fn("Locator.screenshot")((options) => use((l) => l.screenshot(options))),
    blur: Effect.fn("Locator.blur")((options) => use((l) => l.blur(options))),
    clear: Effect.fn("Locator.clear")((options) => use((l) => l.clear(options))),
    dblclick: Effect.fn("Locator.dblclick")((options) => use((l) => l.dblclick(options))),
    dispatchEvent: Effect.fn("Locator.dispatchEvent")((type, eventInit, options) =>
      use((l) => l.dispatchEvent(type, eventInit, options))
    ),
    dragTo: Effect.fn("Locator.dragTo")((target, options) => use((l) => l.dragTo(unwrap(target), options))),
    focus: Effect.fn("Locator.focus")((options) => use((l) => l.focus(options))),
    hover: Effect.fn("Locator.hover")((options) => use((l) => l.hover(options))),
    press: Effect.fn("Locator.press")((key, options) => use((l) => l.press(key, options))),
    pressSequentially: Effect.fn("Locator.pressSequentially")((text, options) =>
      use((l) => l.pressSequentially(text, options))
    ),
    scrollIntoViewIfNeeded: Effect.fn("Locator.scrollIntoViewIfNeeded")((options) =>
      use((l) => l.scrollIntoViewIfNeeded(options))
    ),
    selectOption: Effect.fn("Locator.selectOption")((values, options) => use((l) => l.selectOption(values, options))),
    selectText: Effect.fn("Locator.selectText")((options) => use((l) => l.selectText(options))),
    setChecked: Effect.fn("Locator.setChecked")((checked, options) => use((l) => l.setChecked(checked, options))),
    setInputFiles: Effect.fn("Locator.setInputFiles")((files, options) => use((l) => l.setInputFiles(files, options))),
    tap: Effect.fn("Locator.tap")((options) => use((l) => l.tap(options))),
    uncheck: Effect.fn("Locator.uncheck")((options) => use((l) => l.uncheck(options))),
    toString: () => locator.toString(),
    use,
  });
};
