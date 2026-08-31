/**
 * Private typed failures for the person-match control plane.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { Match } from "effect";
import * as S from "effect/Schema";
import { FilesCommandError } from "../Files.errors.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.errors");

const failureFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
};

/**
 * Typed refusal of invalid person-match configuration.
 *
 * **Example** (Reject invalid thresholds)
 *
 * ```ts
 * import { MatchPersonConfigError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonConfigError.make({ message: "Review threshold must be lower than match threshold." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonConfigError extends S.TaggedError<MatchPersonConfigError>($I`MatchPersonConfigError`)(
  "MatchPersonConfigError",
  failureFields,
  $I.annoteError<MatchPersonConfigError>("MatchPersonConfigError", {
    description: "Invalid thresholds, cache configuration, or executable configuration for person matching.",
  })
) {}

/**
 * Typed refusal of unsafe or incompatible person-match paths.
 *
 * **Example** (Reject an overlapping cache)
 *
 * ```ts
 * import { MatchPersonPathError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonPathError.make({ message: "Cache overlaps the source directory." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonPathError extends S.TaggedError<MatchPersonPathError>($I`MatchPersonPathError`)(
  "MatchPersonPathError",
  failureFields,
  $I.annoteError<MatchPersonPathError>("MatchPersonPathError", {
    description: "Unsafe, aliased, overlapping, missing, or incompatible person-match filesystem paths.",
  })
) {}

/**
 * Typed refusal raised until the selected model terms are acknowledged.
 *
 * **Example** (Require model terms)
 *
 * ```ts
 * import { MatchPersonLicenseError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonLicenseError.make({ message: "Review and accept the pinned checkpoint terms." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonLicenseError extends S.TaggedError<MatchPersonLicenseError>($I`MatchPersonLicenseError`)(
  "MatchPersonLicenseError",
  failureFields,
  $I.annoteError<MatchPersonLicenseError>("MatchPersonLicenseError", {
    description: "Missing acknowledgement of the selected face-model weight and training-data terms.",
  })
) {}

/**
 * Typed failure while acquiring an immutable model artifact.
 *
 * **Example** (Report a busy model store)
 *
 * ```ts
 * import { MatchPersonModelAcquisitionError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonModelAcquisitionError.make({ message: "Model-store lock is busy." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonModelAcquisitionError extends S.TaggedError<MatchPersonModelAcquisitionError>(
  $I`MatchPersonModelAcquisitionError`
)(
  "MatchPersonModelAcquisitionError",
  failureFields,
  $I.annoteError<MatchPersonModelAcquisitionError>("MatchPersonModelAcquisitionError", {
    description: "Failure to lock, download, stage, or atomically install an immutable person-match model artifact.",
  })
) {}

/**
 * Typed refusal of model bytes or provenance that do not match their pins.
 *
 * **Example** (Reject a digest mismatch)
 *
 * ```ts
 * import { MatchPersonModelIntegrityError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonModelIntegrityError.make({ message: "Recognizer SHA-256 did not match its pin." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonModelIntegrityError extends S.TaggedError<MatchPersonModelIntegrityError>(
  $I`MatchPersonModelIntegrityError`
)(
  "MatchPersonModelIntegrityError",
  failureFields,
  $I.annoteError<MatchPersonModelIntegrityError>("MatchPersonModelIntegrityError", {
    description: "Model artifact bytes, paths, sizes, hashes, revisions, or component provenance failed validation.",
  })
) {}

/**
 * Typed refusal of an unavailable or silently substituted compute runtime.
 *
 * **Example** (Reject silent CPU fallback)
 *
 * ```ts
 * import { MatchPersonRuntimeError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonRuntimeError.make({ message: "Explicit ROCm inference may not fall back to CPU." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonRuntimeError extends S.TaggedError<MatchPersonRuntimeError>($I`MatchPersonRuntimeError`)(
  "MatchPersonRuntimeError",
  failureFields,
  $I.annoteError<MatchPersonRuntimeError>("MatchPersonRuntimeError", {
    description: "Unsupported CPU or ROCm runtime selection, device selection, framework, or compute fallback.",
  })
) {}

/**
 * Typed failure to execute the isolated Python worker process.
 *
 * **Example** (Report a spawn failure)
 *
 * ```ts
 * import { MatchPersonProcessError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonProcessError.make({ message: "Could not start the isolated worker." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonProcessError extends S.TaggedError<MatchPersonProcessError>($I`MatchPersonProcessError`)(
  "MatchPersonProcessError",
  failureFields,
  $I.annoteError<MatchPersonProcessError>("MatchPersonProcessError", {
    description: "Failure to spawn or complete the isolated person-match Python worker process.",
  })
) {}

/**
 * Typed refusal of malformed or failed worker protocol output.
 *
 * **Example** (Reject malformed output)
 *
 * ```ts
 * import { MatchPersonProtocolError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonProtocolError.make({ message: "Worker output was not valid protocol JSON." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonProtocolError extends S.TaggedError<MatchPersonProtocolError>($I`MatchPersonProtocolError`)(
  "MatchPersonProtocolError",
  failureFields,
  $I.annoteError<MatchPersonProtocolError>("MatchPersonProtocolError", {
    description: "Truncated, malformed, schema-invalid, or explicitly failed person-match worker protocol output.",
  })
) {}

/**
 * Typed refusal of internally inconsistent worker evidence.
 *
 * **Example** (Reject inconsistent evidence)
 *
 * ```ts
 * import { MatchPersonSemanticError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonSemanticError.make({ message: "Worker summary did not match its entries." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonSemanticError extends S.TaggedError<MatchPersonSemanticError>($I`MatchPersonSemanticError`)(
  "MatchPersonSemanticError",
  failureFields,
  $I.annoteError<MatchPersonSemanticError>("MatchPersonSemanticError", {
    description:
      "Schema-valid worker evidence that violates requested parameters, provenance, paths, scores, or counts.",
  })
) {}

/**
 * Typed failure while transactionally materializing copies and the report.
 *
 * **Example** (Report a transactional failure)
 *
 * ```ts
 * import { MatchPersonMaterializationError } from "./MatchPerson.errors.ts"
 *
 * const error = MatchPersonMaterializationError.make({ message: "Manifest commit could not be completed." })
 * console.log(error._tag)
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class MatchPersonMaterializationError extends S.TaggedError<MatchPersonMaterializationError>(
  $I`MatchPersonMaterializationError`
)(
  "MatchPersonMaterializationError",
  failureFields,
  $I.annoteError<MatchPersonMaterializationError>("MatchPersonMaterializationError", {
    description: "Failure to stage, verify, commit, or roll back person-match output copies and the manifest.",
  })
) {}

/**
 * Closed error channel returned by the private worker service.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchWorkerServiceError =
  | MatchPersonConfigError
  | MatchPersonPathError
  | MatchPersonLicenseError
  | MatchPersonModelAcquisitionError
  | MatchPersonModelIntegrityError
  | MatchPersonRuntimeError
  | MatchPersonProcessError
  | MatchPersonProtocolError
  | MatchPersonSemanticError;

/**
 * Closed error channel for the complete private person-match control plane.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type MatchPersonControlPlaneError = PersonMatchWorkerServiceError | MatchPersonMaterializationError;

const commandError = (error: MatchPersonControlPlaneError): FilesCommandError =>
  FilesCommandError.make({
    message: error.message,
    ...O.getSomesStruct({ cause: O.fromUndefinedOr(error.cause) }),
  });

/**
 * Collapse private control-plane failures at the public Files command boundary.
 *
 * **Example** (Map a runtime failure)
 *
 * ```ts
 * import { MatchPersonRuntimeError, toFilesCommandError } from "./MatchPerson.errors.ts"
 *
 * const publicError = toFilesCommandError(MatchPersonRuntimeError.make({ message: "ROCm is unavailable." }))
 * console.log(publicError._tag)
 * ```
 *
 * @internal
 * @category error-handling
 * @since 0.0.0
 */
export const toFilesCommandError = Match.type<MatchPersonControlPlaneError>().pipe(
  Match.tagsExhaustive({
    MatchPersonConfigError: commandError,
    MatchPersonLicenseError: commandError,
    MatchPersonMaterializationError: commandError,
    MatchPersonModelAcquisitionError: commandError,
    MatchPersonModelIntegrityError: commandError,
    MatchPersonPathError: commandError,
    MatchPersonProcessError: commandError,
    MatchPersonProtocolError: commandError,
    MatchPersonRuntimeError: commandError,
    MatchPersonSemanticError: commandError,
  })
);
