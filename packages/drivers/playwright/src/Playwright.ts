/**
 * Service for launching and connecting Playwright browsers with explicit or
 * scope-managed lifecycles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { chromium } from "playwright";
import { makeBrowser } from "./Browser.ts";
import { makeBrowserContext } from "./BrowserContext.ts";
import { wrapError } from "./PlaywrightError.ts";
import type * as Scope from "effect/Scope";
import type { BrowserType, ConnectOverCDPOptions } from "playwright";
import type { BrowserShape, LaunchOptions } from "./Browser.ts";
import type { BrowserContextShape } from "./BrowserContext.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Playwright");

type LaunchPersistentContextOptions = Parameters<BrowserType["launchPersistentContext"]>[1];

/**
 * Browser launch and connection operations with explicit ownership semantics.
 *
 * **When to use**
 *
 * Use this service when browser acquisition is part of an Effect program.
 * Prefer the `Scoped` variants unless ownership must outlive the current scope.
 *
 * @category models
 * @since 0.0.0
 */
export interface PlaywrightShape {
  /**
   * Connects to a browser over CDP and leaves connection ownership to the caller.
   *
   * **When to use**
   *
   * Use when the CDP connection must outlive the current `Scope`. Prefer
   * `connectCDPScoped` otherwise.
   *
   * **Gotchas**
   *
   * Closing the wrapper closes only the CDP connection, not the remote browser.
   *
   * **Example** (Closing a manually managed CDP connection)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const browser = yield* playwright.connectCDP("http://127.0.0.1:9222")
   *   return yield* Effect.ensuring(Effect.void, browser.close.pipe(Effect.ignore))
   * }).pipe(Effect.provide(Playwright.layer))
   * ```
   *
   * @param cdpUrl - CDP endpoint URL.
   */
  readonly connectCDP: (
    cdpUrl: string,
    options?: ConnectOverCDPOptions
  ) => Effect.Effect<BrowserShape, PlaywrightError>;
  /**
   * Connects to a browser over CDP and manages the connection with `Scope`.
   *
   * **When to use**
   *
   * Use this as the default CDP connection API. Scope finalization closes the
   * connection but does not stop the remote browser process.
   *
   * **Example** (Connecting over CDP within a scope)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const browser = yield* playwright.connectCDPScoped("http://127.0.0.1:9222")
   *   return browser.isConnected()
   * }).pipe(Effect.scoped, Effect.provide(Playwright.layer))
   * ```
   *
   * @param cdpUrl - CDP endpoint URL.
   */
  readonly connectCDPScoped: (
    cdpUrl: string,
    options?: ConnectOverCDPOptions
  ) => Effect.Effect<BrowserShape, PlaywrightError, Scope.Scope>;
  /**
   * Launches a browser whose lifetime is managed by the caller.
   *
   * **When to use**
   *
   * Use when the browser must outlive the current `Scope`. Prefer
   * `launchScoped` for ordinary Effect workflows.
   *
   * **Gotchas**
   *
   * The returned browser is not closed automatically. Ensure `browser.close`
   * runs after success, failure, and interruption.
   *
   * **Example** (Closing a manually managed browser)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const browser = yield* playwright.launch(chromium)
   *   return yield* Effect.gen(function* () {
   *     const page = yield* browser.newPage()
   *     yield* page.setContent("<h1>Effect</h1>")
   *   }).pipe(Effect.ensuring(browser.close.pipe(Effect.ignore)))
   * }).pipe(Effect.provide(Playwright.layer))
   * ```
   *
   * @param browserType - The browser engine to launch.
   */
  readonly launch: (browserType: BrowserType, options?: LaunchOptions) => Effect.Effect<BrowserShape, PlaywrightError>;
  /**
   * Launches a persistent browser context managed by the caller.
   *
   * **When to use**
   *
   * Use when browser state must persist in `userDataDir` and the context must
   * outlive the current `Scope`. Prefer `launchPersistentContextScoped`
   * otherwise.
   *
   * **Gotchas**
   *
   * Closing this context also closes its browser process. The context is not
   * closed automatically by this method.
   *
   * **Example** (Closing a persistent context)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const context = yield* playwright.launchPersistentContext(chromium, "./.playwright-profile")
   *   return yield* Effect.gen(function* () {
   *     const page = yield* context.newPage
   *     yield* page.setContent("<h1>Effect</h1>")
   *   }).pipe(Effect.ensuring(context.close.pipe(Effect.ignore)))
   * }).pipe(Effect.provide(Playwright.layer))
   * ```
   *
   * @param browserType - The browser engine to launch.
   * @param userDataDir - Browser profile directory, or `""` for a temporary directory.
   */
  readonly launchPersistentContext: (
    browserType: BrowserType,
    userDataDir: string,
    options?: LaunchPersistentContextOptions
  ) => Effect.Effect<BrowserContextShape, PlaywrightError>;
  /**
   * Launches a persistent browser context managed by the current `Scope`.
   *
   * **When to use**
   *
   * Use when a scoped workflow needs a persistent browser profile. Closing the
   * scope closes both the context and its browser process.
   *
   * **Example** (Launching a scoped persistent context)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const context = yield* playwright.launchPersistentContextScoped(chromium, "./.playwright-profile")
   *   const page = yield* context.newPage
   *   yield* page.setContent("<h1>Effect</h1>")
   * }).pipe(Effect.scoped, Effect.provide(Playwright.layer))
   * ```
   *
   * @param browserType - The browser engine to launch.
   * @param userDataDir - Browser profile directory, or `""` for a temporary directory.
   */
  readonly launchPersistentContextScoped: (
    browserType: BrowserType,
    userDataDir: string,
    options?: LaunchPersistentContextOptions
  ) => Effect.Effect<BrowserContextShape, PlaywrightError, Scope.Scope>;
  /**
   * Launches a browser managed by the current `Scope`.
   *
   * **When to use**
   *
   * Use this as the default browser acquisition API. The browser closes when
   * the scope ends, including after failure or interruption.
   *
   * **Example** (Launching a scoped browser)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const program = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const browser = yield* playwright.launchScoped(chromium)
   *   const page = yield* browser.newPage()
   *   yield* page.setContent("<h1>Effect</h1>")
   * }).pipe(Effect.scoped, Effect.provide(Playwright.layer))
   * ```
   *
   * @param browserType - The browser engine to launch.
   */
  readonly launchScoped: (
    browserType: BrowserType,
    options?: LaunchOptions
  ) => Effect.Effect<BrowserShape, PlaywrightError, Scope.Scope>;
}

const launch = Effect.fn("Playwright.launch")(function* (browserType: BrowserType, options?: LaunchOptions) {
  const rawBrowser = yield* Effect.tryPromise({
    try: () => browserType.launch(options),
    catch: wrapError,
  });

  return makeBrowser(rawBrowser);
});

const connectCDP = Effect.fn("Playwright.connectCDP")(function* (cdpUrl: string, options?: ConnectOverCDPOptions) {
  const browser = yield* Effect.tryPromise({
    try: () => chromium.connectOverCDP(cdpUrl, options),
    catch: wrapError,
  });

  return makeBrowser(browser);
});

const launchPersistentContext = Effect.fn("Playwright.launchPersistentContext")(function* (
  browserType: BrowserType,
  userDataDir: string,
  options?: LaunchPersistentContextOptions
) {
  const rawContext = yield* Effect.tryPromise({
    try: () => browserType.launchPersistentContext(userDataDir, options),
    catch: wrapError,
  });

  return makeBrowserContext(rawContext);
});

/**
 * Service for a {@link PlaywrightShape}, the entry point for acquiring browsers.
 *
 * **Example** (Evaluate a script in a scoped browser)
 *
 * ```ts
 * import { Playwright } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 * import { chromium } from "playwright"
 *
 * const sum = Effect.gen(function* () {
 *   const playwright = yield* Playwright
 *   const browser = yield* playwright.launchScoped(chromium)
 *   const page = yield* browser.newPage()
 *   return yield* page.evaluate(() => 1 + 1)
 * }).pipe(Effect.scoped, Effect.provide(Playwright.layer))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Playwright extends Context.Service<Playwright, PlaywrightShape>()($I`Playwright`) {
  /**
   * The layer that provides the {@link Playwright} service.
   *
   * **Example** (Provide Playwright to a program)
   *
   * ```ts
   * import { Playwright } from "@beep/playwright"
   * import * as Effect from "effect/Effect"
   * import { chromium } from "playwright"
   *
   * const version = Effect.gen(function* () {
   *   const playwright = yield* Playwright
   *   const browser = yield* playwright.launchScoped(chromium)
   *   return browser.version()
   * }).pipe(Effect.scoped, Effect.provide(Playwright.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Playwright> = Layer.succeed(
    Playwright,
    Playwright.of({
      launch,
      launchScoped: Effect.fn("Playwright.launchScoped")((browserType, options) =>
        Effect.acquireRelease(launch(browserType, options), (browser) => browser.close.pipe(Effect.ignore))
      ),
      launchPersistentContext,
      launchPersistentContextScoped: Effect.fn("Playwright.launchPersistentContextScoped")(
        (browserType, userDataDir, options) =>
          Effect.acquireRelease(launchPersistentContext(browserType, userDataDir, options), (context) =>
            context.close.pipe(Effect.ignore)
          )
      ),
      connectCDP,
      connectCDPScoped: Effect.fn("Playwright.connectCDPScoped")((cdpUrl, options) =>
        Effect.acquireRelease(connectCDP(cdpUrl, options), (browser) => browser.close.pipe(Effect.ignore))
      ),
    })
  );
}
