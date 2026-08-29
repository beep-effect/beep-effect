/**
 * Typed errors raised by the ONNX face detection driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FaceDetectionId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { P } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $FaceDetectionId.create("FaceDetection.errors");
const FaceDetectionDefect = Defect({ includeStack: true });

type FaceDetectionErrorContextInput = {
  readonly cause?: unknown;
  readonly imagePath?: string;
  readonly modelPath?: string;
};

const isFaceDetectionDefect = S.is(FaceDetectionDefect);

const causeFromUnknown = (cause: unknown): O.Option<unknown> =>
  P.hasInspectableObjectShape(cause) && isFaceDetectionDefect(cause) ? O.some(cause) : O.none();

const optionsFromInput = (options: FaceDetectionErrorContextInput): FaceDetectionErrorFromUnknownOptions =>
  FaceDetectionErrorFromUnknownOptions.make({
    cause: causeFromUnknown(options.cause),
    imagePath: O.fromUndefinedOr(options.imagePath),
    modelPath: O.fromUndefinedOr(options.modelPath),
  });

const causeMessage = (cause: unknown): O.Option<string> =>
  cause instanceof Error && cause.message.length > 0 ? O.some(cause.message) : O.none();

const existingFaceDetectionError = (cause: unknown): O.Option<FaceDetectionError> =>
  FaceDetectionError.is(cause) ? O.some(cause) : O.none();

const messageWithCause = (message: string, cause: unknown): string =>
  pipe(
    causeMessage(cause),
    O.map((detail) => `${message}: ${detail}`),
    O.getOrElse(() => message)
  );

/**
 * Driver operation names surfaced in {@link FaceDetectionError} diagnostics.
 *
 * **Example** (Log detect operation enum)
 *
 * ```ts
 * import { FaceDetectionOperation } from "@beep/face-detection"
 *
 * console.log(FaceDetectionOperation.Enum.detect)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const FaceDetectionOperation = LiteralKit([
  "detect",
  "loadModel",
  "loadOnnxRuntime",
  "loadSession",
  "postprocess",
  "preprocessImage",
  "withDetector",
]).pipe(
  $I.annoteSchema("FaceDetectionOperation", {
    description: "Face-detection driver operation names used in technical error diagnostics.",
  })
);

/**
 * Runtime TypeScript type produced by the {@link FaceDetectionOperation} schema.
 *
 * **Example** (Type a detect operation)
 *
 * ```ts
 * import type { FaceDetectionOperation } from "@beep/face-detection"
 *
 * const operation: FaceDetectionOperation = "detect"
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type FaceDetectionOperation = typeof FaceDetectionOperation.Type;

const FaceDetectionErrorLeadingContextFields = {
  cause: S.OptionFromOptionalKey(FaceDetectionDefect).pipe(SchemaUtils.withNoneDefault).annotateKey({
    description: "Inspectable originating defect, when available.",
  }),
  imagePath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
    description: "Image path active when the failure occurred.",
  }),
} satisfies S.Struct.Fields;
const FaceDetectionErrorTrailingContextFields = {
  modelPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
    description: "Model path active when the failure occurred.",
  }),
} satisfies S.Struct.Fields;

/**
 * Options used when normalizing unknown face detection boundary failures.
 *
 * **Example** (Make options with model path)
 *
 * ```ts
 * import { FaceDetectionErrorFromUnknownOptions } from "@beep/face-detection"
 * import * as O from "effect/Option"
 *
 * const options = FaceDetectionErrorFromUnknownOptions.make({ modelPath: O.some("./yunet.onnx") })
 * console.log(options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FaceDetectionErrorFromUnknownOptions extends S.Class<FaceDetectionErrorFromUnknownOptions>(
  $I`FaceDetectionErrorFromUnknownOptions`
)(
  {
    ...FaceDetectionErrorLeadingContextFields,
    ...FaceDetectionErrorTrailingContextFields,
  },
  $I.annote("FaceDetectionErrorFromUnknownOptions", {
    description: "Options used when normalizing unknown face detection failures.",
  })
) {}

/**
 * Technical failure raised by the `@beep/face-detection` driver boundary.
 *
 * **Details**
 *
 * This error is reserved for driver concerns such as ONNX Runtime loading,
 * model session creation, image preprocessing, request decoding, and
 * post-processing tensor validation. Product-level "no face found" decisions
 * should be modeled outside this driver.
 *
 * **Example** (Create FaceDetectionError instance)
 *
 * ```ts
 * import { FaceDetectionError } from "@beep/face-detection"
 *
 * const error = FaceDetectionError.make({ message: "model failed", operation: "loadModel" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FaceDetectionError extends S.TaggedError<FaceDetectionError>($I`FaceDetectionError`)(
  "FaceDetectionError",
  {
    ...FaceDetectionErrorLeadingContextFields,
    message: S.String.annotateKey({
      description: "Human-readable face-detection failure summary.",
    }),
    ...FaceDetectionErrorTrailingContextFields,
    operation: FaceDetectionOperation.annotateKey({
      description: "Face-detection driver operation that failed.",
    }),
  },
  $I.annoteError<FaceDetectionError>("FaceDetectionError", {
    description: "Technical ONNX face detection driver failure scoped to a driver operation.",
  })
) {
  static readonly is = S.is(FaceDetectionError);

  /**
   * Normalize an unknown model, platform, or image failure into a {@link FaceDetectionError}.
   *
   * **Example** (Normalize unknown load failure)
   *
   * ```ts
   * import { FaceDetectionError } from "@beep/face-detection"
   *
   * const error = FaceDetectionError.fromUnknown("loadModel", "failed", {
   *   cause: new Error("missing file"),
   *   modelPath: "./yunet.onnx"
   * })
   * console.log(error.message)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: FaceDetectionOperation, message: string, options?: FaceDetectionErrorContextInput): FaceDetectionError;
    (
      message: string,
      options?: FaceDetectionErrorContextInput
    ): (operation: FaceDetectionOperation) => FaceDetectionError;
  } = dual(
    3,
    (
      operation: FaceDetectionOperation,
      message: string,
      options: FaceDetectionErrorContextInput = {}
    ): FaceDetectionError => {
      const context = optionsFromInput(options);
      return O.getOrElse(existingFaceDetectionError(options.cause), () =>
        FaceDetectionError.make({
          cause: context.cause,
          imagePath: context.imagePath,
          message: messageWithCause(message, options.cause),
          modelPath: context.modelPath,
          operation,
        })
      );
    }
  );
}
