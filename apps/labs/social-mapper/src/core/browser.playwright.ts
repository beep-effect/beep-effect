/**
 * The Chromium that backs `Browser`, driven through Playwright.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { chromium, Playwright } from "@beep/playwright";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { Browser, BrowserFailed } from "./browser.ts";
import type { ResponseShape } from "@beep/playwright/Common";
import type { PlaywrightError } from "@beep/playwright/PlaywrightError";
import type { Exchange } from "./browser.ts";

const failed = ({ cause }: PlaywrightError): BrowserFailed =>
  BrowserFailed.make({ detail: P.isError(cause) ? cause.message : "the browser gave no reason" });

const seconds = S.decodeUnknownOption(S.FiniteFromString);

const exchange = (response: ResponseShape): O.Option<Exchange> => {
  const headers = response.headers();
  return R.get(headers, "content-type").pipe(
    O.filter(Str.includes("json")),
    O.map(() => ({
      url: new URL(response.url()),
      status: response.status(),
      retryAfter: R.get(headers, "retry-after").pipe(O.flatMap(seconds), O.map(Duration.seconds)),
      body: Effect.mapError(response.json, failed),
    }))
  );
};

const advance =
  "(() => { const before = window.scrollY; window.scrollBy(0, window.innerHeight * 2); return window.scrollY !== before })()";

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
 * import { layerWith } from "@/core/browser.playwright"
 * import * as O from "effect/Option"
 *
 * const browser = layerWith(O.some("/usr/bin/chromium"))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerWith = (executable: O.Option<string>): Layer.Layer<Browser> =>
  Layer.effect(
    Browser,
    Effect.gen(function* () {
      const playwright = yield* Playwright;
      return {
        open: Effect.fn("Browser.open")(function* ({
          directory,
          visible,
        }: {
          readonly directory: string;
          readonly visible: boolean;
        }) {
          const context = yield* playwright
            .launchPersistentContextScoped(chromium, directory, {
              headless: !visible,
              ...R.getSomes({ executablePath: executable }),
            })
            .pipe(Effect.mapError(failed));
          const page = yield* O.match(A.head(context.pages()), {
            onNone: () => Effect.mapError(context.newPage, failed),
            onSome: Effect.succeed,
          });
          return {
            visit: (url: URL) =>
              page.eventStream("response").pipe(
                Stream.filterMap((response) => Result.fromOption(exchange(response), constVoid)),
                Stream.merge(
                  page
                    .goto(url.href, { waitUntil: "domcontentloaded" })
                    .pipe(Effect.mapError(failed), Stream.fromEffect, Stream.drain)
                )
              ),
            scroll: Effect.mapError(page.evaluate<boolean>(advance), failed),
            cookies: (origin: URL) =>
              context.cookies(origin.href).pipe(
                Effect.mapBoth({
                  onFailure: failed,
                  onSuccess: (cookies) => HashSet.fromIterable(A.map(cookies, ({ name }) => name)),
                })
              ),
            closed: context.eventStream("close").pipe(Stream.take(1), Stream.runDrain),
          };
        }),
      };
    })
  ).pipe(Layer.provide(Playwright.layer));

/**
 * Drives the Chromium named by `SOCIAL_MAPPER_CHROMIUM`, or the one Playwright
 * installed when the variable is unset.
 *
 * **Example** (Provide the browser to a program)
 *
 * ```ts import.meta.vitest name="Provide the browser to a program"
 * import type { Browser } from "@/core/browser"
 * import { layer } from "@/core/browser.playwright"
 * import type * as Layer from "effect/Layer"
 *
 * const browser: Layer.Layer<Browser> = layer
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<Browser> = Layer.unwrap(
  Config.NonEmptyString("SOCIAL_MAPPER_CHROMIUM").pipe(Config.option, Effect.orDie, Effect.map(layerWith))
);
