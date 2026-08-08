/**
 * Translation from technical Tika driver failures to file-processing
 * operation errors.
 *
 * Every Tika engine funnels its failures through this module so no HTTP,
 * process, filesystem, or Tika error escapes the operation contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { NonNegativeInt } from "@beep/schema";
import { O } from "@beep/utils";
import { Match, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { TIKA_ENGINE_NAME } from "./Tika.config.ts";
import { TikaError } from "./Tika.errors.ts";
import type { ExtractFileOperation, FileProcessingOperationErrorReason } from "@beep/file-processing/Operation";

const isTikaError = S.is(TikaError);

const unsupportedMediaTypeStatus = NonNegativeInt.make(415);

const extractionFailedMessage = "Tika extraction failed inside the driver boundary.";

/**
 * Message reported when a live Tika runtime cannot be reached.
 *
 * @example
 * ```ts
 * import { TIKA_ENGINE_UNAVAILABLE_MESSAGE } from "@beep/tika"
 *
 * console.log(TIKA_ENGINE_UNAVAILABLE_MESSAGE) // "The Tika runtime is not available on this host."
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TIKA_ENGINE_UNAVAILABLE_MESSAGE = "The Tika runtime is not available on this host.";

/**
 * Message reported by the P1 scaffold engine when extraction is deferred.
 *
 * The scaffold predates the live engines and keeps its own wording so its
 * emitted errors stay byte-identical across the shared-translator migration.
 *
 * @example
 * ```ts
 * import { TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE } from "@beep/tika"
 *
 * console.log(TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE.startsWith("Tika extraction is deferred")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE =
  "Tika extraction is deferred because no Tika runtime is configured for this proof.";

// Wording overrides accepted by `tikaOperationError`; engines that predate the
// live runners supply their own engine-unavailable message.
type TikaOperationErrorOptions = {
  readonly engineUnavailableMessage?: string | undefined;
};

type TranslatedFailure = {
  readonly details: O.Option<Readonly<Record<string, string>>>;
  readonly message: string;
  readonly reason: FileProcessingOperationErrorReason;
};

const failure = (
  reason: FileProcessingOperationErrorReason,
  message: string,
  details: O.Option<Readonly<Record<string, string>>> = O.none()
): TranslatedFailure => ({ details, message, reason });

const extractionFailed = (error: TikaError): TranslatedFailure =>
  failure(
    "file-extraction-failed",
    extractionFailedMessage,
    O.map(error.cause, (cause) => ({ cause }))
  );

const translate = (error: TikaError, engineUnavailableMessage: string): TranslatedFailure =>
  Match.value(error.reason).pipe(
    Match.when("config", () => failure("engine-unavailable", "Tika configuration could not be resolved.")),
    Match.when("engine-unavailable", () => failure("engine-unavailable", engineUnavailableMessage)),
    Match.when("transport", () => failure("engine-unavailable", "The Tika runtime could not be reached.")),
    Match.when("timeout", () => failure("operation-timed-out", "Tika extraction timed out.")),
    Match.when("output-budget", () =>
      failure("output-limit-exceeded", "Tika extraction exceeded the configured output budget.")
    ),
    Match.when("response-decoding", () => extractionFailed(error)),
    Match.when("response-status", () =>
      pipe(error.statusCode, O.contains(unsupportedMediaTypeStatus))
        ? failure("unsupported-file-format", "Tika rejected the media type of this source.")
        : extractionFailed(error)
    ),
    Match.exhaustive
  );

/**
 * Translate a technical {@link TikaError} into a file-processing operation error.
 *
 * Transport, configuration, and reachability failures surface as
 * `engine-unavailable`; a `415` response surfaces as `unsupported-file-format`;
 * timeouts surface as `operation-timed-out`; budget overruns surface as
 * `output-limit-exceeded`; everything else surfaces as `file-extraction-failed`
 * carrying the sanitized cause in `details`.
 *
 * @param operation - Extraction operation whose artifact, format, and operation id annotate the error.
 * @param error - Technical driver failure being translated.
 * @param options - Wording overrides; engines that predate the live runners supply their own `engineUnavailableMessage`.
 * @returns The sanitized operation error for this failure.
 * @example
 * ```ts
 * import { makeTikaError, tikaOperationError } from "@beep/tika"
 * import { ExtractFileOperation } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const operation = yield* S.decodeUnknownEffect(ExtractFileOperation)({
 *     format: "plain-text",
 *     operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     operationKind: "extract",
 *     preference: { engine: "tika" },
 *     source: {
 *       digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *       extension: "txt",
 *       id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *       locator: { kind: "synthetic", value: "note.txt" },
 *       name: "note.txt",
 *       relativePath: "note.txt",
 *       sizeBytes: 5,
 *       text: "hello"
 *     }
 *   })
 *
 *   return tikaOperationError(operation, makeTikaError("timeout")).reason
 * })
 *
 * Effect.runPromise(program).then(console.log) // "operation-timed-out"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const tikaOperationError: {
  (
    error: TikaError,
    options?: TikaOperationErrorOptions
  ): (operation: ExtractFileOperation) => FileProcessingOperationError;
  (
    operation: ExtractFileOperation,
    error: TikaError,
    options?: TikaOperationErrorOptions
  ): FileProcessingOperationError;
} = dual(
  (args) => !isTikaError(args[0]),
  (
    operation: ExtractFileOperation,
    error: TikaError,
    options: TikaOperationErrorOptions = {}
  ): FileProcessingOperationError => {
    const translated = translate(error, options.engineUnavailableMessage ?? TIKA_ENGINE_UNAVAILABLE_MESSAGE);

    return FileProcessingOperationError.fromReason(translated.reason, {
      artifactId: operation.source.id,
      engine: TIKA_ENGINE_NAME,
      format: operation.format,
      message: translated.message,
      operationId: operation.operationId,
      ...O.getSomesStruct({ details: translated.details }),
    });
  }
);
