/**
 * The Chromium that backs `Browser`, driven through Playwright.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { chromium } from "playwright";
import { Browser, BrowserFailed } from "./browser.ts";
import type { Response } from "playwright";
import type { Exchange, Placement } from "./browser.ts";

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, BrowserFailed> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => BrowserFailed.make({ detail: P.isError(cause) ? cause.message : "the browser gave no reason" }),
  });

const seconds = S.decodeUnknownOption(S.FiniteFromString);

const exchange = (response: Response): O.Option<Exchange> => {
  const headers = response.headers();
  return R.get(headers, "content-type").pipe(
    O.filter(Str.includes("json")),
    O.map(() => ({
      url: new URL(response.url()),
      status: response.status(),
      retryAfter: R.get(headers, "retry-after").pipe(O.flatMap(seconds), O.map(Duration.seconds)),
      body: attempt(() => response.json()),
    }))
  );
};

const advance =
  "(() => { const before = window.scrollY; window.scrollBy(0, window.innerHeight * 2); return window.scrollY !== before })()";

const drawn = (wayland: boolean) => ({
  screen: { headless: false, viewport: null, args: wayland ? ["--ozone-platform=wayland"] : [] },
  offscreen: {
    headless: false,
    viewport: null,
    args: ["--ozone-platform=x11", "--window-position=0,0", "--window-size=1600,1000"],
  },
  headless: { headless: true, args: [] },
});

/**
 * Drives the Chromium at the path given, or the one Playwright installed.
 *
 * **Details**
 *
 * Every window is a persistent context over the directory it is given, so
 * cookies and local storage written while a window is open are there the
 * next time the same directory is opened. An `offscreen` window is drawn
 * on the X display of the process; `wayland` says the user's own screen is
 * a Wayland one, so a `screen` window is sent there and not to that display.
 *
 * **Example** (Drive the system Chromium)
 *
 * ```ts import.meta.vitest name="Drive the system Chromium"
 * import { layerWith } from "@/core/browser.playwright"
 * import * as O from "effect/Option"
 *
 * const browser = layerWith({ executable: O.some("/usr/bin/chromium") })
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerWith = ({
  executable,
  wayland = false,
}: {
  readonly executable: O.Option<string>;
  readonly wayland?: boolean;
}): Layer.Layer<Browser> =>
  Layer.succeed(Browser, {
    open: Effect.fn("Browser.open")(function* ({
      directory,
      window,
    }: {
      readonly directory: string;
      readonly window: Placement;
    }) {
      const context = yield* Effect.acquireRelease(
        attempt(() =>
          chromium.launchPersistentContext(directory, {
            ...drawn(wayland)[window],
            chromiumSandbox: true,
            ...R.getSomes({ executablePath: executable }),
          })
        ),
        (opened) => Effect.ignore(attempt(() => opened.close()))
      );
      const page = yield* O.match(A.head(context.pages()), {
        onNone: () => attempt(() => context.newPage()),
        onSome: Effect.succeed,
      });
      const gone = yield* Deferred.make<void>();
      const leave = () => {
        Deferred.doneUnsafe(gone, Effect.void);
      };
      context.once("close", leave);
      page.once("close", leave);
      return {
        visit: (url: URL) =>
          Stream.callback<Exchange, BrowserFailed>(
            Effect.fnUntraced(function* (queue) {
              const heard = (response: Response) => {
                O.map(exchange(response), (answer) => Queue.offerUnsafe(queue, answer));
              };
              yield* Effect.acquireRelease(
                Effect.sync(() => page.on("response", heard)),
                () => Effect.sync(() => page.off("response", heard))
              );
              yield* attempt(() => page.goto(url.href, { waitUntil: "domcontentloaded" }));
            })
          ),
        scroll: attempt(() => page.evaluate<boolean>(advance)),
        cookies: (origin: URL) =>
          attempt(() => context.cookies(origin.href)).pipe(
            Effect.map((cookies) => HashSet.fromIterable(A.map(cookies, ({ name }) => name)))
          ),
        closed: Deferred.await(gone),
      };
    }),
  });

/**
 * Drives the Chromium named by `SOCIAL_MAPPER_CHROMIUM`, or the one Playwright
 * installed when the variable is unset. A set `WAYLAND_DISPLAY` sends the
 * windows the user must see to that screen.
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
  Config.all({
    executable: Config.option(Config.NonEmptyString("SOCIAL_MAPPER_CHROMIUM")),
    wayland: Config.option(Config.NonEmptyString("WAYLAND_DISPLAY")),
  }).pipe(
    Effect.orDie,
    Effect.map(({ executable, wayland }) => layerWith({ executable, wayland: O.isSome(wayland) }))
  )
);
