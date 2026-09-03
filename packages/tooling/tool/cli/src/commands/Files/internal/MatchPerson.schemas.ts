/**
 * Person-match command inputs, worker protocol, and public report schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FaceDetectionConfidence, FaceDetectionPercentage } from "@beep/face-detection";
import { $RepoCliId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NonNegativeInt, NonNegNum } from "@beep/schema/Number";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Sha256Hex } from "@beep/schema/Sha256";
import { Effect, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.schemas");

/**
 * Enumerates the face-recognition backends available to the person matcher.
 *
 * **Example** (Check a backend)
 *
 * ```ts
 * import { PersonMatchBackend } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchBackend.is("adaface-kprpe"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchBackend = LiteralKit(["buffalo-l", "adaface-kprpe"]).pipe(
  $I.annoteSchema("PersonMatchBackend", {
    description: "A supported face-recognition backend for local person matching.",
  })
);

/**
 * A face-recognition backend available to the person matcher.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchBackend = typeof PersonMatchBackend.Type;

/**
 * Enumerates requested compute policies before runtime device resolution.
 *
 * **Example** (Check a compute policy)
 *
 * ```ts
 * import { PersonMatchComputePolicy } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchComputePolicy.is("auto"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchComputePolicy = LiteralKit(["auto", "cpu", "rocm"]).pipe(
  $I.annoteSchema("PersonMatchComputePolicy", {
    description: "The caller's policy for selecting CPU or ROCm person-matching compute.",
  })
);

/**
 * A requested compute policy before runtime device resolution.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchComputePolicy = typeof PersonMatchComputePolicy.Type;

/**
 * Enumerates compute implementations actually selected by the worker.
 *
 * **Example** (Check selected compute)
 *
 * ```ts
 * import { PersonMatchActualCompute } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchActualCompute.is("rocm"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchActualCompute = LiteralKit(["cpu", "rocm"]).pipe(
  $I.annoteSchema("PersonMatchActualCompute", {
    description: "The CPU or ROCm compute implementation actually selected by the worker.",
  })
);

/**
 * A compute implementation actually selected by the worker.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchActualCompute = typeof PersonMatchActualCompute.Type;

/**
 * Enumerates numeric precision modes accepted by person-matching backends.
 *
 * **Example** (Check runtime precision)
 *
 * ```ts
 * import { PersonMatchPrecision } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchPrecision.is("fp32"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchPrecision = LiteralKit(["fp32"]).pipe(
  $I.annoteSchema("PersonMatchPrecision", {
    description: "The numeric precision used for person-matching inference.",
  })
);

/**
 * A numeric precision used for person-matching inference.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchPrecision = typeof PersonMatchPrecision.Type;

/**
 * Enumerates whether thresholds came from a backend profile or caller overrides.
 *
 * **Example** (Check a threshold source)
 *
 * ```ts
 * import { PersonMatchThresholdSource } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchThresholdSource.is("calibrated-default"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchThresholdSource = LiteralKit(["calibrated-default", "explicit"]).pipe(
  $I.annoteSchema("PersonMatchThresholdSource", {
    description: "The origin of the resolved detection, matching, review, and face-area thresholds.",
  })
);

/**
 * The origin of the thresholds resolved for a person-matching run.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchThresholdSource = typeof PersonMatchThresholdSource.Type;

/**
 * Enumerates semantic roles played by immutable model components.
 *
 * **Example** (Check a component role)
 *
 * ```ts
 * import { PersonMatchArtifactRole } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchArtifactRole.is("recognizer"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchArtifactRole = LiteralKit(["detector", "aligner", "recognizer"]).pipe(
  $I.annoteSchema("PersonMatchArtifactRole", {
    description: "The detector, aligner, or recognizer role of one model component.",
  })
);

/**
 * A semantic role played by an immutable model component.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchArtifactRole = typeof PersonMatchArtifactRole.Type;

/**
 * Enumerates inference frameworks used by supported recognition backends.
 *
 * **Example** (Check a framework)
 *
 * ```ts
 * import { PersonMatchFramework } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchFramework.is("pytorch"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchFramework = LiteralKit(["onnxruntime", "pytorch"]).pipe(
  $I.annoteSchema("PersonMatchFramework", {
    description: "The inference framework used by a person-matching runtime.",
  })
);

/**
 * An inference framework used by a supported recognition backend.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchFramework = typeof PersonMatchFramework.Type;

/**
 * Enumerates the pinned PyTorch wheel families available to AdaFace.
 *
 * **Example** (Check a runtime distribution)
 *
 * ```ts
 * import { PersonMatchPyTorchDistribution } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchPyTorchDistribution.is("cpu"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchPyTorchDistribution = LiteralKit(["rocm72", "cpu"]).pipe(
  $I.annoteSchema("PersonMatchPyTorchDistribution", {
    description: "The exact ROCm or CPU PyTorch wheel family selected for AdaFace inference.",
  })
);

/**
 * A pinned PyTorch wheel family available to AdaFace.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchPyTorchDistribution = typeof PersonMatchPyTorchDistribution.Type;

/**
 * Enumerates non-fatal runtime warnings emitted during compute selection.
 *
 * **Example** (Check a runtime warning code)
 *
 * ```ts
 * import { PersonMatchRuntimeWarningCode } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PersonMatchRuntimeWarningCode.is("rocm-fallback-to-cpu"))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchRuntimeWarningCode = LiteralKit(["rocm-fallback-to-cpu"]).pipe(
  $I.annoteSchema("PersonMatchRuntimeWarningCode", {
    description: "A stable non-fatal warning emitted while resolving person-matching compute.",
  })
);

/**
 * A non-fatal warning code emitted during compute selection.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchRuntimeWarningCode = typeof PersonMatchRuntimeWarningCode.Type;

/**
 * Describes a non-fatal runtime fallback without hiding the selected compute.
 *
 * **Example** (Create a fallback warning)
 *
 * ```ts
 * import { PersonMatchRuntimeWarning } from "@beep/repo-cli/commands/Files"
 *
 * const warning = PersonMatchRuntimeWarning.make({
 *   code: "rocm-fallback-to-cpu",
 *   message: "ROCm was unavailable, so auto compute selected CPU.",
 * })
 *
 * console.log(warning.code)
 * // "rocm-fallback-to-cpu"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchRuntimeWarning extends S.Class<PersonMatchRuntimeWarning>($I`PersonMatchRuntimeWarning`)(
  {
    code: PersonMatchRuntimeWarningCode,
    message: S.NonEmptyString,
  },
  $I.annote("PersonMatchRuntimeWarning", {
    description: "A stable code and explanation for a non-fatal person-matching runtime fallback.",
  })
) {}

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
  "aligner-confidence-failed",
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
export const PersonMatchEntryReason = LiteralKit(["aligner-confidence-failed", "image-decode-failed"]).pipe(
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
 * Caps the reference-image set accepted by one person-match worker request.
 *
 * **Example** (Inspect the reference-image limit)
 *
 * ```ts
 * import { PERSON_MATCH_MAX_REFERENCE_IMAGES } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PERSON_MATCH_MAX_REFERENCE_IMAGES === 256)
 * // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PERSON_MATCH_MAX_REFERENCE_IMAGES = 256;
/**
 * Caps the candidate-image set accepted by one person-match worker request.
 *
 * **Example** (Inspect the candidate-image limit)
 *
 * ```ts
 * import { PERSON_MATCH_MAX_CANDIDATE_IMAGES } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PERSON_MATCH_MAX_CANDIDATE_IMAGES === 10_000)
 * // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PERSON_MATCH_MAX_CANDIDATE_IMAGES = 10_000;
/**
 * Caps the decoded faces retained for any one image in a worker report.
 *
 * **Example** (Inspect the per-image face limit)
 *
 * ```ts
 * import { PERSON_MATCH_MAX_FACES_PER_IMAGE } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PERSON_MATCH_MAX_FACES_PER_IMAGE === 32)
 * // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PERSON_MATCH_MAX_FACES_PER_IMAGE = 32;
/**
 * Caps the total decoded faces accepted across a complete worker report.
 *
 * **Example** (Inspect the aggregate face limit)
 *
 * ```ts
 * import { PERSON_MATCH_MAX_REPORTED_FACES } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PERSON_MATCH_MAX_REPORTED_FACES === 65_536)
 * // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PERSON_MATCH_MAX_REPORTED_FACES = 65_536;
/**
 * Caps the serialized worker report read from standard output at 64 MiB.
 *
 * **Example** (Inspect the report byte limit)
 *
 * ```ts
 * import { PERSON_MATCH_MAX_REPORT_BYTES } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PERSON_MATCH_MAX_REPORT_BYTES === 64 * 1024 * 1024)
 * // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PERSON_MATCH_MAX_REPORT_BYTES = 64 * 1024 * 1024;
/**
 * Caps diagnostic text accepted from the worker at one MiB.
 *
 * **Example** (Inspect the diagnostic byte limit)
 *
 * ```ts
 * import { PERSON_MATCH_MAX_DIAGNOSTIC_BYTES } from "@beep/repo-cli/commands/Files"
 *
 * console.log(PERSON_MATCH_MAX_DIAGNOSTIC_BYTES === 1024 * 1024)
 * // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PERSON_MATCH_MAX_DIAGNOSTIC_BYTES = 1024 * 1024;

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
  "model-state-mismatch",
  "unexpected-model-artifact",
  "unexpected-execution-provider",
  "unsupported-platform",
  "pytorch-runtime-load-failed",
  "runtime-dependency-missing",
  "rocm-unavailable",
  "device-probe-failed",
  "aligner-confidence-failed",
  "missing-embedding",
  "missing-landmarks",
  "no-reference-images",
  "no-accepted-references",
  "input-limit-exceeded",
  "report-limit-exceeded",
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
 * Captures a backend's resolved detection, identity, review, and face-area thresholds.
 *
 * **Example** (Create a threshold profile)
 *
 * ```ts
 * import { PersonMatchThresholdProfile } from "@beep/repo-cli/commands/Files"
 *
 * const profile = PersonMatchThresholdProfile.make({
 *   detectionThreshold: 0.6,
 *   matchThreshold: 0.5,
 *   reviewThreshold: 0.35,
 *   minFaceAreaPct: 1,
 * })
 *
 * console.log(profile.matchThreshold)
 * // 0.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchThresholdProfile extends S.Class<PersonMatchThresholdProfile>($I`PersonMatchThresholdProfile`)(
  {
    detectionThreshold: FaceDetectionConfidence,
    matchThreshold: FaceDetectionConfidence,
    reviewThreshold: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
  },
  $I.annote("PersonMatchThresholdProfile", {
    description: "Resolved detection, identity, review, and face-area thresholds for one backend profile.",
  })
) {}

/**
 * Validates duplicate-free non-negative GPU device indexes selected by a runtime.
 *
 * **Example** (Reject duplicate indexes)
 *
 * ```ts
 * import { PersonMatchDeviceIndexes } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(PersonMatchDeviceIndexes)([0, 0])))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchDeviceIndexes = S.UniqueArray(NonNegativeInt).pipe(
  $I.annoteSchema("PersonMatchDeviceIndexes", {
    description:
      "Duplicate-free GPU indexes selected by a runtime; current person-match backends emit zero or one index.",
  })
);

/**
 * Duplicate-free GPU indexes selected by a runtime.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchDeviceIndexes = typeof PersonMatchDeviceIndexes.Type;

const PersonMatchDeviceIndexFromString = S.NonEmptyString.pipe(
  S.decodeTo(S.Finite, SchemaTransformation.numberFromString),
  S.decodeTo(NonNegativeInt),
  $I.annoteSchema("PersonMatchDeviceIndexFromString", {
    description: "A non-empty decimal string decoded into a non-negative integer device index.",
  })
);

const PersonMatchRequestedDeviceIndexes = S.Tuple([NonNegativeInt]).pipe(
  $I.annoteSchema("PersonMatchRequestedDeviceIndexes", {
    description: "Exactly one explicitly requested ROCm device index.",
  })
);

const PersonMatchDeviceIndexList = S.Tuple([PersonMatchDeviceIndexFromString]).pipe(
  $I.annoteSchema("PersonMatchDeviceIndexList", {
    description: "Exactly one ROCm device index decoded from its decimal string.",
  })
);

/**
 * Decodes a CLI value into exactly one requested ROCm device index.
 *
 * **Example** (Decode one device index)
 *
 * ```ts
 * import { PersonMatchDeviceIndexesFromCsv } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(PersonMatchDeviceIndexesFromCsv)("0")
 *
 * console.log(O.getOrNull(decoded))
 * // [0]
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const PersonMatchDeviceIndexesFromCsv = S.NonEmptyString.pipe(
  S.decodeTo(
    PersonMatchDeviceIndexList,
    SchemaTransformation.transform<readonly [string], string>({
      decode: (value) => [Str.trim(value)],
      encode: A.headNonEmpty,
    })
  ),
  $I.annoteSchema("PersonMatchDeviceIndexesFromCsv", {
    description: "A CLI value decoded into exactly one explicitly requested ROCm device index.",
  })
);

/**
 * A singleton ROCm device-index tuple decoded from a CLI value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchDeviceIndexesFromCsv = typeof PersonMatchDeviceIndexesFromCsv.Type;

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
 *   backend: "adaface-kprpe",
 *   recursive: true,
 *   detectionThreshold: 0.6,
 *   matchThreshold: 0.5,
 *   reviewThreshold: 0.35,
 *   minFaceAreaPct: 1,
 *   acceptModelLicense: true,
 *   json: false,
 *   overwrite: false,
 * })
 *
 * console.log([options.backend, options.compute, options.batchSize])
 * // ["adaface-kprpe", "auto", 32]
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
    backend: PersonMatchBackend,
    compute: PersonMatchComputePolicy.pipe(S.withConstructorDefault(Effect.succeed("auto"))),
    devices: S.Option(PersonMatchRequestedDeviceIndexes).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<typeof PersonMatchRequestedDeviceIndexes.Type>()))
    ),
    batchSize: PosInt.pipe(S.withConstructorDefault(Effect.succeed(PosInt.make(32)))),
    thresholdSource: PersonMatchThresholdSource.pipe(S.withConstructorDefault(Effect.succeed("calibrated-default"))),
    recursive: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    detectionThreshold: FaceDetectionConfidence,
    matchThreshold: FaceDetectionConfidence,
    reviewThreshold: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    acceptModelLicense: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    json: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    overwrite: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
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
 *   sizeBytes: 1024,
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
    name: S.NonEmptyString,
    path: S.NonEmptyString,
    sizeBytes: NonNegativeInt,
    sha256: Sha256Hex,
  },
  $I.annote("PersonMatchModelArtifact", {
    description: "A named, checksummed model artifact consumed by the person-matching worker.",
  })
) {}

/**
 * Groups immutable model artifacts by their detector, aligner, or recognizer role.
 *
 * **Example** (Create a recognizer component)
 *
 * ```ts
 * import { PersonMatchModelComponent } from "@beep/repo-cli/commands/Files"
 *
 * const component = PersonMatchModelComponent.make({
 *   role: "recognizer",
 *   name: "AdaFace ViT-Base KP-RPE WebFace12M",
 *   revision: "308142aa50adf2e187711354f7524635d3414f1e",
 *   source: "https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m",
 *   licenseNotice: "Use is subject to the checkpoint training-data terms.",
 *   artifacts: [],
 * })
 *
 * console.log(component.role)
 * // "recognizer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchModelComponent extends S.Class<PersonMatchModelComponent>($I`PersonMatchModelComponent`)(
  {
    role: PersonMatchArtifactRole,
    name: S.NonEmptyString,
    revision: S.NonEmptyString,
    source: S.NonEmptyString,
    licenseNotice: S.NonEmptyString,
    artifacts: S.Array(PersonMatchModelArtifact),
  },
  $I.annote("PersonMatchModelComponent", {
    description: "A model component and its immutable, checksummed artifacts grouped by semantic role.",
  })
) {}

/**
 * Describes one runtime device that actually participated in inference.
 *
 * **Example** (Create a ROCm device record)
 *
 * ```ts
 * import { PersonMatchRuntimeDevice } from "@beep/repo-cli/commands/Files"
 *
 * const device = PersonMatchRuntimeDevice.make({ index: 0, name: "AMD Radeon AI PRO R9700", architecture: "gfx1201" })
 *
 * console.log(device.index)
 * // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchRuntimeDevice extends S.Class<PersonMatchRuntimeDevice>($I`PersonMatchRuntimeDevice`)(
  {
    index: NonNegativeInt,
    name: S.NonEmptyString,
    architecture: S.NonEmptyString,
  },
  $I.annote("PersonMatchRuntimeDevice", {
    description: "A runtime device index, display name, and hardware architecture used for inference.",
  })
) {}

/**
 * Records the exact CPU ONNX Runtime used by the pinned Buffalo backend.
 *
 * **Example** (Create Buffalo runtime provenance)
 *
 * ```ts
 * import { PersonMatchOnnxRuntime } from "@beep/repo-cli/commands/Files"
 *
 * const runtime = PersonMatchOnnxRuntime.make({
 *   packageVersion: "1.23.2",
 *   actualCompute: "cpu",
 *   precision: "fp32",
 *   providers: ["CPUExecutionProvider"],
 *   devices: [],
 *   warnings: [],
 * })
 *
 * console.log(runtime.framework)
 * // "onnxruntime"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchOnnxRuntime extends S.Class<PersonMatchOnnxRuntime>($I`PersonMatchOnnxRuntime`)(
  {
    framework: S.tag("onnxruntime"),
    packageVersion: S.Literal("1.23.2"),
    actualCompute: S.Literal("cpu"),
    precision: PersonMatchPrecision,
    providers: S.Tuple([S.Literal("CPUExecutionProvider")]),
    devices: S.Tuple([]),
    warnings: S.Array(PersonMatchRuntimeWarning),
  },
  $I.annote("PersonMatchOnnxRuntime", {
    description: "Pinned CPU ONNX Runtime provenance for the InsightFace Buffalo backend.",
  })
) {}

/**
 * Records the PyTorch runtime and concrete device used by the AdaFace backend.
 *
 * **Details**
 *
 * The pinned ROCm wheel distribution is `2.9.1+rocm7.2.0.lw.git7e1940d4`,
 * while `torch.__version__` reports `2.9.1+rocm7.2.0.git7e1940d4`. The CPU
 * fallback reports `2.9.1+cpu`. Runtime provenance records the selected wheel
 * family and reported version exactly.
 *
 * **Example** (Create CPU PyTorch runtime provenance)
 *
 * ```ts
 * import { PersonMatchPyTorchRuntime } from "@beep/repo-cli/commands/Files"
 *
 * const runtime = PersonMatchPyTorchRuntime.make({
 *   distribution: "cpu",
 *   packageVersion: "2.9.1+cpu",
 *   actualCompute: "cpu",
 *   precision: "fp32",
 *   devices: [],
 *   warnings: [],
 * })
 *
 * console.log(runtime.framework)
 * // "pytorch"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchPyTorchRuntime extends S.Class<PersonMatchPyTorchRuntime>($I`PersonMatchPyTorchRuntime`)(
  {
    framework: S.tag("pytorch"),
    distribution: PersonMatchPyTorchDistribution,
    packageVersion: S.NonEmptyString,
    hipVersion: S.OptionFromOptionalKey(S.NonEmptyString),
    actualCompute: PersonMatchActualCompute,
    precision: PersonMatchPrecision,
    devices: S.Array(PersonMatchRuntimeDevice),
    warnings: S.Array(PersonMatchRuntimeWarning),
  },
  $I.annote("PersonMatchPyTorchRuntime", {
    description: "PyTorch version, compute selection, precision, devices, and fallbacks used for AdaFace inference.",
  })
) {}

/**
 * Records pinned model and runtime provenance for the InsightFace Buffalo backend.
 *
 * **Example** (Decode Buffalo provenance)
 *
 * ```ts
 * import { PersonMatchBuffaloModel } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(PersonMatchBuffaloModel)({
 *   backend: "buffalo-l",
 *   name: "buffalo_l",
 *   packageName: "insightface",
 *   packageVersion: "1.0.1",
 *   runtime: {
 *     framework: "onnxruntime",
 *     packageVersion: "1.23.2",
 *     actualCompute: "cpu",
 *     precision: "fp32",
 *     providers: ["CPUExecutionProvider"],
 *     devices: [],
 *     warnings: [],
 *   },
 *   root: "/cache/insightface",
 *   allowedModules: ["detection", "recognition"],
 *   components: [],
 * })
 *
 * console.log(O.isSome(decoded))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchBuffaloModel extends S.Class<PersonMatchBuffaloModel>($I`PersonMatchBuffaloModel`)(
  {
    backend: S.tag("buffalo-l"),
    name: S.Literal("buffalo_l"),
    packageName: S.Literal("insightface"),
    packageVersion: S.Literal("1.0.1"),
    runtime: PersonMatchOnnxRuntime,
    root: S.NonEmptyString,
    allowedModules: S.Tuple([S.Literal("detection"), S.Literal("recognition")]),
    components: S.Array(PersonMatchModelComponent),
  },
  $I.annote("PersonMatchBuffaloModel", {
    description: "Pinned InsightFace Buffalo model, component, installation, and ONNX Runtime provenance.",
  })
) {}

/**
 * Records pinned model and runtime provenance for AdaFace ViT-Base KP-RPE.
 *
 * **Example** (Decode AdaFace provenance)
 *
 * ```ts
 * import { PersonMatchAdaFaceModel } from "@beep/repo-cli/commands/Files"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(PersonMatchAdaFaceModel)({
 *   backend: "adaface-kprpe",
 *   name: "cvlface_adaface_vit_base_kprpe_webface12m",
 *   codeRevision: "308142aa50adf2e187711354f7524635d3414f1e",
 *   runtime: {
 *     framework: "pytorch",
 *     distribution: "cpu",
 *     packageVersion: "2.9.1+cpu",
 *     actualCompute: "cpu",
 *     precision: "fp32",
 *     devices: [],
 *     warnings: [],
 *   },
 *   root: "/cache/adaface-kprpe",
 *   components: [],
 * })
 *
 * console.log(O.isSome(decoded))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchAdaFaceModel extends S.Class<PersonMatchAdaFaceModel>($I`PersonMatchAdaFaceModel`)(
  {
    backend: S.tag("adaface-kprpe"),
    name: S.Literal("cvlface_adaface_vit_base_kprpe_webface12m"),
    codeRevision: S.Literal("308142aa50adf2e187711354f7524635d3414f1e"),
    runtime: PersonMatchPyTorchRuntime,
    root: S.NonEmptyString,
    components: S.Array(PersonMatchModelComponent),
  },
  $I.annote("PersonMatchAdaFaceModel", {
    description: "Pinned CVLFace AdaFace ViT-Base KP-RPE model, component, and PyTorch runtime provenance.",
  })
) {}

/**
 * Accepts backend-discriminated provenance for either supported recognition model.
 *
 * **Example** (Create an exhaustive backend matcher)
 *
 * ```ts
 * import { PersonMatchModel } from "@beep/repo-cli/commands/Files"
 *
 * const backendLabel = PersonMatchModel.match({
 *   "buffalo-l": () => "InsightFace Buffalo",
 *   "adaface-kprpe": () => "AdaFace ViT-Base KP-RPE",
 * })
 *
 * console.log(typeof backendLabel)
 * // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersonMatchModel = S.Union([PersonMatchBuffaloModel, PersonMatchAdaFaceModel]).pipe(
  S.toTaggedUnion("backend"),
  $I.annoteSchema("PersonMatchModel", {
    description: "Backend-discriminated model, component, installation, and runtime provenance.",
  })
);

/**
 * Decoded backend-discriminated provenance for a supported recognition model.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersonMatchModel = typeof PersonMatchModel.Type;

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
 *   backend: "adaface-kprpe",
 *   compute: "auto",
 *   actualCompute: "rocm",
 *   devices: [0],
 *   batchSize: 32,
 *   precision: "fp32",
 *   thresholdSource: "calibrated-default",
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
    backend: PersonMatchBackend,
    compute: PersonMatchComputePolicy,
    actualCompute: PersonMatchActualCompute,
    devices: PersonMatchDeviceIndexes,
    batchSize: PosInt,
    precision: PersonMatchPrecision,
    thresholdSource: PersonMatchThresholdSource,
    detectionThreshold: FaceDetectionConfidence,
    matchThreshold: FaceDetectionConfidence,
    reviewThreshold: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    recursive: S.Boolean,
  },
  $I.annote("PersonMatchParameters", {
    description:
      "JSON-safe backend policy, actual selected device ordinals, batching, thresholds, and traversal mode used by the worker.",
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
    faces: S.Array(PersonMatchFace).check(S.isMaxLength(PERSON_MATCH_MAX_FACES_PER_IMAGE)),
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
 * Echoes the immutable limits enforced by both sides of the private worker protocol.
 *
 * **Example** (Create the worker limits)
 *
 * ```ts
 * import { PersonMatchWorkerLimits } from "@beep/repo-cli/commands/Files"
 *
 * const limits = PersonMatchWorkerLimits.make({
 *   referenceImages: 256,
 *   candidateImages: 10_000,
 *   facesPerImage: 32,
 *   reportedFaces: 65_536,
 *   reportBytes: 67_108_864,
 *   diagnosticBytes: 1_048_576,
 * })
 * console.log(limits.facesPerImage)
 * // 32
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonMatchWorkerLimits extends S.Class<PersonMatchWorkerLimits>($I`PersonMatchWorkerLimits`)(
  {
    referenceImages: S.Literal(PERSON_MATCH_MAX_REFERENCE_IMAGES),
    candidateImages: S.Literal(PERSON_MATCH_MAX_CANDIDATE_IMAGES),
    facesPerImage: S.Literal(PERSON_MATCH_MAX_FACES_PER_IMAGE),
    reportedFaces: S.Literal(PERSON_MATCH_MAX_REPORTED_FACES),
    reportBytes: S.Literal(PERSON_MATCH_MAX_REPORT_BYTES),
    diagnosticBytes: S.Literal(PERSON_MATCH_MAX_DIAGNOSTIC_BYTES),
  },
  $I.annote("PersonMatchWorkerLimits", {
    description: "Immutable image, face, JSON, and diagnostic limits enforced by the person-match worker protocol.",
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
 *   schemaVersion: "beep.files.match-person.worker.v3",
 *   ok: true,
 *   limits: {
 *     referenceImages: 256,
 *     candidateImages: 10_000,
 *     facesPerImage: 32,
 *     reportedFaces: 65_536,
 *     reportBytes: 67_108_864,
 *     diagnosticBytes: 1_048_576,
 *   },
 *   model: {
 *     backend: "buffalo-l",
 *     name: "buffalo_l",
 *     packageName: "insightface",
 *     packageVersion: "1.0.1",
 *     runtime: {
 *       framework: "onnxruntime",
 *       packageVersion: "1.23.2",
 *       actualCompute: "cpu",
 *       precision: "fp32",
 *       providers: ["CPUExecutionProvider"],
 *       devices: [],
 *       warnings: [],
 *     },
 *     allowedModules: ["detection", "recognition"],
 *     root: "/cache/insightface",
 *     components: [],
 *   },
 *   parameters: {
 *     backend: "buffalo-l",
 *     compute: "auto",
 *     actualCompute: "cpu",
 *     devices: [],
 *     batchSize: 32,
 *     precision: "fp32",
 *     thresholdSource: "calibrated-default",
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
    schemaVersion: S.Literal("beep.files.match-person.worker.v3"),
    ok: S.Literal(true),
    limits: PersonMatchWorkerLimits,
    model: PersonMatchModel,
    parameters: PersonMatchParameters,
    references: S.Array(PersonMatchReference).check(S.isMaxLength(PERSON_MATCH_MAX_REFERENCE_IMAGES)),
    entries: S.Array(PersonMatchEntry).check(S.isMaxLength(PERSON_MATCH_MAX_CANDIDATE_IMAGES)),
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
 *   schemaVersion: "beep.files.match-person.worker.v3",
 *   ok: false,
 *   limits: {
 *     referenceImages: 256,
 *     candidateImages: 10_000,
 *     facesPerImage: 32,
 *     reportedFaces: 65_536,
 *     reportBytes: 67_108_864,
 *     diagnosticBytes: 1_048_576,
 *   },
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
    schemaVersion: S.Literal("beep.files.match-person.worker.v3"),
    ok: S.Literal(false),
    limits: PersonMatchWorkerLimits,
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
 *   schemaVersion: "beep.files.match-person.worker.v3",
 *   ok: false,
 *   limits: {
 *     referenceImages: 256,
 *     candidateImages: 10_000,
 *     facesPerImage: 32,
 *     reportedFaces: 65_536,
 *     reportBytes: 67_108_864,
 *     diagnosticBytes: 1_048_576,
 *   },
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
 *   schemaVersion: "beep.files.match-person.v2",
 *   ok: true,
 *   model: {
 *     backend: "buffalo-l",
 *     name: "buffalo_l",
 *     packageName: "insightface",
 *     packageVersion: "1.0.1",
 *     runtime: {
 *       framework: "onnxruntime",
 *       packageVersion: "1.23.2",
 *       actualCompute: "cpu",
 *       precision: "fp32",
 *       providers: ["CPUExecutionProvider"],
 *       devices: [],
 *       warnings: [],
 *     },
 *     allowedModules: ["detection", "recognition"],
 *     root: "/cache/insightface",
 *     components: [],
 *   },
 *   parameters: {
 *     backend: "buffalo-l",
 *     compute: "auto",
 *     actualCompute: "cpu",
 *     devices: [],
 *     batchSize: 32,
 *     precision: "fp32",
 *     thresholdSource: "calibrated-default",
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
    schemaVersion: S.Literal("beep.files.match-person.v2"),
    ok: S.Literal(true),
    model: PersonMatchModel,
    parameters: PersonMatchParameters,
    references: S.Array(PersonMatchReference).check(S.isMaxLength(PERSON_MATCH_MAX_REFERENCE_IMAGES)),
    entries: S.Array(PersonMatchEntry).check(S.isMaxLength(PERSON_MATCH_MAX_CANDIDATE_IMAGES)),
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
 *   '{"schemaVersion":"beep.files.match-person.worker.v3","ok":false,"limits":{"referenceImages":256,"candidateImages":10000,"facesPerImage":32,"reportedFaces":65536,"reportBytes":67108864,"diagnosticBytes":1048576},"error":{"code":"no-reference-images","message":"No reference images were found."},"elapsedSeconds":0}'
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
