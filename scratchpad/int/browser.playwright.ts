/**
 * The Chromium that backs `Browser`, driven through Playwright.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as Queue from "effect/Queue"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Str from "effect/String"
import { chromium, type Response } from "playwright"
import { Browser, BrowserFailed, type Exchange } from "./browser.ts"

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, BrowserFailed> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => BrowserFailed.make({ detail: P.isError(cause) ? cause.message : "the browser gave no reason" })
  })

const seconds = S.decodeUnknownOption(S.FiniteFromString)

const exchange = (response: Response): O.Option<Exchange> => {
  const headers = response.headers()
  return R.get(headers, "content-type").pipe(
    O.filter(Str.includes("json")),
    O.map(() => ({
      url: new URL(response.url()),
      status: response.status(),
      retryAfter: R.get(headers, "retry-after").pipe(O.flatMap(seconds), O.map(Duration.seconds)),
      body: attempt(() => response.json())
    }))
  )
}

const advance = "(() => { const before = window.scrollY; window.scrollBy(0, window.innerHeight * 2); return window.scrollY !== before })()"

/**
 * Drives the Chromium at the path given, or the one Playwright installed.
 *
 * **Details**
 *
 * Every window is a persistent context over the directory it is given, so
 * cookies and local storage written while a window is open are there the
 * next time the same directory is opened.
 *
 * **Example** (Drive the system Chromium)
 *
 * ```ts import.meta.vitest name="Drive the system Chromium"
 * import { layerWith } from "@beep/scratchpad/int/browser.playwright"
 * import * as O from "effect/Option"
 *
 * const browser = layerWith(O.some("/usr/bin/chromium"))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerWith = (executable: O.Option<string>): Layer.Layer<Browser> =>
  Layer.succeed(Browser, {
      open: Effect.fn("Browser.open")(function* ({ directory, visible }: { readonly directory: string; readonly visible: boolean }) {
        const context = yield* Effect.acquireRelease(
          attempt(() =>
            chromium.launchPersistentContext(directory, {
              headless: !visible,
              ...O.match(executable, { onNone: () => ({}), onSome: (executablePath) => ({ executablePath }) })
            })
          ),
          (opened) => Effect.ignore(attempt(() => opened.close()))
        )
        const page = yield* O.match(A.head(context.pages()), {
          onNone: () => attempt(() => context.newPage()),
          onSome: Effect.succeed
        })
        return {
          visit: (url: URL) =>
            Stream.callback<Exchange, BrowserFailed>((queue) =>
              Effect.gen(function* () {
                const heard = (response: Response) => {
                  O.map(exchange(response), (answer) => Queue.offerUnsafe(queue, answer))
                }
                yield* Effect.acquireRelease(
                  Effect.sync(() => page.on("response", heard)),
                  () => Effect.sync(() => page.off("response", heard))
                )
                yield* attempt(() => page.goto(url.href, { waitUntil: "domcontentloaded" }))
              })
            ),
          scroll: attempt(() => page.evaluate<boolean>(advance)),
          cookies: (origin: URL) =>
            attempt(() => context.cookies(origin.href)).pipe(
              Effect.map((cookies) => HashSet.fromIterable(A.map(cookies, ({ name }) => name)))
            ),
          closed: Effect.callback<void>((resume) => {
            context.once("close", () => resume(Effect.void))
          })
        }
      })
  })

/**
 * Drives the Chromium named by `INT_CHROMIUM`, or the one Playwright
 * installed when the variable is unset.
 *
 * **Example** (Provide the browser to a program)
 *
 * ```ts import.meta.vitest name="Provide the browser to a program"
 * import type { Browser } from "@beep/scratchpad/int/browser"
 * import { layer } from "@beep/scratchpad/int/browser.playwright"
 * import type * as Layer from "effect/Layer"
 *
 * const browser: Layer.Layer<Browser> = layer
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<Browser> = Layer.unwrap(
  Config.NonEmptyString("INT_CHROMIUM").pipe(Config.option, Effect.orDie, Effect.map(layerWith))
)
