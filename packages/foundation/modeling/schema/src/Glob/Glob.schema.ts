/**
 * Branded schema for portable glob pattern strings accepted by Bun's current
 * glob parser.
 *
 * **Details**
 *
 * This schema keeps Bun's parser acceptance rules while enforcing the repo's
 * forward-slash convention for portable patterns.
 *
 * **Example** (Decode portable glob pattern)
 *
 * ```typescript
 * import * as S from "effect/Schema";
 * import { Glob } from "@beep/schema/Glob";
 *
 * const pattern = S.decodeUnknownSync(Glob)("src/*.ts");
 * console.log(pattern);
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Str, thunkFalse } from "@beep/utils";
import { Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Glob");
const MAX_GLOB_PATTERN_LENGTH = 1024 * 64;
const GlobArbitraryValues = [
  "src/**/*.ts",
  "{src,test}/**/*.ts",
  "foo/bar",
  "foo/[abc]",
  "foo/{bar,baz}",
  "!index.ts",
] as const;
type BunGlobConstructor = new (pattern: string) => object;

const isBunGlobConstructor = (input: unknown): input is BunGlobConstructor => P.isFunction(input);

const getBunGlobConstructor = (): O.Option<BunGlobConstructor> => {
  const bunRuntime = Reflect.get(globalThis, "Bun");
  const bunGlob = P.isObject(bunRuntime) ? Reflect.get(bunRuntime, "Glob") : undefined;
  return isBunGlobConstructor(bunGlob) ? O.some(bunGlob) : O.none();
};

const canConstructMatcher = (value: string): boolean =>
  O.match(getBunGlobConstructor(), {
    onNone: thunkFalse,
    onSome: (BunGlob) =>
      Result.isSuccess(
        Result.try({
          try: () => new BunGlob(value),
          catch: thunkFalse,
        })
      ),
  });

const GlobChecks = S.makeFilterGroup(
  [
    S.isNonEmpty({
      identifier: $I`GlobNonEmptyCheck`,
      title: "Glob Non Empty",
      description: "A glob pattern string that is not empty.",
      message: "Glob pattern must not be empty",
    }),
    S.makeFilter(P.not(Str.includes("\\")), {
      identifier: $I`GlobPortableSeparatorCheck`,
      title: "Glob Portable Separator",
      description: "A glob pattern string that uses forward slashes instead of backslashes.",
      message: "Glob pattern must use forward slashes instead of backslashes",
    }),
    S.isMaxLength(MAX_GLOB_PATTERN_LENGTH, {
      identifier: $I`GlobMaxLengthCheck`,
      title: "Glob Max Length",
      description: "A glob pattern string that does not exceed the repo's current portability limit.",
      message: `Glob pattern must not exceed ${MAX_GLOB_PATTERN_LENGTH} characters`,
    }),
    S.makeFilter(canConstructMatcher, {
      identifier: $I`GlobMatcherCompatibilityCheck`,
      title: "Glob Matcher Compatibility",
      description: "A glob pattern string accepted by the current Bun glob constructor.",
      message: "Glob pattern must be accepted by the current Bun glob parser",
    }),
  ],
  {
    identifier: $I`GlobChecks`,
    title: "Glob",
    description: "Checks for portable glob pattern strings accepted by the current Bun glob parser.",
  }
);

/**
 * Branded schema for portable non-empty glob pattern strings.
 *
 * **Details**
 *
 * The runtime validation mirrors the current Bun parser acceptance rules while
 * rejecting backslash separators so patterns remain portable across
 * environments and keeping the repo's defensive max-length limit.
 *
 * **Example** (Decode non-empty glob)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Glob } from "@beep/schema/Glob"
 *
 * const pattern = S.decodeUnknownSync(Glob)("src/*.ts")
 * console.log(pattern)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Glob = S.String.check(GlobChecks)
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom(...GlobArbitraryValues),
  })
  .pipe(
    S.brand("Glob"),
    $I.annoteSchema("Glob", {
      description: "A portable non-empty glob pattern string accepted by the current Bun glob parser.",
    })
  );

/**
 * Type for {@link Glob}.
 *
 * **Example** (Annotate decoded Glob type)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Glob } from "@beep/schema/Glob"
 *
 * const pattern: Glob = S.decodeUnknownSync(Glob)("src/*.ts")
 * console.log(pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Glob = typeof Glob.Type;

/**
 * Primary glob schema role alias.
 *
 * **Example** (Decode with Schema alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Schema } from "@beep/schema/Glob"
 *
 * const pattern = S.decodeUnknownSync(Schema)("src/*.ts")
 * console.log(pattern)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Schema = Glob;

/**
 * Runtime type extracted from {@link Schema}.
 *
 * **Example** (Type extracted Schema value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Schema as GlobValue } from "@beep/schema/Glob"
 * import { Schema as GlobSchema } from "@beep/schema/Glob"
 *
 * const pattern: GlobValue = S.decodeUnknownSync(GlobSchema)("src/*.ts")
 * console.log(pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema = Glob;
