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
 * console.log(PersonMatchDisposition.is("solo-match"))
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
 * @category models
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
 * @category models
 * @since 0.0.0
 */
export type PersonMatchQualityFlag = typeof PersonMatchQualityFlag.Type;

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
    dir: S.String,
    references: S.String,
    manifest: S.String,
    outDir: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    cacheDir: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
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
 * import * as S from "effect/Schema"
 *
 * const artifact = S.decodeUnknownSync(PersonMatchModelArtifact)({
 *   name: "buffalo_l.onnx",
 *   path: "/cache/models/buffalo_l.onnx",
 *   sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
 * })
 *
 * console.log(artifact.name)
 * // "buffalo_l.onnx"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchModelArtifact extends S.Class<PersonMatchModelArtifact>($I`PersonMatchModelArtifact`)(
  {
    name: S.String,
    path: S.String,
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
 * import * as S from "effect/Schema"
 *
 * const model = S.decodeUnknownSync(PersonMatchModel)({
 *   name: "buffalo_l",
 *   packageVersion: "0.7.3",
 *   providers: ["CUDAExecutionProvider", "CPUExecutionProvider"],
 *   allowedModules: ["detection", "recognition"],
 *   root: "/cache/models/buffalo_l",
 *   artifacts: [],
 * })
 *
 * console.log(model.name)
 * // "buffalo_l"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchModel extends S.Class<PersonMatchModel>($I`PersonMatchModel`)(
  {
    name: S.String,
    packageVersion: S.String,
    providers: S.Array(S.String),
    allowedModules: S.Array(S.String),
    root: S.String,
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
 * import * as S from "effect/Schema"
 *
 * const parameters = S.decodeUnknownSync(PersonMatchParameters)({
 *   detectionThreshold: 0.5,
 *   matchThreshold: 0.45,
 *   reviewThreshold: 0.35,
 *   minFaceAreaPct: 2,
 *   recursive: true,
 * })
 *
 * console.log(parameters.recursive)
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
 * import * as S from "effect/Schema"
 *
 * const reference = S.decodeUnknownSync(PersonMatchReference)({
 *   sourceName: "reference-01.jpg",
 *   sourcePath: "/references/reference-01.jpg",
 *   accepted: true,
 *   faceCount: 1,
 *   detectionScore: 0.98,
 * })
 *
 * console.log(reference.accepted)
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchReference extends S.Class<PersonMatchReference>($I`PersonMatchReference`)(
  {
    sourceName: S.String,
    sourcePath: S.String,
    accepted: S.Boolean,
    faceCount: NonNegativeInt,
    detectionScore: S.optionalKey(FaceDetectionConfidence),
    reason: S.optionalKey(S.String),
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
 * import * as S from "effect/Schema"
 *
 * const box = S.decodeUnknownSync(PersonMatchFaceBox)({ x1: 12, y1: 20, x2: 180, y2: 204 })
 *
 * console.log(box.x1)
 * // 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchFaceBox extends S.Class<PersonMatchFaceBox>($I`PersonMatchFaceBox`)(
  {
    x1: S.Finite,
    y1: S.Finite,
    x2: S.Finite,
    y2: S.Finite,
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
 * import * as S from "effect/Schema"
 *
 * const face = S.decodeUnknownSync(PersonMatchFace)({
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
 * console.log(face.matchScore)
 * // 0.72
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
    bestReferenceName: S.String,
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
 * **Example** (Validate a no-face entry)
 *
 * ```ts
 * import { PersonMatchEntry } from "@beep/repo-cli/commands/Files"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(PersonMatchEntry)({
 *   sourceName: "landscape.jpg",
 *   sourcePath: "/photos/landscape.jpg",
 *   relativePath: "landscape.jpg",
 *   disposition: "no-face",
 *   faceCount: 0,
 *   faces: [],
 * })
 *
 * console.log(entry.disposition)
 * // "no-face"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchEntry extends S.Class<PersonMatchEntry>($I`PersonMatchEntry`)(
  {
    sourceName: S.String,
    sourcePath: S.String,
    relativePath: S.String,
    disposition: PersonMatchDisposition,
    faceCount: NonNegativeInt,
    bestScore: S.optionalKey(PersonMatchSimilarityScore),
    faces: S.Array(PersonMatchFace),
    reason: S.optionalKey(S.String),
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
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(PersonMatchSummary)({
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
 * console.log(summary.totalCount)
 * // 0
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
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownSync(PersonMatchWorkerError)({
 *   code: "model-load-failed",
 *   message: "Unable to load the configured face-recognition model.",
 * })
 *
 * console.log(error.code)
 * // "model-load-failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchWorkerError extends S.Class<PersonMatchWorkerError>($I`PersonMatchWorkerError`)(
  {
    code: S.String,
    message: S.String,
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
 * import * as S from "effect/Schema"
 *
 * const report = {
 *   schemaVersion: "beep.files.match-person.worker.v1",
 *   ok: true,
 *   model: {
 *     name: "buffalo_l",
 *     packageVersion: "0.7.3",
 *     providers: ["CPUExecutionProvider"],
 *     allowedModules: ["detection", "recognition"],
 *     root: "/cache/models/buffalo_l",
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
 *     acceptedReferenceCount: 0,
 *     rejectedReferenceCount: 0,
 *   },
 *   elapsedSeconds: 0,
 * }
 *
 * const decoded = S.decodeUnknownSync(PersonMatchWorkerSuccess)(report)
 *
 * console.log(decoded.ok)
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
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(PersonMatchWorkerFailure)({
 *   schemaVersion: "beep.files.match-person.worker.v1",
 *   ok: false,
 *   error: {
 *     code: "model-load-failed",
 *     message: "Unable to load the configured face-recognition model.",
 *   },
 *   elapsedSeconds: 0.12,
 * })
 *
 * console.log(failure.ok)
 * // false
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
 * import * as S from "effect/Schema"
 *
 * const report = S.decodeUnknownSync(PersonMatchWorkerReport)({
 *   schemaVersion: "beep.files.match-person.worker.v1",
 *   ok: false,
 *   error: { code: "invalid-input", message: "No reference images were found." },
 *   elapsedSeconds: 0,
 * })
 *
 * console.log(report.ok)
 * // false
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
 * @category models
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
 * import * as S from "effect/Schema"
 *
 * const report = {
 *   schemaVersion: "beep.files.match-person.v1",
 *   ok: true,
 *   model: {
 *     name: "buffalo_l",
 *     packageVersion: "0.7.3",
 *     providers: ["CPUExecutionProvider"],
 *     allowedModules: ["detection", "recognition"],
 *     root: "/cache/models/buffalo_l",
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
 *     acceptedReferenceCount: 0,
 *     rejectedReferenceCount: 0,
 *   },
 *   elapsedSeconds: 0,
 *   manifestPath: "/reports/person-match.json",
 *   manifestWritten: true,
 * }
 *
 * const decoded = S.decodeUnknownSync(PersonMatchReport)(report)
 *
 * console.log(decoded.manifestWritten)
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
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    outputDirectory: S.optionalKey(S.String),
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
 *   '{"schemaVersion":"beep.files.match-person.worker.v1","ok":false,"error":{"code":"invalid-input","message":"No reference images were found."},"elapsedSeconds":0}'
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
