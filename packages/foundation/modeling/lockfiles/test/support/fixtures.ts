import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

const FIXTURE_ROOT = "../fixtures/";
const FIXTURE_SUFFIX = ".fixture";

const viteInlinedFixtureText = import.meta.glob<string>("../fixtures/**/*.fixture", {
  query: "?raw",
  import: "default",
  eager: true,
});

const logicalPathOf = (globKey: string): string =>
  Str.slice(FIXTURE_ROOT.length, globKey.length - FIXTURE_SUFFIX.length)(globKey);

/**
 * Every stored capture, keyed by its logical (original) filename relative to
 * the fixtures directory: the `.fixture` suffix that keeps package managers
 * from treating it as a live lockfile is not part of the key.
 *
 * **Example** (List the npm captures)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as R from "effect/Record"
 * import { corpus } from "./support/fixtures.ts"
 *
 * console.log(A.filter(R.keys(corpus), (path) => path.startsWith("npm/")).length > 0) // true
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const corpus: Readonly<Record<string, string>> = R.fromEntries(
  A.map(R.toEntries(viteInlinedFixtureText), ([key, text]) => [logicalPathOf(key), text] as const)
);

/**
 * Read an inert historical capture verbatim for the lockfile parser.
 *
 * **Example** (Read a pnpm capture)
 *
 * ```ts
 * import { fixture } from "./support/fixtures.ts"
 *
 * const input = fixture("pnpm/v1/pnpm-lock.yaml")
 * console.log(input.includes("lockfileVersion")) // true
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const fixture = (relative: string): string =>
  O.getOrThrowWith(R.get(corpus, relative), () => new Error(`no stored fixture ${relative}${FIXTURE_SUFFIX}`));

/**
 * Logical lockfile filenames stored WITHOUT the inert suffix — always empty
 * when the corpus is healthy, since an un-suffixed capture is one a package
 * manager would treat as a live lockfile.
 *
 * **Example** (Check that no capture is installable)
 *
 * ```ts
 * import { unsuffixedCaptures } from "./support/fixtures.ts"
 *
 * console.log(unsuffixedCaptures.length) // 0
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const unsuffixedCaptures: ReadonlyArray<string> = R.keys(
  import.meta.glob<string>("../fixtures/**/{bun.lock,package-lock.json,pnpm-lock.yaml,yarn.lock}", {
    query: "?raw",
    import: "default",
    eager: true,
  })
);
