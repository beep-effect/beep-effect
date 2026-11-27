/**
 * Effect service wrapper for page-local and session storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { useHelper } from "./internal/use.ts";
import type { WebStorage as CoreWebStorage } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("WebStorage");

/**
 * The local or session storage of a page, with every storage operation as an Effect.
 *
 * @category models
 * @since 0.0.0
 */
export interface WebStorageShape {
  /**
   * Removes all items from storage.
   *
   * @see {@link CoreWebStorage.clear} for the wrapped Playwright method.
   */
  readonly clear: Effect.Effect<Awaited<ReturnType<CoreWebStorage["clear"]>>, PlaywrightError>;
  /**
   * Returns the value stored under the given name, if present.
   *
   * @see {@link CoreWebStorage.getItem} for the wrapped Playwright method.
   */
  readonly getItem: (
    name: Parameters<CoreWebStorage["getItem"]>[0]
  ) => Effect.Effect<O.Option<NonNullable<Awaited<ReturnType<CoreWebStorage["getItem"]>>>>, PlaywrightError>;
  /**
   * Returns all items in storage as name/value pairs.
   *
   * @see {@link CoreWebStorage.items} for the wrapped Playwright method.
   */
  readonly items: Effect.Effect<Awaited<ReturnType<CoreWebStorage["items"]>>, PlaywrightError>;
  /**
   * Removes the item stored under the given name.
   *
   * @see {@link CoreWebStorage.removeItem} for the wrapped Playwright method.
   */
  readonly removeItem: (
    name: Parameters<CoreWebStorage["removeItem"]>[0]
  ) => Effect.Effect<Awaited<ReturnType<CoreWebStorage["removeItem"]>>, PlaywrightError>;
  /**
   * Stores a value under the given name.
   *
   * @see {@link CoreWebStorage.setItem} for the wrapped Playwright method.
   */
  readonly setItem: (
    name: Parameters<CoreWebStorage["setItem"]>[0],
    value: Parameters<CoreWebStorage["setItem"]>[1]
  ) => Effect.Effect<Awaited<ReturnType<CoreWebStorage["setItem"]>>, PlaywrightError>;
}

/**
 * Service for a {@link WebStorageShape}.
 *
 * **Example** (Round-trip a stored value)
 *
 * ```ts
 * import { WebStorage } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const theme = Effect.gen(function* () {
 *   const storage = yield* WebStorage
 *   yield* storage.setItem("theme", "dark")
 *   return yield* storage.getItem("theme")
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WebStorage extends Context.Service<WebStorage, WebStorageShape>()($I`WebStorage`) {}

/**
 * Creates a `WebStorage` from a Playwright `WebStorage` instance.
 *
 * **Example** (Wrap a page's local storage)
 *
 * ```ts
 * import { makeWebStorage } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const storedItems = (page: Page) => makeWebStorage(page.localStorage).items
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeWebStorage = (webStorage: CoreWebStorage): WebStorageShape => {
  const use = useHelper(webStorage);

  return WebStorage.of({
    clear: use((storage) => storage.clear()),
    getItem: Effect.fn("WebStorage.getItem")((name) =>
      use((storage) => storage.getItem(name)).pipe(Effect.map(O.fromNullishOr))
    ),
    items: use((storage) => storage.items()),
    removeItem: Effect.fn("WebStorage.removeItem")((name) => use((storage) => storage.removeItem(name))),
    setItem: Effect.fn("WebStorage.setItem")((name, value) => use((storage) => storage.setItem(name, value))),
  });
};
