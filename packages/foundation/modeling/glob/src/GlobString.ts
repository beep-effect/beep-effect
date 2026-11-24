/**
 * GlobString: the branded, validated form of a portable glob pattern string,
 * for config and contract schemas that carry patterns as plain data.
 *
 * **Details**
 *
 * A value is a non-empty string with forward-slash separators, at most 64 KiB
 * long, that {@link GlobPattern.compileResult} compiles under default
 * options. Compilation is pure, so the check runs the same under Node, Bun
 * and the browser.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GlobId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GlobPattern } from "./GlobPattern.ts";
import { MAX_PATTERN_LENGTH } from "./internal/limits.ts";

const $I = $GlobId.create("GlobString");

const compilesUnderDefaults = (value: string): boolean => Result.isSuccess(GlobPattern.compileResult(value));

const GlobStringChecks = S.makeFilterGroup(
  [
    S.isNonEmpty(
      $I.annote("GlobStringNonEmptyCheck", {
        title: "Glob String Non Empty",
        description: "A glob pattern string that is not empty.",
        message: "Glob pattern must not be empty",
      })
    ),
    S.makeFilter(
      P.not(Str.includes("\\")),
      $I.annote("GlobStringPortableSeparatorCheck", {
        title: "Glob String Portable Separator",
        description: "A glob pattern string that uses forward slashes instead of backslashes.",
        message: "Glob pattern must use forward slashes instead of backslashes",
      })
    ),
    S.isMaxLength(
      MAX_PATTERN_LENGTH,
      $I.annote("GlobStringMaxLengthCheck", {
        title: "Glob String Max Length",
        description: "A glob pattern string no longer than the matcher's pattern length cap.",
        message: `Glob pattern must not exceed ${MAX_PATTERN_LENGTH} characters`,
      })
    ),
    S.makeFilter(
      compilesUnderDefaults,
      $I.annote("GlobStringCompilesCheck", {
        title: "Glob String Compiles",
        description: "A glob pattern string that compiles under default options within the expansion and nesting caps.",
        message: "Glob pattern must compile within the expansion and nesting caps",
      })
    ),
  ],
  $I.annote("GlobStringChecks", {
    title: "Glob String",
    description: "Checks for portable glob pattern strings that compile under default options.",
  })
);

/**
 * Branded schema for portable, compilable glob pattern strings. Use it where
 * a pattern travels as plain data (a manifest field, a contract record) and
 * is compiled later; reach for `GlobPattern.FromString` when the decoded
 * value should be the compiled matcher itself.
 *
 * **Details**
 *
 * The checks run in order: non-empty, no backslash, at most 64 KiB, then a
 * {@link GlobPattern.compileResult} success under default options, which
 * rejects brace-expansion budget and nesting-depth overruns. `GlobString.make`
 * runs the same checks and throws on failure, so literal construction is a
 * wiring assertion.
 *
 * **Example** (Decode and construct glob strings)
 *
 * ```ts
 * import { GlobString } from "@beep/glob/GlobString";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(GlobString)("src/**");
 * const made = GlobString.make(".changeset/*.md");
 * console.log(decoded, made) // src/** .changeset/*.md
 * console.log(S.is(GlobString)("src\\*.ts")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GlobString = S.String.check(GlobStringChecks).pipe(
  S.brand("GlobString"),
  $I.annoteSchema("GlobString", {
    description: "A portable non-empty glob pattern string that compiles under default options.",
  })
);

/**
 * **Example** (Annotate a decoded glob string)
 *
 * ```ts
 * import { GlobString } from "@beep/glob/GlobString";
 *
 * const pattern: GlobString = GlobString.make("packages/*");
 * console.log(pattern) // packages/*
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GlobString = typeof GlobString.Type;
