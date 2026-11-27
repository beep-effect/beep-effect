/**
 * Effect service wrapper for Playwright mouse input.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { Mouse as CoreMouse } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Mouse");

/**
 * The mouse of a page, with every pointer operation as an Effect.
 *
 * @category models
 * @since 0.0.0
 */
export interface MouseShape {
  /**
   * Shortcut for mouse.move, mouse.down, mouse.up.
   *
   * @see {@link CoreMouse.click} for the wrapped Playwright method.
   */
  readonly click: (
    x: Parameters<CoreMouse["click"]>[0],
    y: Parameters<CoreMouse["click"]>[1],
    options?: Parameters<CoreMouse["click"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Shortcut for mouse.move, mouse.down, mouse.up, mouse.down and mouse.up.
   *
   * @see {@link CoreMouse.dblclick} for the wrapped Playwright method.
   */
  readonly dblclick: (
    x: Parameters<CoreMouse["dblclick"]>[0],
    y: Parameters<CoreMouse["dblclick"]>[1],
    options?: Parameters<CoreMouse["dblclick"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches a `mousedown` event.
   *
   * @see {@link CoreMouse.down} for the wrapped Playwright method.
   */
  readonly down: (options?: Parameters<CoreMouse["down"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches a `mousemove` event.
   *
   * @see {@link CoreMouse.move} for the wrapped Playwright method.
   */
  readonly move: (
    x: Parameters<CoreMouse["move"]>[0],
    y: Parameters<CoreMouse["move"]>[1],
    options?: Parameters<CoreMouse["move"]>[2]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches a `mouseup` event.
   *
   * @see {@link CoreMouse.up} for the wrapped Playwright method.
   */
  readonly up: (options?: Parameters<CoreMouse["up"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Dispatches a `wheel` event.
   *
   * @see {@link CoreMouse.wheel} for the wrapped Playwright method.
   */
  readonly wheel: (
    deltaX: Parameters<CoreMouse["wheel"]>[0],
    deltaY: Parameters<CoreMouse["wheel"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
}

/**
 * Service for a {@link MouseShape}.
 *
 * **Example** (Drag with the mouse)
 *
 * ```ts
 * import { Mouse } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const dragged = Effect.gen(function* () {
 *   const mouse = yield* Mouse
 *   yield* mouse.move(10, 10)
 *   yield* mouse.down()
 *   yield* mouse.move(200, 120, { steps: 5 })
 *   yield* mouse.up()
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Mouse extends Context.Service<Mouse, MouseShape>()($I`Mouse`) {}

/**
 * Creates a `Mouse` from a Playwright `Mouse` instance.
 *
 * **Example** (Wrap a page's mouse)
 *
 * ```ts
 * import { makeMouse } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const clickCorner = (page: Page) => makeMouse(page.mouse).click(1, 1)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeMouse = (mouse: CoreMouse): MouseShape => {
  const use = useHelper(mouse);

  return Mouse.of({
    click: Effect.fn("Mouse.click")((x, y, options) => use((m) => m.click(x, y, options))),
    dblclick: Effect.fn("Mouse.dblclick")((x, y, options) => use((m) => m.dblclick(x, y, options))),
    down: Effect.fn("Mouse.down")((options) => use((m) => m.down(options))),
    move: Effect.fn("Mouse.move")((x, y, options) => use((m) => m.move(x, y, options))),
    up: Effect.fn("Mouse.up")((options) => use((m) => m.up(options))),
    wheel: Effect.fn("Mouse.wheel")((deltaX, deltaY) => use((m) => m.wheel(deltaX, deltaY))),
  });
};
