/**
 * Typed failures for doctest fence discovery, parsing, classification, and validation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Docgen/Doctest.errors");

/**
 * Reports a failure to discover, parse, classify, or validate a doctest fence.
 *
 * **Example** (Describe an analysis failure)
 *
 * ```ts
 * import { DoctestAnalysisError } from "@beep/repo-cli/commands/Docgen"
 *
 * const error = DoctestAnalysisError.make({
 *   message: "The fence assertion is invalid.",
 *   file: "packages/example/src/index.ts",
 *   line: 12
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DoctestAnalysisError extends S.TaggedError<DoctestAnalysisError>($I`DoctestAnalysisError`)(
  "DoctestAnalysisError",
  {
    message: S.NonEmptyString,
    file: S.optionalKey(S.NonEmptyString),
    line: S.optionalKey(S.Natural),
  },
  $I.annoteError<DoctestAnalysisError>("DoctestAnalysisError", {
    description: "Fence discovery, parsing, or classification failed.",
  })
) {}

/**
 * Reports that a planned fence edit no longer applies to the analyzed source.
 *
 * **Example** (Describe a stale rewrite)
 *
 * ```ts
 * import { DoctestRewriteError } from "@beep/repo-cli/commands/Docgen"
 *
 * const error = DoctestRewriteError.make({
 *   message: "The source changed after analysis.",
 *   file: "packages/example/src/index.ts",
 *   line: 12
 * })
 * console.log(error.file)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DoctestRewriteError extends S.TaggedError<DoctestRewriteError>($I`DoctestRewriteError`)(
  "DoctestRewriteError",
  {
    message: S.NonEmptyString,
    file: S.NonEmptyString,
    line: S.optionalKey(S.Natural),
  },
  $I.annoteError<DoctestRewriteError>("DoctestRewriteError", {
    description: "A planned rewrite could not be applied to the exact analyzed source.",
  })
) {}
