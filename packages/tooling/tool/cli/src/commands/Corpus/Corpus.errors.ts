/**
 * Typed errors for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex, TaggedErrorClass } from "@beep/schema";
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
export class CorpusCommandError extends TaggedErrorClass<CorpusCommandError>($I`CorpusCommandError`)(
  "CorpusCommandError",
  {
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("CorpusCommandError", {
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
export class CorpusArchiveMoveUncoveredFileError extends TaggedErrorClass<CorpusArchiveMoveUncoveredFileError>(
  $I`CorpusArchiveMoveUncoveredFileError`
)(
  "CorpusArchiveMoveUncoveredFileError",
  {
    message: S.String,
    originPath: S.NonEmptyString,
    sourcePath: S.NonEmptyString,
  },
  $I.annote("CorpusArchiveMoveUncoveredFileError", {
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
export class CorpusArchiveMoveDigestMismatchError extends TaggedErrorClass<CorpusArchiveMoveDigestMismatchError>(
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
  $I.annote("CorpusArchiveMoveDigestMismatchError", {
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
export class CorpusArchiveMoveDestinationConflictError extends TaggedErrorClass<CorpusArchiveMoveDestinationConflictError>(
  $I`CorpusArchiveMoveDestinationConflictError`
)(
  "CorpusArchiveMoveDestinationConflictError",
  {
    archivePath: S.NonEmptyString,
    message: S.String,
    sourcePath: S.NonEmptyString,
  },
  $I.annote("CorpusArchiveMoveDestinationConflictError", {
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
