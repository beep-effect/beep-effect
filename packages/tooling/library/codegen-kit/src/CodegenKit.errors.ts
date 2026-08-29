/**
 * Typed failures for the shared code-generation pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CodegenKitId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { DriftReport } from "./CodegenKit.models.ts";

const $I = $CodegenKitId.create("CodegenKit.errors");
const FailureFields = {
  message: S.String,
  cause: S.Defect({ includeStack: true }),
};

/**
 * Reading or refreshing a pinned source document failed.
 *
 * **Example** (Create a source failure)
 *
 * ```ts
 * import { CodegenFetchError } from "@beep/codegen-kit"
 *
 * const error = CodegenFetchError.make({ message: "cache missing", cause: new Error("missing") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenFetchError extends S.TaggedError<CodegenFetchError>($I`CodegenFetchError`)(
  "CodegenFetchError",
  FailureFields,
  $I.annoteError<CodegenFetchError>("CodegenFetchError", {
    description: "Reading or refreshing a pinned source document failed.",
  })
) {}

/**
 * Applying configured JSON Patch documents failed.
 *
 * **Example** (Create a patch failure)
 *
 * ```ts
 * import { CodegenPatchError } from "@beep/codegen-kit"
 *
 * const error = CodegenPatchError.make({ message: "patch failed", cause: new Error("invalid pointer") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenPatchError extends S.TaggedError<CodegenPatchError>($I`CodegenPatchError`)(
  "CodegenPatchError",
  FailureFields,
  $I.annoteError<CodegenPatchError>("CodegenPatchError", {
    description: "Applying configured JSON Patch documents failed.",
  })
) {}

/**
 * The upstream generator could not emit TypeScript from the document.
 *
 * **Example** (Create a generation failure)
 *
 * ```ts
 * import { CodegenGenerateError } from "@beep/codegen-kit"
 *
 * const error = CodegenGenerateError.make({ message: "generation failed", cause: new Error("bad schema") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenGenerateError extends S.TaggedError<CodegenGenerateError>($I`CodegenGenerateError`)(
  "CodegenGenerateError",
  FailureFields,
  $I.annoteError<CodegenGenerateError>("CodegenGenerateError", {
    description: "The upstream generator could not emit TypeScript from the document.",
  })
) {}

/**
 * Generated TypeScript did not match the post-processor contract.
 *
 * **Example** (Create a post-processing failure)
 *
 * ```ts
 * import { CodegenPostProcessError } from "@beep/codegen-kit"
 *
 * const error = CodegenPostProcessError.make({ message: "malformed output", cause: new Error("parse") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenPostProcessError extends S.TaggedError<CodegenPostProcessError>($I`CodegenPostProcessError`)(
  "CodegenPostProcessError",
  FailureFields,
  $I.annoteError<CodegenPostProcessError>("CodegenPostProcessError", {
    description: "Generated TypeScript did not match the post-processor contract.",
  })
) {}

/**
 * The pinned Biome formatter failed for a generated artifact.
 *
 * **Example** (Create a formatting failure)
 *
 * ```ts
 * import { CodegenFormatError } from "@beep/codegen-kit"
 *
 * const error = CodegenFormatError.make({ message: "biome failed", cause: new Error("exit 1") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenFormatError extends S.TaggedError<CodegenFormatError>($I`CodegenFormatError`)(
  "CodegenFormatError",
  FailureFields,
  $I.annoteError<CodegenFormatError>("CodegenFormatError", {
    description: "The pinned Biome formatter failed for a generated artifact.",
  })
) {}

/**
 * Check mode found generated output that is absent or out of date.
 *
 * **Example** (Create a drift failure)
 *
 * ```ts
 * import { CodegenDriftError } from "@beep/codegen-kit"
 *
 * const error = CodegenDriftError.make({
 *   message: "generated output drifted",
 *   reports: [{ path: "schema.gen.ts", status: "changed", diffLines: 2 }]
 * })
 * console.log(error.reports[0]?.status)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenDriftError extends S.TaggedError<CodegenDriftError>($I`CodegenDriftError`)(
  "CodegenDriftError",
  {
    message: S.String,
    reports: S.Array(DriftReport),
  },
  $I.annoteError<CodegenDriftError>("CodegenDriftError", {
    description: "Check mode found generated output that is absent or out of date.",
  })
) {}
