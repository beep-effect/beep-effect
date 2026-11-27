/**
 * Effect service wrapper for Playwright touchscreen input.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { Touchscreen as CoreTouchscreen } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Touchscreen");

/**
 * The touchscreen of a page, with every touch operation as an Effect.
 *
 * @category models
 * @since 0.0.0
 */
export interface TouchscreenShape {
  /**
   * Dispatches a `touchstart` and `touchend` event with a single touch at the position
   * ([`x`](https://playwright.dev/docs/api/class-touchscreen#touchscreen-tap-option-x),[`y`](https://playwright.dev/docs/api/class-touchscreen#touchscreen-tap-option-y)).
   *
   * @see {@link CoreTouchscreen.tap} for the wrapped Playwright method.
   */
  readonly tap: (
    x: Parameters<CoreTouchscreen["tap"]>[0],
    y: Parameters<CoreTouchscreen["tap"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
}

/**
 * Service for a {@link TouchscreenShape}.
 *
 * **Example** (Tap a point)
 *
 * ```ts
 * import { Touchscreen } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const tapped = Effect.gen(function* () {
 *   const touchscreen = yield* Touchscreen
 *   yield* touchscreen.tap(40, 80)
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Touchscreen extends Context.Service<Touchscreen, TouchscreenShape>()($I`Touchscreen`) {}

/**
 * Creates a `Touchscreen` from a Playwright `Touchscreen` instance.
 *
 * **Example** (Wrap a page's touchscreen)
 *
 * ```ts
 * import { makeTouchscreen } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const tapCorner = (page: Page) => makeTouchscreen(page.touchscreen).tap(1, 1)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeTouchscreen = (touchscreen: CoreTouchscreen): TouchscreenShape => {
  const use = useHelper(touchscreen);

  return Touchscreen.of({
    tap: Effect.fn("Touchscreen.tap")((x, y) => use((t) => t.tap(x, y))),
  });
};
