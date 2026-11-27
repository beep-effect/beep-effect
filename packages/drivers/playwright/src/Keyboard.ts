/**
 * Effect service wrapper for Playwright keyboard input.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { Keyboard as CoreKeyboard } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Keyboard");

/**
 * The keyboard of a page, with every key operation as an Effect.
 *
 * @category models
 * @since 0.0.0
 */
export interface KeyboardShape {
  /**
   * Dispatches a `keydown` event.
   *
   * @see {@link CoreKeyboard.down} for the wrapped Playwright method.
   */
  readonly down: (key: Parameters<CoreKeyboard["down"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches only `input` event, does not emit the `keydown`, `keyup` or `keypress` events.
   *
   * @see {@link CoreKeyboard.insertText} for the wrapped Playwright method.
   */
  readonly insertText: (text: Parameters<CoreKeyboard["insertText"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches a `keydown` and `keyup` event.
   *
   * @see {@link CoreKeyboard.press} for the wrapped Playwright method.
   */
  readonly press: (
    key: Parameters<CoreKeyboard["press"]>[0],
    options?: Parameters<CoreKeyboard["press"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.
   *
   * @see {@link CoreKeyboard."type"} for the wrapped Playwright method.
   */
  readonly type: (
    text: Parameters<CoreKeyboard["type"]>[0],
    options?: Parameters<CoreKeyboard["type"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches a `keyup` event.
   *
   * @see {@link CoreKeyboard.up} for the wrapped Playwright method.
   */
  readonly up: (key: Parameters<CoreKeyboard["up"]>[0]) => Effect.Effect<void, PlaywrightError>;
}

/**
 * Service for a {@link KeyboardShape}.
 *
 * **Example** (Type into the focused element)
 *
 * ```ts
 * import { Keyboard } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const typed = Effect.gen(function* () {
 *   const keyboard = yield* Keyboard
 *   yield* keyboard.type("hello")
 *   yield* keyboard.press("Enter")
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Keyboard extends Context.Service<Keyboard, KeyboardShape>()($I`Keyboard`) {}

/**
 * Creates a `Keyboard` from a Playwright `Keyboard` instance.
 *
 * **Example** (Wrap a page's keyboard)
 *
 * ```ts
 * import { makeKeyboard } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const press = (page: Page) => makeKeyboard(page.keyboard).press("Enter")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeKeyboard = (keyboard: CoreKeyboard): KeyboardShape => {
  const use = useHelper(keyboard);

  return Keyboard.of({
    down: Effect.fn("Keyboard.down")((key) => use((k) => k.down(key))),
    insertText: Effect.fn("Keyboard.insertText")((text) => use((k) => k.insertText(text))),
    press: Effect.fn("Keyboard.press")((key, options) => use((k) => k.press(key, options))),
    type: Effect.fn("Keyboard.type")((text, options) => use((k) => k.type(text, options))),
    up: Effect.fn("Keyboard.up")((key) => use((k) => k.up(key))),
  });
};
