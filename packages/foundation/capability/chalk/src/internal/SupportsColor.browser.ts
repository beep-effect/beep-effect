/**
 * Browser color support detection for Chalk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ChalkId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { flow, Number as N, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ColorSupport } from "./ChalkSchema.ts";
import type { ColorInfo } from "./ChalkSchema.ts";

const $I = $ChalkId.create("Domain");

class BrowserBrandModel extends S.Class<BrowserBrandModel>($I`BrowserBrand`)(
  {
    brand: S.String,
    version: S.String,
  },
  $I.annote("BrowserBrand", {
    description: "Browser brand/version metadata used by Chalk browser color support detection.",
  })
) {}

type BrowserBrand = typeof BrowserBrandModel.Encoded;

type BrowserNavigator = Navigator & {
  readonly userAgentData?: {
    readonly brands: ReadonlyArray<BrowserBrand>;
  };
};

const hasUserAgentData = (browserNavigator: Navigator): browserNavigator is BrowserNavigator =>
  P.hasProperty(browserNavigator, "userAgentData");

const getBrowserNavigator = (): O.Option<Navigator> => pipe(globalThis.navigator, O.fromNullishOr);

const trueColorBrowserSupport = ColorSupport.make({
  has16m: true,
  has256: true,
  hasBasic: true,
  level: 3,
});

const basicBrowserSupport = ColorSupport.make({
  has16m: false,
  has256: false,
  hasBasic: true,
  level: 1,
});

const disabledBrowserSupport = false as const;

const chromeUserAgentPattern = /\b(Chrome|Chromium)\//;

const findChromiumBrand: (browserNavigator: Navigator) => O.Option<BrowserBrand> = flow(
  O.liftPredicate(hasUserAgentData),
  O.flatMap((navigatorWithUserAgentData) =>
    pipe(
      navigatorWithUserAgentData.userAgentData?.brands,
      O.fromNullishOr,
      O.flatMap(A.findFirst(({ brand }) => brand === "Chromium"))
    )
  )
);

const isSupportedChromiumBrand = (browserBrand: BrowserBrand): boolean =>
  pipe(browserBrand.version, N.parse, O.exists(N.isGreaterThan(93)));

const detectTrueColorBrowserSupport = (browserNavigator: Navigator): O.Option<ColorSupport> =>
  pipe(findChromiumBrand(browserNavigator), O.filter(isSupportedChromiumBrand), O.as(trueColorBrowserSupport));

const detectBasicBrowserSupport = (browserNavigator: Navigator): O.Option<ColorSupport> =>
  pipe(browserNavigator.userAgent, Str.match(chromeUserAgentPattern), O.as(basicBrowserSupport));

const browserColorSupportFromNavigator = (browserNavigator: Navigator): ColorInfo =>
  pipe(
    [detectTrueColorBrowserSupport(browserNavigator), detectBasicBrowserSupport(browserNavigator)],
    O.firstSomeOf,
    O.getOrElse(() => disabledBrowserSupport)
  );

const browserColorSupport: () => ColorInfo = flow(
  getBrowserNavigator,
  O.map(browserColorSupportFromNavigator),
  O.getOrElse(() => disabledBrowserSupport)
);

/**
 * Color support detected for browser stdout and stderr compatibility channels.
 *
 * **Example** (Logging browser stdout support)
 *
 * ```ts
 * import { detectedSupportsColorBrowser } from "./SupportsColor.browser.ts"
 *
 * console.log(detectedSupportsColorBrowser.stdout)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const detectedSupportsColorBrowser = {
  stderr: browserColorSupport(),
  stdout: browserColorSupport(),
};
