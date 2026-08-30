/**
 * Typed errors for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Corpus/Corpus.errors");

/**
 * Error raised by corpus curation commands.
 *
 * **Example** (Create corpus command error)
 *
 * ```ts
 * import { CorpusCommandError } from "@beep/repo-cli/commands/Corpus/index"
 *
 * const error = CorpusCommandError.make({ message: "Invalid corpus root" })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class CorpusCommandError extends S.TaggedError<CorpusCommandError>($I`CorpusCommandError`)(
  "CorpusCommandError",
  {
    message: S.String,
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<CorpusCommandError>("CorpusCommandError", {
    description: "A failure raised while preparing or applying a corpus curation operation.",
  })
) {
  /**
   * Construct a corpus command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): CorpusCommandError;
    (message: string): (cause: unknown) => CorpusCommandError;
  } = dual(2, (cause: unknown, message: string): CorpusCommandError => CorpusCommandError.make({ cause, message }));

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Error raised when no persisted preservation preflight exists.
 *
 * **Example** (Create a missing-preflight error)
 *
 * ```ts
 * import { PreservationPreflightMissingError } from "@beep/repo-cli/commands/Corpus"
 *
 * const error = PreservationPreflightMissingError.make({ message: "Run preflight first." })
 * console.log(error._tag) // "PreservationPreflightMissingError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class PreservationPreflightMissingError extends S.TaggedError<PreservationPreflightMissingError>(
  $I`PreservationPreflightMissingError`
)(
  "PreservationPreflightMissingError",
  { message: S.NonEmptyString },
  $I.annoteError<PreservationPreflightMissingError>("PreservationPreflightMissingError", {
    description: "The preservation runner could not find its persisted capacity preflight.",
  })
) {}

/**
 * Error raised when preservation is attempted from a proposed preflight.
 *
 * **Example** (Create an unapproved-preflight error)
 *
 * ```ts
 * import { PreservationPreflightUnapprovedError } from "@beep/repo-cli/commands/Corpus"
 *
 * const error = PreservationPreflightUnapprovedError.make({ message: "Approval is required." })
 * console.log(error._tag) // "PreservationPreflightUnapprovedError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class PreservationPreflightUnapprovedError extends S.TaggedError<PreservationPreflightUnapprovedError>(
  $I`PreservationPreflightUnapprovedError`
)(
  "PreservationPreflightUnapprovedError",
  { message: S.NonEmptyString },
  $I.annoteError<PreservationPreflightUnapprovedError>("PreservationPreflightUnapprovedError", {
    description: "The persisted preservation preflight has not received an operator-approved byte ceiling.",
  })
) {}

/**
 * Error raised when measured bytes exceed the approved preservation ceiling.
 *
 * **Example** (Create a ceiling error)
 *
 * ```ts
 * import { PreservationCeilingExceededError } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = PreservationCeilingExceededError.make({
 *   ceilingBytes: NonNegativeInt.make(1),
 *   measuredBytes: NonNegativeInt.make(2),
 *   message: "Too large."
 * })
 * console.log(error.measuredBytes) // 2
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class PreservationCeilingExceededError extends S.TaggedError<PreservationCeilingExceededError>(
  $I`PreservationCeilingExceededError`
)(
  "PreservationCeilingExceededError",
  {
    ceilingBytes: NonNegativeInt,
    measuredBytes: NonNegativeInt,
    message: S.NonEmptyString,
  },
  $I.annoteError<PreservationCeilingExceededError>("PreservationCeilingExceededError", {
    description: "The measured preservation requirement exceeds its explicitly approved byte ceiling.",
  })
) {}

/**
 * Typed archive filesystem failure.
 *
 * **Example** (Create an archive I/O error)
 *
 * ```ts
 * import { PreservationArchiveIoError } from "@beep/repo-cli/commands/Corpus"
 *
 * const error = PreservationArchiveIoError.make({ cause: "denied", message: "Read failed.", operation: "read", path: "/tmp/source" })
 * console.log(error.operation) // "read"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class PreservationArchiveIoError extends S.TaggedError<PreservationArchiveIoError>(
  $I`PreservationArchiveIoError`
)(
  "PreservationArchiveIoError",
  {
    cause: Defect({ includeStack: true }),
    message: S.NonEmptyString,
    operation: S.NonEmptyString,
    path: S.NonEmptyString,
  },
  $I.annoteError<PreservationArchiveIoError>("PreservationArchiveIoError", {
    description: "A filesystem or schema-codec operation failed while preserving archive bytes or ledgers.",
  })
) {}

/**
 * Error raised when an independent preservation verification is not clean.
 *
 * **Example** (Create a verification failure)
 *
 * ```ts
 * import { PreservationVerificationFailure } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = PreservationVerificationFailure.make({
 *   failedRows: NonNegativeInt.make(1),
 *   message: "Verification failed."
 * })
 * console.log(error.failedRows) // 1
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class PreservationVerificationFailure extends S.TaggedError<PreservationVerificationFailure>(
  $I`PreservationVerificationFailure`
)(
  "PreservationVerificationFailure",
  {
    failedRows: NonNegativeInt,
    message: S.NonEmptyString,
  },
  $I.annoteError<PreservationVerificationFailure>("PreservationVerificationFailure", {
    description: "An independent destination verification pass produced one or more non-verified terminal rows.",
  })
) {}

/**
 * Error raised when an archive run leaves unapproved terminal manifest rows.
 *
 * **Example** (Create an unapproved-rows error)
 *
 * ```ts
 * import { PreservationUnapprovedRowsError } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = PreservationUnapprovedRowsError.make({
 *   message: "Unapproved terminal rows remain.",
 *   unapprovedRows: NonNegativeInt.make(2)
 * })
 * console.log(error.unapprovedRows) // 2
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class PreservationUnapprovedRowsError extends S.TaggedError<PreservationUnapprovedRowsError>(
  $I`PreservationUnapprovedRowsError`
)(
  "PreservationUnapprovedRowsError",
  {
    message: S.NonEmptyString,
    unapprovedRows: NonNegativeInt,
  },
  $I.annoteError<PreservationUnapprovedRowsError>("PreservationUnapprovedRowsError", {
    description: "The archive run finished with terminal manifest rows outside the approved pass kinds.",
  })
) {}

/**
 * Failures returned by the T7 preservation command family.
 *
 * @category error-handling
 * @since 0.0.0
 */
export type PreservationCommandError =
  | PreservationArchiveIoError
  | PreservationCeilingExceededError
  | PreservationPreflightMissingError
  | PreservationPreflightUnapprovedError
  | PreservationUnapprovedRowsError
  | PreservationVerificationFailure;

/**
 * Error raised when an archive-move source file has no covering provenance row.
 *
 * **Example** (Make uncovered file error)
 *
 * ```ts
 * import { CorpusArchiveMoveUncoveredFileError } from "@beep/repo-cli/commands/Corpus/index"
 *
 * const error = CorpusArchiveMoveUncoveredFileError.make({
 *   message: "Source file is not covered by provenance.",
 *   originPath: "/tmp/source-a/a.txt",
 *   sourcePath: "/tmp/source-a"
 * })
 * console.log(error._tag) // "CorpusArchiveMoveUncoveredFileError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class CorpusArchiveMoveUncoveredFileError extends S.TaggedError<CorpusArchiveMoveUncoveredFileError>(
  $I`CorpusArchiveMoveUncoveredFileError`
)(
  "CorpusArchiveMoveUncoveredFileError",
  {
    message: S.String,
    originPath: S.NonEmptyString,
    sourcePath: S.NonEmptyString,
  },
  $I.annoteError<CorpusArchiveMoveUncoveredFileError>("CorpusArchiveMoveUncoveredFileError", {
    title: "Corpus Archive Move Uncovered File Error",
    description: "A source file selected for archive-move was not covered by the provided provenance manifests.",
  })
) {}

/**
 * Error raised when a provenance-covered raw file digest does not match.
 *
 * **Example** (Make digest mismatch error)
 *
 * ```ts
 * import { CorpusArchiveMoveDigestMismatchError } from "@beep/repo-cli/commands/Corpus/index"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const error = CorpusArchiveMoveDigestMismatchError.make({
 *   actualSha256: Sha256Hex.make("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
 *   expectedSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   message: "Digest mismatch.",
 *   originPath: "/tmp/source-a/a.txt",
 *   rawPath: "/tmp/corpus/raw/source-a/a.txt"
 * })
 * console.log(error._tag) // "CorpusArchiveMoveDigestMismatchError"
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class CorpusArchiveMoveDigestMismatchError extends S.TaggedError<CorpusArchiveMoveDigestMismatchError>(
  $I`CorpusArchiveMoveDigestMismatchError`
)(
  "CorpusArchiveMoveDigestMismatchError",
  {
    actualSha256: Sha256Hex,
    expectedSha256: Sha256Hex,
    message: S.String,
    originPath: S.NonEmptyString,
    rawPath: S.NonEmptyString,
  },
  $I.annoteError<CorpusArchiveMoveDigestMismatchError>("CorpusArchiveMoveDigestMismatchError", {
    title: "Corpus Archive Move Digest Mismatch Error",
    description: "A raw file referenced by archive-move provenance did not hash to the recorded SHA-256 digest.",
  })
) {}

/**
 * Error raised when archive-move would overwrite an existing archive target.
 *
 * **Example** (Make destination conflict error)
 *
 * ```ts
 * import { CorpusArchiveMoveDestinationConflictError } from "@beep/repo-cli/commands/Corpus/index"
 *
 * const error = CorpusArchiveMoveDestinationConflictError.make({
 *   archivePath: "/tmp/archive/source-a",
 *   message: "Archive destination already exists.",
 *   sourcePath: "/tmp/source-a"
 * })
 * console.log(error.archivePath)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class CorpusArchiveMoveDestinationConflictError extends S.TaggedError<CorpusArchiveMoveDestinationConflictError>(
  $I`CorpusArchiveMoveDestinationConflictError`
)(
  "CorpusArchiveMoveDestinationConflictError",
  {
    archivePath: S.NonEmptyString,
    message: S.String,
    sourcePath: S.NonEmptyString,
  },
  $I.annoteError<CorpusArchiveMoveDestinationConflictError>("CorpusArchiveMoveDestinationConflictError", {
    title: "Corpus Archive Move Destination Conflict Error",
    description: "An archive-move destination already exists or is duplicated by another selected source.",
  })
) {}

/**
 * Error union returned by archive-move operations.
 *
 * **Example** (Handle archive-move error union)
 *
 * ```ts
 * import { CorpusArchiveMoveUncoveredFileError } from "@beep/repo-cli/commands/Corpus/index"
 * import type { CorpusArchiveMoveError } from "@beep/repo-cli/commands/Corpus/index"
 *
 * const handle = (error: CorpusArchiveMoveError): string => error._tag
 * console.log(handle(CorpusArchiveMoveUncoveredFileError.make({
 *   message: "Missing provenance.",
 *   originPath: "/tmp/source-a/a.txt",
 *   sourcePath: "/tmp/source-a"
 * })))
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export type CorpusArchiveMoveError =
  | CorpusArchiveMoveDestinationConflictError
  | CorpusArchiveMoveDigestMismatchError
  | CorpusArchiveMoveUncoveredFileError
  | CorpusCommandError;
