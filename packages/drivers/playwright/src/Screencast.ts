/**
 * Effect service wrapper for Playwright screencast recording and overlays.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { Screencast as CoreScreencast } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Screencast");

/**
 * The screencast of a page, with recording and overlay operations as Effects.
 *
 * @category models
 * @since 0.0.0
 */
export interface ScreencastShape {
  /**
   * Hides action annotations.
   *
   * @see {@link CoreScreencast.hideActions} for the wrapped Playwright method.
   */
  readonly hideActions: Effect.Effect<void, PlaywrightError>;
  /**
   * Hides all overlays.
   *
   * @see {@link CoreScreencast.hideOverlays} for the wrapped Playwright method.
   */
  readonly hideOverlays: Effect.Effect<void, PlaywrightError>;
  /**
   * Shows action annotations.
   *
   * @see {@link CoreScreencast.showActions} for the wrapped Playwright method.
   */
  readonly showActions: (
    options?: Parameters<CoreScreencast["showActions"]>[0]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Shows a chapter title.
   *
   * @see {@link CoreScreencast.showChapter} for the wrapped Playwright method.
   */
  readonly showChapter: (
    title: string,
    options?: Parameters<CoreScreencast["showChapter"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Shows a custom HTML overlay.
   *
   * @see {@link CoreScreencast.showOverlay} for the wrapped Playwright method.
   */
  readonly showOverlay: (
    html: string,
    options?: Parameters<CoreScreencast["showOverlay"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
  /**
   * Shows all overlays.
   *
   * @see {@link CoreScreencast.showOverlays} for the wrapped Playwright method.
   */
  readonly showOverlays: Effect.Effect<void, PlaywrightError>;
  /**
   * Starts recording the screencast.
   *
   * @see {@link CoreScreencast.start} for the wrapped Playwright method.
   */
  readonly start: (options?: Parameters<CoreScreencast["start"]>[0]) => Effect.Effect<void, PlaywrightError>;
  /**
   * Stops recording the screencast.
   *
   * @see {@link CoreScreencast.stop} for the wrapped Playwright method.
   */
  readonly stop: Effect.Effect<void, PlaywrightError>;
}

/**
 * Service for a {@link ScreencastShape}.
 *
 * **Example** (Record a titled chapter)
 *
 * ```ts
 * import { Screencast } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const recorded = Effect.gen(function* () {
 *   const screencast = yield* Screencast
 *   yield* screencast.start({ path: "session.webm" })
 *   yield* screencast.showChapter("Sign in")
 *   yield* screencast.stop
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Screencast extends Context.Service<Screencast, ScreencastShape>()($I`Screencast`) {}

/**
 * Creates a `Screencast` from a Playwright `Screencast` instance.
 *
 * **Example** (Wrap a page's screencast)
 *
 * ```ts
 * import { makeScreencast } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const hideOverlays = (page: Page) => makeScreencast(page.screencast).hideOverlays
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeScreencast = (screencast: CoreScreencast): ScreencastShape => {
  const use = useHelper(screencast);

  return Screencast.of({
    start: Effect.fn("Screencast.start")((options) => use((s) => s.start(options)).pipe(Effect.asVoid)),
    stop: use((s) => s.stop()),
    showActions: Effect.fn("Screencast.showActions")((options) =>
      use((s) => s.showActions(options)).pipe(Effect.asVoid)
    ),
    hideActions: use((s) => s.hideActions()),
    showChapter: Effect.fn("Screencast.showChapter")((title, options) => use((s) => s.showChapter(title, options))),
    showOverlay: Effect.fn("Screencast.showOverlay")((html, options) =>
      use((s) => s.showOverlay(html, options)).pipe(Effect.asVoid)
    ),
    showOverlays: use((s) => s.showOverlays()),
    hideOverlays: use((s) => s.hideOverlays()),
  });
};
