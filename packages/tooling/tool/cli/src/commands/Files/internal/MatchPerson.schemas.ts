/**
 * Person-match command inputs, worker protocol, and public report schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FaceDetectionConfidence, FaceDetectionPercentage } from "@beep/face-detection";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, NonNegNum, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.schemas");

const PersonMatchSimilarityScore = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(-1, {
        identifier: $I`PersonMatchSimilarityScoreMinimumCheck`,
        title: "Minimum person-match similarity score",
        description: "Requires a cosine-similarity score greater than or equal to -1.",
        message: "Expected a person-match similarity score greater than or equal to -1.",
      }),
      S.isLessThanOrEqualTo(1, {
        identifier: $I`PersonMatchSimilarityScoreMaximumCheck`,
        title: "Maximum person-match similarity score",
        description: "Requires a cosine-similarity score less than or equal to 1.",
        message: "Expected a person-match similarity score less than or equal to 1.",
      }),
    ],
    {
      identifier: $I`PersonMatchSimilarityScoreChecks`,
      title: "Person-match similarity score range",
      description: "Constrains cosine-similarity scores to the inclusive interval from -1 to 1.",
    }
  )
).pipe(
  $I.annoteSchema("PersonMatchSimilarityScore", {
    description: "A finite cosine-similarity score in the inclusive interval from -1 to 1.",
  })
);

/**
 * Enumerates the output classifications assigned to source images by a person-matching run.
 *
 * **Example** (Check a disposition)
 *
 * ```ts
 * import { PersonMatchDisposition } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchDisposition.is("unreadable"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchDisposition = LiteralKit([
  "solo-match",
  "group-match",
  "low-quality-match",
  "review",
  "no-match",
  "no-face",
  "unreadable",
]).pipe(
  $I.annoteSchema("PersonMatchDisposition", {
    description: "The classification assigned to an image after matching its detected faces against references.",
  })
);

/**
 * The image classification assigned by a person-matching run.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchDisposition = typeof PersonMatchDisposition.Type;

/**
 * Enumerates quality warnings emitted for a detected target face.
 *
 * **Example** (Check a quality warning)
 *
 * ```ts
 * import { PersonMatchQualityFlag } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchQualityFlag.is("blurry"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchQualityFlag = LiteralKit([
  "face-too-small",
  "blurry",
  "too-dark",
  "too-bright",
  "side-face",
]).pipe(
  $I.annoteSchema("PersonMatchQualityFlag", {
    description: "A review warning derived from target-face size, sharpness, brightness, or pose.",
  })
);

/**
 * A quality warning emitted for a detected target face.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchQualityFlag = typeof PersonMatchQualityFlag.Type;

/**
 * Enumerates the reasons a reference image can be rejected before identity matching.
 *
 * **Example** (Check a reference rejection reason)
 *
 * ```ts
 * import { PersonMatchReferenceRejectionReason } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchReferenceRejectionReason.is("multiple-faces"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchReferenceRejectionReason = LiteralKit([
  "unreadable-image",
  "no-face",
  "multiple-faces",
  "missing-embedding",
  "invalid-embedding",
]).pipe(
  $I.annoteSchema("PersonMatchReferenceRejectionReason", {
    description: "A machine-readable reason a reference image did not contribute an identity embedding.",
  })
);

/**
 * A reason a reference image did not contribute an identity embedding.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchReferenceRejectionReason = typeof PersonMatchReferenceRejectionReason.Type;

/**
 * Enumerates diagnostic reasons attached to candidate-image entries.
 *
 * **Example** (Check a candidate diagnostic reason)
 *
 * ```ts
 * import { PersonMatchEntryReason } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchEntryReason.is("image-decode-failed"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchEntryReason = LiteralKit(["image-decode-failed"]).pipe(
  $I.annoteSchema("PersonMatchEntryReason", {
    description: "A machine-readable diagnostic reason attached to a candidate-image entry.",
  })
);

/**
 * A diagnostic reason attached to a candidate-image entry.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchEntryReason = typeof PersonMatchEntryReason.Type;

/**
 * Enumerates stable error codes emitted by the local matching worker.
 *
 * **Example** (Check a worker error code)
 *
 * ```ts
 * import { PersonMatchWorkerErrorCode } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchWorkerErrorCode.is("model-integrity-failed"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchWorkerErrorCode = LiteralKit([
  "invalid-arguments",
  "non-finite-result",
  "invalid-directory",
  "model-integrity-failed",
  "model-acquisition-incomplete",
  "model-acquisition-failed",
  "model-license-not-accepted",
  "model-module-missing",
  "unexpected-model-artifact",
  "unexpected-execution-provider",
  "missing-embedding",
  "missing-landmarks",
  "no-reference-images",
  "no-accepted-references",
  "worker-failed",
]).pipe(
  $I.annoteSchema("PersonMatchWorkerErrorCode", {
    description: "A stable error code emitted by the local person-matching worker.",
  })
);

/**
 * A stable error code emitted by the local matching worker.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchWorkerErrorCode = typeof PersonMatchWorkerErrorCode.Type;

/**
 * Enumerates the pinned ONNX artifacts accepted in worker model provenance.
 *
 * **Example** (Check a model artifact name)
 *
 * ```ts
 * import { PersonMatchModelArtifactName } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchModelArtifactName.is("det_10g.onnx"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchModelArtifactName = LiteralKit(["det_10g.onnx", "w600k_r50.onnx"]).pipe(
  $I.annoteSchema("PersonMatchModelArtifactName", {
    description: "The filename of a pinned ONNX artifact used by the buffalo_l worker runtime.",
  })
);

/**
 * The filename of a pinned ONNX artifact used by the matching worker.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchModelArtifactName = typeof PersonMatchModelArtifactName.Type;

/**
 * Command inputs for a local person-matching run.
 *
 * **Example** (Create command options)
 *
 * ```ts
 * import { MatchPersonOptions } from "@beep/repo-cli/commands/Files"
 *
 * const options = MatchPersonOptions.make({
 *   dir: "/photos",
 *   references: "/references",
 *   manifest: "/reports/person-match.json",
 *   recursive: true,
 *   detectionThreshold: 0.5,
 *   matchThreshold: 0.45,
 *   reviewThreshold: 0.35,
 *   minFaceAreaPct: 2,
 *   acceptModelLicense: true,
 *   json: false,
 *   overwrite: false,
 * })
 *
 * console.log(options.outDir._tag)
 * // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatchPersonOptions extends S.Class<MatchPersonOptions>($I`MatchPersonOptions`)(
  {
    dir: S.NonEmptyString,
    references: S.NonEmptyString,
    manifest: S.NonEmptyString,
    outDir: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    cacheDir: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    recursive: S.Boolean,
    detectionThreshold: FaceDetectionConfidence,
    matchThreshold: FaceDetectionConfidence,
    reviewThreshold: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    acceptModelLicense: S.Boolean,
    json: S.Boolean,
    overwrite: S.Boolean,
  },
  $I.annote("MatchPersonOptions", {
    description: "Validated command inputs for a local person-matching run.",
  })
) {}

/**
 * Describes a checksummed model artifact consumed by the matching worker.
 *
 * **Example** (Validate an artifact record)
 *
 * ```ts
 * import { PersonMatchModelArtifact } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const artifact = S.decodeUnknownOption(PersonMatchModelArtifact)({
 *   name: "det_10g.onnx",
 *   path: "/cache/models/det_10g.onnx",
 *   sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
 * })
 *
 * console.log(O.isSome(artifact))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchModelArtifact extends S.Class<PersonMatchModelArtifact>($I`PersonMatchModelArtifact`)(
  {
    name: PersonMatchModelArtifactName,
    path: S.NonEmptyString,
    sha256: Sha256Hex,
  },
  $I.annote("PersonMatchModelArtifact", {
    description: "A named, checksummed model artifact consumed by the person-matching worker.",
  })
) {}

/**
 * Records the exact local model installation and runtime allowlist used for matching.
 *
 * **Example** (Validate model provenance)
 *
 * ```ts
 * import { PersonMatchModel } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const model = S.decodeUnknownOption(PersonMatchModel)({
 *   name: "buffalo_l",
 *   packageVersion: "1.0.1",
 *   providers: ["CPUExecutionProvider"],
 *   allowedModules: ["detection", "recognition"],
 *   root: "/cache/insightface",
 *   artifacts: [],
 * })
 *
 * console.log(O.isSome(model))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchModel extends S.Class<PersonMatchModel>($I`PersonMatchModel`)(
  {
    name: S.Literal("buffalo_l"),
    packageVersion: S.Literal("1.0.1"),
    providers: S.Tuple([S.Literal("CPUExecutionProvider")]),
    allowedModules: S.Tuple([S.Literal("detection"), S.Literal("recognition")]),
    root: S.NonEmptyString,
    artifacts: S.Array(PersonMatchModelArtifact),
  },
  $I.annote("PersonMatchModel", {
    description: "Provenance for the model installation and runtime used by a person-matching run.",
  })
) {}

/**
 * Captures the JSON-safe thresholds and traversal mode supplied to the matching worker.
 *
 * **Example** (Validate run parameters)
 *
 * ```ts
 * import { PersonMatchParameters } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const parameters = S.decodeUnknownOption(PersonMatchParameters)({
 *   detectionThreshold: 0.5,
 *   matchThreshold: 0.45,
 *   reviewThreshold: 0.35,
 *   minFaceAreaPct: 2,
 *   recursive: true,
 * })
 *
 * console.log(O.isSome(parameters))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchParameters extends S.Class<PersonMatchParameters>($I`PersonMatchParameters`)(
  {
    detectionThreshold: FaceDetectionConfidence,
    matchThreshold: FaceDetectionConfidence,
    reviewThreshold: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    recursive: S.Boolean,
  },
  $I.annote("PersonMatchParameters", {
    description: "JSON-safe thresholds and traversal mode supplied to the person-matching worker.",
  })
) {}

/**
 * Reports whether a reference image contributed an accepted identity embedding.
 *
 * Optional diagnostic properties are absent when the worker has no value to report.
 *
 * **Example** (Validate an accepted reference)
 *
 * ```ts
 * import { PersonMatchReference } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const reference = S.decodeUnknownOption(PersonMatchReference)({
 *   sourceName: "reference-01.jpg",
 *   sourcePath: "/references/reference-01.jpg",
 *   accepted: true,
 *   faceCount: 1,
 *   detectionScore: 0.98,
 * })
 *
 * console.log(O.isSome(reference))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchReference extends S.Class<PersonMatchReference>($I`PersonMatchReference`)(
  {
    sourceName: S.NonEmptyString,
    sourcePath: S.NonEmptyString,
    accepted: S.Boolean,
    faceCount: NonNegativeInt,
    detectionScore: S.optionalKey(FaceDetectionConfidence),
    reason: S.optionalKey(PersonMatchReferenceRejectionReason),
  },
  $I.annote("PersonMatchReference", {
    description: "Acceptance and diagnostic metadata for one person-matching reference image.",
  })
) {}

/**
 * Defines an axis-aligned face bounding box in source-image pixel coordinates.
 *
 * **Example** (Validate a face box)
 *
 * ```ts
 * import { PersonMatchFaceBox } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const box = S.decodeUnknownOption(PersonMatchFaceBox)({ x1: 12, y1: 20, x2: 180, y2: 204 })
 *
 * console.log(O.isSome(box))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchFaceBox extends S.Class<PersonMatchFaceBox>($I`PersonMatchFaceBox`)(
  {
    x1: NonNegNum,
    y1: NonNegNum,
    x2: NonNegNum,
    y2: NonNegNum,
  },
  $I.annote("PersonMatchFaceBox", {
    description: "An axis-aligned face bounding box in source-image pixel coordinates.",
  })
) {}

/**
 * Captures detection, quality, and identity-match evidence for one detected face.
 *
 * **Example** (Validate face evidence)
 *
 * ```ts
 * import { PersonMatchFace } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const face = S.decodeUnknownOption(PersonMatchFace)({
 *   box: { x1: 12, y1: 20, x2: 180, y2: 204 },
 *   detectionScore: 0.98,
 *   faceAreaPct: 12.5,
 *   matchScore: 0.72,
 *   centroidScore: 0.7,
 *   top3MedianScore: 0.69,
 *   bestReferenceScore: 0.74,
 *   bestReferenceName: "reference-01.jpg",
 *   qualityFlags: [],
 * })
 *
 * console.log(O.isSome(face))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchFace extends S.Class<PersonMatchFace>($I`PersonMatchFace`)(
  {
    box: PersonMatchFaceBox,
    detectionScore: FaceDetectionConfidence,
    faceAreaPct: FaceDetectionPercentage,
    matchScore: PersonMatchSimilarityScore,
    centroidScore: PersonMatchSimilarityScore,
    top3MedianScore: PersonMatchSimilarityScore,
    bestReferenceScore: PersonMatchSimilarityScore,
    bestReferenceName: S.NonEmptyString,
    qualityFlags: S.Array(PersonMatchQualityFlag),
  },
  $I.annote("PersonMatchFace", {
    description: "Detection, quality, and identity-match evidence for one detected face.",
  })
) {}

/**
 * Describes the matching disposition and face evidence for one source image.
 *
 * Optional best-score evidence is absent when no comparable face was available.
 *
 * **Example** (Validate an unreadable entry)
 *
 * ```ts
 * import { PersonMatchEntry } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownOption(PersonMatchEntry)({
 *   sourceName: "landscape.jpg",
 *   sourcePath: "/photos/landscape.jpg",
 *   relativePath: "landscape.jpg",
 *   disposition: "unreadable",
 *   faceCount: 0,
 *   faces: [],
 *   reason: "image-decode-failed",
 * })
 *
 * console.log(O.isSome(entry))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchEntry extends S.Class<PersonMatchEntry>($I`PersonMatchEntry`)(
  {
    sourceName: S.NonEmptyString,
    sourcePath: S.NonEmptyString,
    relativePath: S.NonEmptyString,
    disposition: PersonMatchDisposition,
    faceCount: NonNegativeInt,
    bestScore: S.optionalKey(PersonMatchSimilarityScore),
    faces: S.Array(PersonMatchFace),
    reason: S.optionalKey(PersonMatchEntryReason),
  },
  $I.annote("PersonMatchEntry", {
    description: "The matching disposition and face evidence for one source image.",
  })
) {}

/**
 * Aggregates exact disposition and reference-acceptance counts for a matching run.
 *
 * **Example** (Validate an empty summary)
 *
 * ```ts
 * import { PersonMatchSummary } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownOption(PersonMatchSummary)({
 *   totalCount: 0,
 *   soloMatchCount: 0,
 *   groupMatchCount: 0,
 *   lowQualityMatchCount: 0,
 *   reviewCount: 0,
 *   noMatchCount: 0,
 *   noFaceCount: 0,
 *   unreadableCount: 0,
 *   acceptedReferenceCount: 0,
 *   rejectedReferenceCount: 0,
 * })
 *
 * console.log(O.isSome(summary))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchSummary extends S.Class<PersonMatchSummary>($I`PersonMatchSummary`)(
  {
    totalCount: NonNegativeInt,
    soloMatchCount: NonNegativeInt,
    groupMatchCount: NonNegativeInt,
    lowQualityMatchCount: NonNegativeInt,
    reviewCount: NonNegativeInt,
    noMatchCount: NonNegativeInt,
    noFaceCount: NonNegativeInt,
    unreadableCount: NonNegativeInt,
    acceptedReferenceCount: NonNegativeInt,
    rejectedReferenceCount: NonNegativeInt,
  },
  $I.annote("PersonMatchSummary", {
    description: "Disposition and reference-acceptance counts for a person-matching run.",
  })
) {}

/**
 * Carries a stable worker error code and a human-readable failure message.
 *
 * **Example** (Validate worker error details)
 *
 * ```ts
 * import { PersonMatchWorkerError } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(PersonMatchWorkerError)({
 *   code: "model-module-missing",
 *   message: "Unable to load the configured face-recognition model.",
 * })
 *
 * console.log(O.isSome(error))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchWorkerError extends S.Class<PersonMatchWorkerError>($I`PersonMatchWorkerError`)(
  {
    code: PersonMatchWorkerErrorCode,
    message: S.NonEmptyString,
  },
  $I.annote("PersonMatchWorkerError", {
    description: "A stable worker error code and human-readable failure message.",
  })
) {}

/**
 * Defines a successful response from the local person-matching Python worker.
 *
 * **Example** (Validate an empty worker success)
 *
 * ```ts
 * import { PersonMatchWorkerSuccess } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const report = {
 *   schemaVersion: "beep.files.match-person.worker.v1",
 *   ok: true,
 *   model: {
 *     name: "buffalo_l",
 *     packageVersion: "1.0.1",
 *     providers: ["CPUExecutionProvider"],
 *     allowedModules: ["detection", "recognition"],
 *     root: "/cache/insightface",
 *     artifacts: [],
 *   },
 *   parameters: {
 *     detectionThreshold: 0.5,
 *     matchThreshold: 0.45,
 *     reviewThreshold: 0.35,
 *     minFaceAreaPct: 2,
 *     recursive: true,
 *   },
 *   references: [],
 *   entries: [],
 *   summary: {
 *     totalCount: 0,
 *     soloMatchCount: 0,
 *     groupMatchCount: 0,
 *     lowQualityMatchCount: 0,
 *     reviewCount: 0,
 *     noMatchCount: 0,
 *     noFaceCount: 0,
 *     unreadableCount: 0,
 *     acceptedReferenceCount: 0,
 *     rejectedReferenceCount: 0,
 *   },
 *   elapsedSeconds: 0,
 * }
 *
 * const decoded = S.decodeUnknownOption(PersonMatchWorkerSuccess)(report)
 *
 * console.log(O.isSome(decoded))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchWorkerSuccess extends S.Class<PersonMatchWorkerSuccess>($I`PersonMatchWorkerSuccess`)(
  {
    schemaVersion: S.Literal("beep.files.match-person.worker.v1"),
    ok: S.Literal(true),
    model: PersonMatchModel,
    parameters: PersonMatchParameters,
    references: S.Array(PersonMatchReference),
    entries: S.Array(PersonMatchEntry),
    summary: PersonMatchSummary,
    elapsedSeconds: NonNegNum,
  },
  $I.annote("PersonMatchWorkerSuccess", {
    description: "A successful versioned response from the local person-matching Python worker.",
  })
) {}

/**
 * Defines a failed response from the local person-matching Python worker.
 *
 * **Example** (Validate a worker failure)
 *
 * ```ts
 * import { PersonMatchWorkerFailure } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownOption(PersonMatchWorkerFailure)({
 *   schemaVersion: "beep.files.match-person.worker.v1",
 *   ok: false,
 *   error: {
 *     code: "model-module-missing",
 *     message: "Unable to load the configured face-recognition model.",
 *   },
 *   elapsedSeconds: 0.12,
 * })
 *
 * console.log(O.isSome(failure))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchWorkerFailure extends S.Class<PersonMatchWorkerFailure>($I`PersonMatchWorkerFailure`)(
  {
    schemaVersion: S.Literal("beep.files.match-person.worker.v1"),
    ok: S.Literal(false),
    error: PersonMatchWorkerError,
    elapsedSeconds: NonNegNum,
  },
  $I.annote("PersonMatchWorkerFailure", {
    description: "A failed versioned response from the local person-matching Python worker.",
  })
) {}

/**
 * Accepts either a successful or failed person-matching worker response.
 *
 * **Example** (Check a worker response)
 *
 * ```ts
 * import { PersonMatchWorkerReport } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const report = S.decodeUnknownOption(PersonMatchWorkerReport)({
 *   schemaVersion: "beep.files.match-person.worker.v1",
 *   ok: false,
 *   error: { code: "no-reference-images", message: "No reference images were found." },
 *   elapsedSeconds: 0,
 * })
 *
 * console.log(O.isSome(report))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchWorkerReport = S.Union([PersonMatchWorkerSuccess, PersonMatchWorkerFailure]).pipe(
  $I.annoteSchema("PersonMatchWorkerReport", {
    description: "A versioned success or failure response emitted by the person-matching Python worker.",
  })
);

/**
 * A decoded success or failure response from the person-matching Python worker.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchWorkerReport = typeof PersonMatchWorkerReport.Type;

/**
 * Defines the final public manifest emitted by the person-matching command.
 *
 * `outputDirectory` is absent for manifest-only runs.
 *
 * **Example** (Validate an empty public manifest)
 *
 * ```ts
 * import { PersonMatchReport } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const report = {
 *   schemaVersion: "beep.files.match-person.v1",
 *   ok: true,
 *   model: {
 *     name: "buffalo_l",
 *     packageVersion: "1.0.1",
 *     providers: ["CPUExecutionProvider"],
 *     allowedModules: ["detection", "recognition"],
 *     root: "/cache/insightface",
 *     artifacts: [],
 *   },
 *   parameters: {
 *     detectionThreshold: 0.5,
 *     matchThreshold: 0.45,
 *     reviewThreshold: 0.35,
 *     minFaceAreaPct: 2,
 *     recursive: true,
 *   },
 *   references: [],
 *   entries: [],
 *   summary: {
 *     totalCount: 0,
 *     soloMatchCount: 0,
 *     groupMatchCount: 0,
 *     lowQualityMatchCount: 0,
 *     reviewCount: 0,
 *     noMatchCount: 0,
 *     noFaceCount: 0,
 *     unreadableCount: 0,
 *     acceptedReferenceCount: 0,
 *     rejectedReferenceCount: 0,
 *   },
 *   elapsedSeconds: 0,
 *   manifestPath: "/reports/person-match.json",
 *   manifestWritten: true,
 * }
 *
 * const decoded = S.decodeUnknownOption(PersonMatchReport)(report)
 *
 * console.log(O.isSome(decoded))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchReport extends S.Class<PersonMatchReport>($I`PersonMatchReport`)(
  {
    schemaVersion: S.Literal("beep.files.match-person.v1"),
    ok: S.Literal(true),
    model: PersonMatchModel,
    parameters: PersonMatchParameters,
    references: S.Array(PersonMatchReference),
    entries: S.Array(PersonMatchEntry),
    summary: PersonMatchSummary,
    elapsedSeconds: NonNegNum,
    manifestPath: S.NonEmptyString,
    manifestWritten: S.Boolean,
    outputDirectory: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("PersonMatchReport", {
    description: "The versioned public manifest emitted by the person-matching command.",
  })
) {}

/**
 * Decodes and validates a JSON string returned by the person-matching worker.
 *
 * **Example** (Create a worker decoder effect)
 *
 * ```ts
 * import { decodePersonMatchWorkerReportJson } from "@beep/repo-cli/commands/Files"
 * import { Effect } from "effect"
 *
 * const decoded = decodePersonMatchWorkerReportJson(
 *   '{"schemaVersion":"beep.files.match-person.worker.v1","ok":false,"error":{"code":"no-reference-images","message":"No reference images were found."},"elapsedSeconds":0}'
 * )
 *
 * console.log(Effect.isEffect(decoded))
 * // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodePersonMatchWorkerReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<PersonMatchWorkerReport, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<PersonMatchWorkerReport, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(PersonMatchWorkerReport)));

/**
 * Encodes a validated public person-match report into its JSON-safe wire representation.
 *
 * **Example** (Create a report encoder)
 *
 * ```ts
 * import { encodePersonMatchReport } from "@beep/repo-cli/commands/Files"
 *
 * const encode = encodePersonMatchReport
 *
 * console.log(typeof encode)
 * // "function"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodePersonMatchReport: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof PersonMatchReport.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof PersonMatchReport.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(PersonMatchReport));
