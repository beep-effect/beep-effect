/**
 * Translation from technical libpff driver failures to file-processing
 * operation errors.
 *
 * Every libpff engine funnels its failures through this module so no process,
 * filesystem, or libpff error escapes the operation contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { O } from "@beep/utils";
import { Match } from "effect";
import type { ExportArchiveOperation } from "@beep/file-processing/Operation";
import type { LibpffError } from "./Libpff.errors.ts";

/**
 * Engine name reported by every libpff engine descriptor and operation error.
 *
 * @example
 * ```ts
 * import { LIBPFF_ENGINE_NAME } from "@beep/libpff"
 *
 * console.log(LIBPFF_ENGINE_NAME) // "libpff"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LIBPFF_ENGINE_NAME = "libpff";

/**
 * Message reported when a live pffexport runtime cannot be reached.
 *
 * @example
 * ```ts
 * import { LIBPFF_ENGINE_UNAVAILABLE_MESSAGE } from "@beep/libpff"
 *
 * console.log(LIBPFF_ENGINE_UNAVAILABLE_MESSAGE) // "pffexport is not available on this host."
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LIBPFF_ENGINE_UNAVAILABLE_MESSAGE = "pffexport is not available on this host.";

/**
 * Engine-unavailable message emitted by the P1 scaffold engine.
 *
 * The scaffold predates the live pffexport engine and keeps its own wording so
 * its emitted errors stay stable across the shared-translator migration.
 *
 * @example
 * ```ts
 * import { LIBPFF_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE } from "@beep/libpff"
 *
 * console.log(LIBPFF_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE.startsWith("libpff export is deferred")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LIBPFF_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE =
  "libpff export is deferred because no libpff runtime is configured for this proof.";

/**
 * Timeout message emitted by the P1 scaffold engine.
 *
 * @example
 * ```ts
 * import { LIBPFF_SCAFFOLD_TIMEOUT_MESSAGE } from "@beep/libpff"
 *
 * console.log(LIBPFF_SCAFFOLD_TIMEOUT_MESSAGE) // "libpff export timed out."
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LIBPFF_SCAFFOLD_TIMEOUT_MESSAGE = "libpff export timed out.";

/**
 * Export-failed message emitted by the P1 scaffold engine.
 *
 * @example
 * ```ts
 * import { LIBPFF_SCAFFOLD_EXPORT_FAILED_MESSAGE } from "@beep/libpff"
 *
 * console.log(LIBPFF_SCAFFOLD_EXPORT_FAILED_MESSAGE) // "libpff export failed inside the driver boundary."
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LIBPFF_SCAFFOLD_EXPORT_FAILED_MESSAGE = "libpff export failed inside the driver boundary.";

const defaultTimeoutMessage = "pffexport timed out while exporting the archive.";
const defaultExportFailedMessage = "pffexport failed while exporting the archive.";
const outputLimitMessage = "libpff export exceeded the configured materialization limit.";

// Per-arm wording overrides; the scaffold engine predates the live pffexport
// runner and supplies its own P1 wording. The identity guarantee across the
// consolidation is reason + details, not message bytes.
type LibpffOperationErrorOptions = {
  readonly engineUnavailableMessage?: string | undefined;
  readonly exportFailedMessage?: string | undefined;
  readonly timeoutMessage?: string | undefined;
};

const operationErrorContext = (operation: ExportArchiveOperation) => ({
  artifactId: operation.source.id,
  engine: LIBPFF_ENGINE_NAME,
  format: operation.format,
  operationId: operation.operationId,
});

/**
 * Translate a technical {@link LibpffError} into a file-processing operation error.
 *
 * Missing-runtime failures surface as `engine-unavailable`; timeouts surface
 * as `operation-timed-out`; budget overruns surface as
 * `output-limit-exceeded`; configuration and process failures surface as
 * `archive-export-failed` carrying the process exit code in `details` when
 * one was available.
 *
 * @param operation - Archive export operation whose artifact, format, and operation id annotate the error.
 * @param error - Technical driver failure being translated.
 * @param options - Per-arm wording overrides; the P1 scaffold engine supplies its own messages.
 * @returns The sanitized operation error for this failure.
 * @example
 * ```ts
 * import { libpffOperationError, makeLibpffError } from "@beep/libpff"
 * import { ExportArchiveOperation } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const operation = yield* S.decodeUnknownEffect(ExportArchiveOperation)({
 *     format: "pst",
 *     operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     operationKind: "export-archive",
 *     preference: { engine: "libpff" },
 *     source: {
 *       digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *       extension: "pst",
 *       id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *       locator: { kind: "synthetic", value: "mailbox.pst" },
 *       name: "mailbox.pst",
 *       relativePath: "mailbox.pst",
 *       sizeBytes: 128
 *     }
 *   })
 *
 *   return libpffOperationError(operation, makeLibpffError("timeout")).reason
 * })
 *
 * Effect.runPromise(program).then(console.log) // "operation-timed-out"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const libpffOperationError = (
  operation: ExportArchiveOperation,
  error: LibpffError,
  options: LibpffOperationErrorOptions = {}
): FileProcessingOperationError =>
  Match.value(error.reason).pipe(
    Match.when("engine-unavailable", () =>
      FileProcessingOperationError.fromReason("engine-unavailable", {
        ...operationErrorContext(operation),
        message: options.engineUnavailableMessage ?? LIBPFF_ENGINE_UNAVAILABLE_MESSAGE,
      })
    ),
    Match.when("timeout", () =>
      FileProcessingOperationError.fromReason("operation-timed-out", {
        ...operationErrorContext(operation),
        message: options.timeoutMessage ?? defaultTimeoutMessage,
      })
    ),
    Match.when("output-limit", () =>
      FileProcessingOperationError.fromReason("output-limit-exceeded", {
        ...operationErrorContext(operation),
        message: outputLimitMessage,
      })
    ),
    Match.whenOr("config", "process", () =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        ...operationErrorContext(operation),
        message: options.exportFailedMessage ?? defaultExportFailedMessage,
        ...O.getSomesStruct({
          details: O.map(error.exitCode, (exitCode) => ({ exitCode: `${exitCode}` })),
        }),
      })
    ),
    Match.exhaustive
  );
