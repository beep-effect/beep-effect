/**
 * Package-private browser HTTP URL resolution.
 *
 * @packageDocumentation
 * @category internal
 * @since 0.0.0
 */

import { O, pipe, Str } from "@beep/utils";
import { Result } from "effect";
import { dual } from "effect/Function";

type BrowserHttpRuntime = Readonly<{
  location: Readonly<{
    origin: string;
  }>;
}>;

interface ResolveBrowserHttpUrl {
  (runtime: BrowserHttpRuntime | undefined, path: `/${string}`): O.Option<string>;
  (path: `/${string}`): (runtime: BrowserHttpRuntime | undefined) => O.Option<string>;
}

/**
 * Resolve a root-relative path against an HTTP(S) browser origin.
 *
 * Missing runtimes, non-HTTP origins, and malformed origins resolve to
 * {@link O.none} so callers retain ownership of their fallback policy.
 *
 * @category internal
 * @since 0.0.0
 */
export const resolveBrowserHttpUrl: ResolveBrowserHttpUrl = dual(
  2,
  (runtime, path): O.Option<string> =>
    pipe(
      O.fromUndefinedOr(runtime),
      O.map((current) => current.location.origin),
      O.filter((origin) => Str.startsWith(origin, "http://") || Str.startsWith(origin, "https://")),
      O.flatMap((origin) =>
        pipe(
          Result.try(() => new URL(path, origin).href),
          Result.getSuccess
        )
      )
    )
);
