/**
 * Typed failures for the shared code-generation pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CodegenKitId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { DriftReport, NamedTransform } from "./CodegenKit.models.ts";

const $I = $CodegenKitId.create("CodegenKit.errors");
const FailureFields = {
  message: S.String,
  cause: S.Defect({ includeStack: true }),
};

/**
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
export class CodegenFetchError extends S.TaggedError<CodegenFetchError, { readonly brand: unique symbol }>(
  $I`CodegenFetchError`
)(
  "CodegenFetchError",
  FailureFields,
  $I.annoteError<CodegenFetchError>("CodegenFetchError", {
    description: "Reading or refreshing a pinned source document failed.",
  })
) {}

/**
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
export class CodegenPatchError extends S.TaggedError<CodegenPatchError, { readonly brand: unique symbol }>(
  $I`CodegenPatchError`
)(
  "CodegenPatchError",
  FailureFields,
  $I.annoteError<CodegenPatchError>("CodegenPatchError", {
    description: "Applying configured JSON Patch documents failed.",
  })
) {}

/**
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
export class CodegenGenerateError extends S.TaggedError<CodegenGenerateError, { readonly brand: unique symbol }>(
  $I`CodegenGenerateError`
)(
  "CodegenGenerateError",
  FailureFields,
  $I.annoteError<CodegenGenerateError>("CodegenGenerateError", {
    description: "The upstream generator could not emit TypeScript from the document.",
  })
) {}

/**
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
export class CodegenPostProcessError extends S.TaggedError<CodegenPostProcessError, { readonly brand: unique symbol }>(
  $I`CodegenPostProcessError`
)(
  "CodegenPostProcessError",
  FailureFields,
  $I.annoteError<CodegenPostProcessError>("CodegenPostProcessError", {
    description: "Generated TypeScript did not match the post-processor contract.",
  })
) {}

/**
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
export class CodegenFormatError extends S.TaggedError<CodegenFormatError, { readonly brand: unique symbol }>(
  $I`CodegenFormatError`
)(
  "CodegenFormatError",
  FailureFields,
  $I.annoteError<CodegenFormatError>("CodegenFormatError", {
    description: "The pinned Biome formatter failed for a generated artifact.",
  })
) {}

/**
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
export class CodegenDriftError extends S.TaggedError<CodegenDriftError, { readonly brand: unique symbol }>(
  $I`CodegenDriftError`
)(
  "CodegenDriftError",
  {
    message: S.String,
    reports: S.Array(DriftReport),
  },
  $I.annoteError<CodegenDriftError>("CodegenDriftError", {
    description: "Check mode found generated output that is absent or out of date.",
  })
) {}

/**
 * **Details**
 *
 * Transforms run inside the generator's `onEnter` hook, so the generator wraps this failure as the
 * `cause` of a {@link CodegenGenerateError}.
 *
 * **Example** (Create a transform failure)
 *
 * ```ts
 * import { CodegenTransformError } from "@beep/codegen-kit"
 *
 * const error = CodegenTransformError.make({
 *   transform: "notDiscriminatorPattern",
 *   message: "Unsupported not shape: expected not.anyOf"
 * })
 * console.log(error.transform)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodegenTransformError extends S.TaggedError<CodegenTransformError, { readonly brand: unique symbol }>(
  $I`CodegenTransformError`
)(
  "CodegenTransformError",
  {
    transform: NamedTransform,
    message: S.String,
  },
  $I.annoteError<CodegenTransformError>("CodegenTransformError", {
    description: "A registered JSON Schema transform met a schema shape it cannot rewrite faithfully.",
  })
) {}
