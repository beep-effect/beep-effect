/**
 * Typed errors for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Corpus/Corpus.errors");

const CorpusCommandErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameCorpusCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("CorpusCommandError", {
    message: CorpusCommandErrorFields.message,
  })
);
const sameCorpusCommandError = (self: CorpusCommandError, that: CorpusCommandError): boolean =>
  sameCorpusCommandErrorFields(self, that);

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
  CorpusCommandErrorFields,
  $I.annoteClass<
    S.declare<CorpusCommandError>,
    readonly [S.TaggedStruct<"CorpusCommandError", typeof CorpusCommandErrorFields>]
  >("CorpusCommandError", {
    description: "A failure raised while preparing or applying a corpus curation operation.",
    toEquivalence: () => sameCorpusCommandError,
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

const CorpusArchiveMoveUncoveredFileErrorFields = {
  message: S.String,
  originPath: S.NonEmptyString,
  sourcePath: S.NonEmptyString,
} satisfies S.Struct.Fields;
const sameCorpusArchiveMoveUncoveredFileErrorFields = S.toEquivalence(
  S.TaggedStruct("CorpusArchiveMoveUncoveredFileError", CorpusArchiveMoveUncoveredFileErrorFields)
);
const sameCorpusArchiveMoveUncoveredFileError = (
  self: CorpusArchiveMoveUncoveredFileError,
  that: CorpusArchiveMoveUncoveredFileError
): boolean => sameCorpusArchiveMoveUncoveredFileErrorFields(self, that);

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
  CorpusArchiveMoveUncoveredFileErrorFields,
  $I.annoteClass<
    S.declare<CorpusArchiveMoveUncoveredFileError>,
    readonly [S.TaggedStruct<"CorpusArchiveMoveUncoveredFileError", typeof CorpusArchiveMoveUncoveredFileErrorFields>]
  >("CorpusArchiveMoveUncoveredFileError", {
    title: "Corpus Archive Move Uncovered File Error",
    description: "A source file selected for archive-move was not covered by the provided provenance manifests.",
    toEquivalence: () => sameCorpusArchiveMoveUncoveredFileError,
  })
) {}

const CorpusArchiveMoveDigestMismatchErrorFields = {
  actualSha256: Sha256Hex,
  expectedSha256: Sha256Hex,
  message: S.String,
  originPath: S.NonEmptyString,
  rawPath: S.NonEmptyString,
} satisfies S.Struct.Fields;
const sameCorpusArchiveMoveDigestMismatchErrorFields = S.toEquivalence(
  S.TaggedStruct("CorpusArchiveMoveDigestMismatchError", CorpusArchiveMoveDigestMismatchErrorFields)
);
const sameCorpusArchiveMoveDigestMismatchError = (
  self: CorpusArchiveMoveDigestMismatchError,
  that: CorpusArchiveMoveDigestMismatchError
): boolean => sameCorpusArchiveMoveDigestMismatchErrorFields(self, that);

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
  CorpusArchiveMoveDigestMismatchErrorFields,
  $I.annoteClass<
    S.declare<CorpusArchiveMoveDigestMismatchError>,
    readonly [S.TaggedStruct<"CorpusArchiveMoveDigestMismatchError", typeof CorpusArchiveMoveDigestMismatchErrorFields>]
  >("CorpusArchiveMoveDigestMismatchError", {
    title: "Corpus Archive Move Digest Mismatch Error",
    description: "A raw file referenced by archive-move provenance did not hash to the recorded SHA-256 digest.",
    toEquivalence: () => sameCorpusArchiveMoveDigestMismatchError,
  })
) {}

const CorpusArchiveMoveDestinationConflictErrorFields = {
  archivePath: S.NonEmptyString,
  message: S.String,
  sourcePath: S.NonEmptyString,
} satisfies S.Struct.Fields;
const sameCorpusArchiveMoveDestinationConflictErrorFields = S.toEquivalence(
  S.TaggedStruct("CorpusArchiveMoveDestinationConflictError", CorpusArchiveMoveDestinationConflictErrorFields)
);
const sameCorpusArchiveMoveDestinationConflictError = (
  self: CorpusArchiveMoveDestinationConflictError,
  that: CorpusArchiveMoveDestinationConflictError
): boolean => sameCorpusArchiveMoveDestinationConflictErrorFields(self, that);

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
  CorpusArchiveMoveDestinationConflictErrorFields,
  $I.annoteClass<
    S.declare<CorpusArchiveMoveDestinationConflictError>,
    readonly [
      S.TaggedStruct<
        "CorpusArchiveMoveDestinationConflictError",
        typeof CorpusArchiveMoveDestinationConflictErrorFields
      >,
    ]
  >("CorpusArchiveMoveDestinationConflictError", {
    title: "Corpus Archive Move Destination Conflict Error",
    description: "An archive-move destination already exists or is duplicated by another selected source.",
    toEquivalence: () => sameCorpusArchiveMoveDestinationConflictError,
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
