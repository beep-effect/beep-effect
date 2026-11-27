/**
 * Effect services and value wrappers for browser automation with Playwright.
 *
 * **Details**
 *
 * Ported from the MIT-licensed `effect-playwright` by Jobflow GmbH; the
 * package's `NOTICE.md` records what was ported and changed. The package
 * downloads no browsers: pass `executablePath` to launch a system browser.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Playwright's Chromium, Firefox and WebKit browser engines, re-exported from `playwright`.
 *
 * **Example** (Name the engine to launch)
 *
 * ```ts
 * import { chromium } from "@beep/playwright"
 *
 * const engine = chromium.name()
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export { chromium, firefox, webkit } from "playwright";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Browser.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./BrowserContext.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Clock.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Common.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Credentials.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Frame.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./FrameLocator.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Keyboard.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Locator.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Mouse.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Page.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Playwright.ts";
/**
 * @since 0.0.0
 * @category errors
 */
export * from "./PlaywrightError.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./PlaywrightSpawner.ts";
/**
 * @since 0.0.0
 * @category type-level
 */
export * from "./PlaywrightTypes.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Screencast.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Touchscreen.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Tracing.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WebMCP.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WebStorage.ts";
