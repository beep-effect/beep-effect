/**
 * Service for provisioning a scoped Playwright browser.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Browser } from "./Browser.ts";
import { Playwright } from "./Playwright.ts";
import type * as Scope from "effect/Scope";
import type { BrowserType, LaunchOptions } from "playwright";
import type { BrowserShape } from "./Browser.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("PlaywrightSpawner");

/**
 * Deferred acquisition of a browser scoped to the caller's lifetime.
 *
 * **When to use**
 *
 * Use through `PlaywrightSpawner.withBrowser` for the common case, or access
 * `browser` directly when composing a custom scoped layer.
 *
 * @category models
 * @since 0.0.0
 */
export interface PlaywrightSpawnerShape {
  /**
   * Launches a browser that closes when the surrounding scope ends.
   */
  readonly browser: Effect.Effect<BrowserShape, PlaywrightError, Scope.Scope>;
}

/**
 * Service for the active {@link PlaywrightSpawnerShape}.
 *
 * **Example** (Acquire a spawned browser)
 *
 * ```ts
 * import { PlaywrightSpawner } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 * import { chromium } from "playwright"
 *
 * const version = Effect.gen(function* () {
 *   const spawner = yield* PlaywrightSpawner
 *   const browser = yield* spawner.browser
 *   return browser.version()
 * }).pipe(Effect.scoped, Effect.provide(PlaywrightSpawner.layer(chromium)))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PlaywrightSpawner extends Context.Service<PlaywrightSpawner, PlaywrightSpawnerShape>()(
  $I`PlaywrightSpawner`
) {
  /**
   * Creates a layer that configures scoped browser acquisition.
   *
   * **Details**
   *
   * Providing this layer does not launch a browser eagerly. A browser is
   * launched when the `browser` effect is evaluated inside a scope. The layer
   * also provides the underlying `Playwright` service.
   *
   * **Example** (Acquiring the browser directly)
   *
   * ```ts
   * import { PlaywrightSpawner } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const spawner = yield* PlaywrightSpawner
   *   const browser = yield* spawner.browser
   *   const page = yield* browser.newPage()
   *   yield* page.setContent("<h1>Effect</h1>")
   * }).pipe(Effect.scoped, Effect.provide(PlaywrightSpawner.layer(chromium)))
   * ```
   *
   * @param browserType - Browser engine to launch.
   * @param launchOptions - Optional browser launch options.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (browserType: BrowserType, launchOptions?: LaunchOptions): Layer.Layer<PlaywrightSpawner> =>
    Playwright.pipe(
      Effect.map((playwright) =>
        PlaywrightSpawner.of({
          browser: playwright.launchScoped(browserType, launchOptions),
        })
      ),
      Layer.effect(PlaywrightSpawner),
      Layer.provide(Playwright.layer)
    );

  /**
   * Provides a scoped `Browser` to an Effect.
   *
   * **When to use**
   *
   * Use this as the concise alternative to accessing `PlaywrightSpawner` and
   * its `browser` effect directly.
   *
   * **Details**
   *
   * A fresh browser is launched when the returned effect starts and is closed
   * when that effect succeeds, fails, or is interrupted. The
   * `PlaywrightSpawner` layer must already be provided.
   *
   * **Example** (Providing a browser for one program)
   *
   * ```ts
   * import { Browser, PlaywrightSpawner } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const browser = yield* Browser
   *   const page = yield* browser.newPage()
   *   yield* page.setContent("<h1>Effect</h1>")
   * }).pipe(PlaywrightSpawner.withBrowser, Effect.provide(PlaywrightSpawner.layer(chromium)))
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly withBrowser = <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.scoped(
      Effect.provideServiceEffect(
        self,
        Browser,
        PlaywrightSpawner.use((spawner) => spawner.browser)
      )
    );
}
