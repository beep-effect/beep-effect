/**
 * A browser window as a mapper sees it: what the site answered, and a way to
 * ask it for more.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type * as Duration from "effect/Duration";
import type * as Effect from "effect/Effect";
import type * as HashSet from "effect/HashSet";
import type * as O from "effect/Option";
import type * as Scope from "effect/Scope";
import type * as Stream from "effect/Stream";

const $I = $SocialMapperId.create("core/browser");

/**
 * **Example** (Report a browser that would not start)
 *
 * ```ts import.meta.vitest name="Report a browser that would not start"
 * import { BrowserFailed } from "@/core/browser"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = Effect.fail(BrowserFailed.make({ detail: "no executable" })).pipe(
 *   Effect.catchTag("BrowserFailed", ({ detail }) => Effect.succeed(detail))
 * )
 * Effect.runSync(outcome) // => "no executable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BrowserFailed extends S.TaggedError<BrowserFailed, { readonly brand: unique symbol }>($I`BrowserFailed`)(
  "BrowserFailed",
  { detail: S.String },
  $I.annoteError<BrowserFailed>("BrowserFailed", {
    description: "The browser could not be started, driven or read.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BrowserFailed {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "BrowserFailed";
    readonly detail: string;
  }
}

/**
 * One JSON answer a site gave the page.
 *
 * **Details**
 *
 * `body` is read on demand: most answers a page receives are not the ones a
 * mapper wants, and their bodies are never parsed.
 *
 * @category models
 * @since 0.0.0
 */
export interface Exchange {
  readonly body: Effect.Effect<unknown, BrowserFailed>;
  readonly retryAfter: O.Option<Duration.Duration>;
  readonly status: number;
  readonly url: URL;
}

/**
 * One open page of a signed-in browser window.
 *
 * **Details**
 *
 * `visit` starts listening before it navigates, so the answers the page
 * fetches while loading are part of the stream. The stream stays open for
 * as long as it is consumed; what the page fetches later, after `scroll`,
 * arrives on it too. `scroll` reports whether the page moved. `closed` ends
 * when the window is gone, whoever closed it.
 *
 * @category models
 * @since 0.0.0
 */
export interface Tab {
  readonly closed: Effect.Effect<void>;
  readonly cookies: (origin: URL) => Effect.Effect<HashSet.HashSet<string>, BrowserFailed>;
  readonly scroll: Effect.Effect<boolean, BrowserFailed>;
  readonly visit: (url: URL) => Stream.Stream<Exchange, BrowserFailed>;
}

/**
 * Opens browser windows over a profile directory that keeps its sign-ins.
 *
 * **Details**
 *
 * The window lives as long as the scope it was opened in. A profile
 * directory serves one window at a time; `Sessions` is the service that
 * hands directories out and enforces that.
 *
 * **Example** (Read the names of the cookies a profile holds)
 *
 * ```ts import.meta.vitest name="Read the names of the cookies a profile holds"
 * import { Browser } from "@/core/browser"
 * import * as Effect from "effect/Effect"
 *
 * const names = Effect.gen(function* () {
 *   const browser = yield* Browser
 *   const tab = yield* browser.open({ directory: "profiles/example", visible: false })
 *   return yield* tab.cookies(new URL("https://example.com"))
 * }).pipe(Effect.scoped)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Browser extends Context.Service<
  Browser,
  {
    readonly open: (options: {
      readonly directory: string;
      readonly visible: boolean;
    }) => Effect.Effect<Tab, BrowserFailed, Scope.Scope>;
  }
>()($I`Browser`) {}
