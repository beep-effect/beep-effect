/**
 * In-process person matching over scoped CPU ONNX sessions.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canonicalizeFileTargetPath } from "./FileTransaction.ts";
import { MatchPersonError } from "./MatchPerson.errors.ts";
import {
  alignFaceImage,
  decodeFaceImage,
  faceRuntimeVersion,
  makeFaceInference,
  normalizeFaceVector,
  openFaceSession,
} from "./MatchPerson.inference.ts";
import {
  preparePersonMatchOnnxModels,
  verifyPersonMatchModelArtifacts,
  writePersonMatchModelBytes,
} from "./MatchPerson.model-store.ts";
import { compileAdaFaceOnnx } from "./MatchPerson.onnx.ts";
import {
  PersonMatchEntry,
  PersonMatchFace,
  PersonMatchFaceBox,
  PersonMatchQualityFlag,
  PersonMatchReference,
  PersonMatchWorkerLimits,
  PersonMatchWorkerSuccess,
} from "./MatchPerson.schemas.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as HttpClient from "effect/http/HttpClient";
import type { MatchPersonModelIntegrityError, PersonMatchWorkerServiceError } from "./MatchPerson.errors.ts";
import type { FaceImage, InferredFace, PersonMatchInference } from "./MatchPerson.inference.ts";
import type {
  MatchPersonOptions,
  PersonMatchDisposition,
  PersonMatchEntryReason,
  PersonMatchModel,
  PersonMatchReferenceRejectionReason,
} from "./MatchPerson.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.worker-service");
const encodeWorkerReportJson = S.encodeEffect(S.fromJsonString(PersonMatchWorkerSuccess));
/**
 * Canonical directories and destinations admitted by person-match preflight.
 *
 * **Example** (Describe scan paths)
 *
 * ```ts
 * import { CanonicalMatchPersonInputs } from "@beep/repo-cli/test/Files"
 * import * as O from "effect/Option"
 * const inputs = CanonicalMatchPersonInputs.make({ cacheRoot: "/cache", modelRoot: "/cache/adaface-kprpe", candidateDirectory: "/photos/candidates", referenceDirectory: "/photos/references", manifestPath: "/reports/matches.json", outputDirectory: O.none() })
 * console.log(inputs.modelRoot)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CanonicalMatchPersonInputs extends S.Opaque<
  CanonicalMatchPersonInputs,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    cacheRoot: S.NonEmptyString,
    candidateDirectory: S.NonEmptyString,
    manifestPath: S.NonEmptyString,
    modelRoot: S.NonEmptyString,
    outputDirectory: S.Option(S.NonEmptyString),
    referenceDirectory: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CanonicalMatchPersonInputs", {
      description: "Canonical source, reference, output and checksum-pinned model cache paths.",
    })
  )
) {}
/** In-process matcher contract. @internal @category services @since 0.0.0 */
export interface PersonMatchWorkerServiceShape {
  readonly run: (
    options: MatchPersonOptions,
    inputs: CanonicalMatchPersonInputs
  ) => Effect.Effect<PersonMatchWorkerSuccess, PersonMatchWorkerServiceError>;
}
/**
 * Run a person-match scan with a closed error channel and no process worker.
 *
 * **Example** (Access the scan operation)
 *
 * ```ts
 * import { PersonMatchWorkerService } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * const run = PersonMatchWorkerService.use((service) => Effect.succeed(service.run))
 * console.log(run)
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class PersonMatchWorkerService extends Context.Service<
  PersonMatchWorkerService,
  PersonMatchWorkerServiceShape
>()($I`PersonMatchWorkerService`) {}
/** Artifact verifier signature. @internal @category testing @since 0.0.0 */
export type PersonMatchModelArtifactVerifier = (
  model: PersonMatchModel,
  root: string
) => Effect.Effect<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path>;
/**
 * Physical artifact verification reference, replaceable by process-free orchestration tests.
 *
 * **Example** (Access the fail-closed verifier)
 *
 * ```ts
 * import { PersonMatchModelArtifactVerifier } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * const verify = Effect.gen(function* () { return yield* PersonMatchModelArtifactVerifier })
 * console.log(verify)
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const PersonMatchModelArtifactVerifier = Context.Reference<PersonMatchModelArtifactVerifier>(
  $I`PersonMatchModelArtifactVerifier`,
  { defaultValue: () => verifyPersonMatchModelArtifacts }
);
/**
 * Graph compiler boundary for verified source tensors.
 *
 * **Example** (Inspect services)
 * ```ts
 * import { PersonMatchGraphCompiler } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * const operation = Effect.gen(function* () { return yield* PersonMatchGraphCompiler })
 * console.log(Effect.isEffect(operation))
 * ```
 * @internal
 * @category services
 * @since 0.0.0
 */
export const PersonMatchGraphCompiler = Context.Reference<typeof compileAdaFaceOnnx>($I`PersonMatchGraphCompiler`, {
  defaultValue: () => compileAdaFaceOnnx,
});
/**
 * Pinned source digests used by graph verification.
 *
 * **Example** (Inspect models)
 * ```ts
 * import { PersonMatchGraphPins } from "@beep/repo-cli/test/Files"
 * console.log(PersonMatchGraphPins.fields.aligner)
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PersonMatchGraphPins extends S.Opaque<PersonMatchGraphPins, { readonly brand: unique symbol }>()(
  S.Struct({ aligner: Sha256Hex, recognizer: Sha256Hex }).pipe(
    $I.annoteSchema("PersonMatchGraphPins", {
      description: "SHA-256 identities of the source tensors compiled into cached graphs.",
    })
  )
) {}
/**
 * Source provenance for the fixed graph compiler.
 *
 * **Example** (Inspect services)
 * ```ts
 * import { PersonMatchGraphSourcePins } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * const hashes = Effect.gen(function* () { return (yield* PersonMatchGraphSourcePins).aligner })
 * console.log(Effect.isEffect(hashes))
 * ```
 * @internal
 * @category services
 * @since 0.0.0
 */
export const PersonMatchGraphSourcePins = Context.Reference<PersonMatchGraphPins>($I`PersonMatchGraphSourcePins`, {
  defaultValue: () =>
    PersonMatchGraphPins.make({
      aligner: Sha256Hex.make("80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a"),
      recognizer: Sha256Hex.make("99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db"),
    }),
});
/**
 * Native model acquisition and scoped session boundary.
 *
 * **Example** (Inspect services)
 * ```ts
 * import { PersonMatchOnnxResources } from "@beep/repo-cli/test/Files"
 * const version = PersonMatchOnnxResources.use(resources => resources.version())
 * console.log(version)
 * ```
 * @internal
 * @category services
 * @since 0.0.0
 */
export class PersonMatchOnnxResources extends Context.Service<
  PersonMatchOnnxResources,
  {
    readonly prepare: typeof preparePersonMatchOnnxModels;
    readonly graph: typeof compiledGraph;
    readonly open: (
      path: string
    ) => Effect.Effect<
      import("./MatchPerson.inference.ts").FaceSession,
      import("./MatchPerson.errors.ts").MatchPersonRuntimeError,
      import("effect/Scope").Scope
    >;
    readonly version: typeof faceRuntimeVersion;
  }
>()($I`PersonMatchOnnxResources`) {}

type Requirements =
  | PersonMatchOnnxResources
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | HttpClient.HttpClient;
const error = MatchPersonError.runtimeFromWorker;
const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const dot = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
  A.reduce(A.zip(a, b), 0, (sum, [x, y]) => sum + x * y);
const discover = Effect.fn("Files.PersonMatch.discover")(function* (root: string, recursive: boolean, limit: number) {
  const path = yield* Path.Path;
  const names = yield* Effect.try({
    try: () => {
      const found: Array<string> = [];
      for (const name of new Bun.Glob(recursive ? "**/*" : "*").scanSync({
        cwd: root,
        onlyFiles: true,
        followSymlinks: false,
        dot: true,
      })) {
        if (A.length(found) > limit) break;
        if (A.contains([".jpg", ".jpeg", ".png", ".webp"], Str.toLowerCase(path.extname(name))))
          found.push(path.join(root, name));
      }
      return A.sort(found, Str.Order);
    },
    catch: (cause) => MatchPersonError.path("Could not discover face images.", cause),
  });
  if (names.length > limit) return yield* error("input-limit-exceeded", "Image count exceeds scan limit.");
  return names;
});
const compiledGraph = Effect.fn("Files.PersonMatch.compiledGraph")(function* (
  source: string,
  root: string,
  component: "aligner" | "recognizer"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const data = yield* fs
    .readFile(source)
    .pipe(Effect.mapError((cause) => MatchPersonError.modelIntegrity("Cannot read pinned safetensors.", cause)));
  const pins = yield* PersonMatchGraphSourcePins;
  const alignerHash = pins.aligner;
  const recognizerHash = pins.recognizer;
  const hash = Hex.encode(sha256(data));
  if (hash !== (component === "aligner" ? alignerHash : recognizerHash))
    return yield* MatchPersonError.modelIntegrity("Safetensors changed after model verification.");
  const compile = yield* PersonMatchGraphCompiler;
  const graph = yield* compile(data, component);
  const target = path.join(root, `${component}-${alignerHash}-${recognizerHash}-fixed-v1.onnx`);
  const canonical = yield* canonicalizeFileTargetPath(target, "generated ONNX graph").pipe(
    Effect.mapError((cause) => MatchPersonError.modelIntegrity("Unsafe generated graph path.", cause))
  );
  if (canonical !== target) return yield* MatchPersonError.modelIntegrity("Refusing an aliased generated graph cache.");
  const exists = yield* fs
    .exists(target)
    .pipe(Effect.mapError((cause) => MatchPersonError.modelIntegrity("Cannot inspect generated graph cache.", cause)));
  const cached = exists
    ? yield* fs
        .readFile(target)
        .pipe(Effect.mapError((cause) => MatchPersonError.modelIntegrity("Cannot read generated graph cache.", cause)))
    : new Uint8Array();
  if (Hex.encode(sha256(cached)) !== Hex.encode(sha256(graph))) yield* writePersonMatchModelBytes(target, graph);
  return target;
});
class FaceQuality extends S.Opaque<FaceQuality, { readonly brand: unique symbol }>()(
  S.Struct({
    flags: S.Array(PersonMatchQualityFlag),
    area: S.Finite,
    brightness: S.Finite,
    blurVariance: S.Finite,
  }).pipe(
    $I.annoteSchema("FaceQuality", { description: "Aligned-crop quality measurements and stable rejection flags." })
  )
) {}
class CropQualityStats extends S.Opaque<CropQualityStats, { readonly brand: unique symbol }>()(
  S.Struct({ brightness: S.Finite, blurVariance: S.Finite }).pipe(
    $I.annoteSchema("CropQualityStats", { description: "Aligned grayscale brightness and Laplacian variance." })
  )
) {}
const cropQualityStats = (crop: FaceImage): CropQualityStats => {
  const gray = new Float64Array(112 * 112);
  const channel = (i: number) => crop.pixels[i] ?? 0;
  for (let i = 0; i < gray.length; i++)
    gray[i] = Math.round(channel(i * 3) * 0.299 + channel(i * 3 + 1) * 0.587 + channel(i * 3 + 2) * 0.114);
  const reflect = (n: number) => (n < 0 ? -n : n > 111 ? 222 - n : n);
  const value = (x: number, y: number) => gray[reflect(y) * 112 + reflect(x)] ?? 0;
  let mean = 0;
  let sum = 0;
  let squared = 0;
  for (let y = 0; y < 112; y++)
    for (let x = 0; x < 112; x++) {
      const center = value(x, y);
      mean += center;
      const lap = value(x - 1, y) + value(x + 1, y) + value(x, y - 1) + value(x, y + 1) - 4 * center;
      sum += lap;
      squared += lap * lap;
    }
  return CropQualityStats.make({
    brightness: mean / gray.length,
    blurVariance: squared / gray.length - (sum / gray.length) ** 2,
  });
};
const isSideFace = (face: InferredFace): boolean => {
  const [left, right, nosePoint, leftMouth, rightMouth] = face.landmarks;
  const angle = -Math.atan2(right[1] - left[1], right[0] - left[0]);
  const horizontal = (point: readonly [number, number]) =>
    (point[0] - (left[0] + right[0]) / 2) * Math.cos(angle) - (point[1] - (left[1] + right[1]) / 2) * Math.sin(angle);
  const leftX = horizontal(left);
  const rightX = horizontal(right);
  const nose = horizontal(nosePoint);
  const span = Math.abs(rightX - leftX);
  if (span <= 1e-6) return false;
  const axis = (leftX + rightX + horizontal(leftMouth) + horizontal(rightMouth)) / 4;
  const dl = Math.abs(nose - leftX);
  const dr = Math.abs(rightX - nose);
  return Math.abs(nose - axis) / span > 0.18 || Math.min(dl, dr) / Math.max(dl, dr) < 0.38;
};
const quality = (image: FaceImage, face: InferredFace, minArea: number) => {
  const stats = cropQualityStats(alignFaceImage(image, face.landmarks));
  const box = face.box;
  const area =
    ((Math.max(0, Math.min(image.width, box.x2) - Math.max(0, box.x1)) *
      Math.max(0, Math.min(image.height, box.y2) - Math.max(0, box.y1))) /
      (image.width * image.height)) *
    100;
  const flags: Array<PersonMatchQualityFlag> = [];
  if (area < minArea) flags.push("face-too-small");
  if (stats.blurVariance < 45) flags.push("blurry");
  if (stats.brightness < 45) flags.push("too-dark");
  if (stats.brightness > 220) flags.push("too-bright");
  if (isSideFace(face)) flags.push("side-face");
  return FaceQuality.make({ flags, area, ...stats });
};
/**
 * Measure aligned-crop brightness, Laplacian variance, face area and quality flags.
 *
 * **Example** (Measure a fixture detection)
 *
 * ```ts
 * import { FaceImage, InferredFace, FaceDetectionBox, faceQualityForTesting } from "@beep/repo-cli/test/Files"
 * import * as O from "effect/Option"
 * const image = FaceImage.make({ width: 112, height: 112, pixels: new Uint8Array(112 * 112 * 3) })
 * const face = InferredFace.make({ box: FaceDetectionBox.make({ x1: 0, y1: 0, x2: 112, y2: 112 }), score: 1, confidence: 1, embedding: O.none(), landmarks: [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]] })
 * console.log(faceQualityForTesting(image, face, 0.5).flags)
 * ```
 *
 * @param image - Decoded original pixels.
 * @param face - Detector geometry and landmarks.
 * @param minArea - Minimum face area as a percentage of the image.
 * @returns Quality measurements used by the parity assertions.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const faceQualityForTesting: {
  (image: FaceImage, face: InferredFace, minArea: number): ReturnType<typeof quality>;
  (face: InferredFace, minArea: number): (image: FaceImage) => ReturnType<typeof quality>;
} = dual(3, quality);
class ReferenceObservation extends S.Opaque<ReferenceObservation, { readonly brand: unique symbol }>()(
  S.Struct({ reference: PersonMatchReference, vector: S.Array(S.Finite).pipe(S.Option) }).pipe(
    $I.annoteSchema("ReferenceObservation", {
      description: "A reference decision and its optional accepted embedding.",
    })
  )
) {}
class ReferenceSet extends S.Opaque<ReferenceSet, { readonly brand: unique symbol }>()(
  S.Struct({
    references: S.Array(PersonMatchReference),
    vectors: S.Array(S.Finite).pipe(S.Array),
    names: S.Array(S.NonEmptyString),
    centroid: S.Array(S.Finite),
  }).pipe($I.annoteSchema("ReferenceSet", { description: "Accepted identity evidence and all reference decisions." }))
) {}
class ScoredFace extends S.Opaque<ScoredFace, { readonly brand: unique symbol }>()(
  S.Struct({ face: PersonMatchFace, score: S.Finite }).pipe(
    $I.annoteSchema("ScoredFace", {
      description: "A rounded public face record with its unrounded classification score.",
    })
  )
) {}
type FaceInference = Context.Service.Shape<typeof PersonMatchInference>;
const rejectedReference = (
  base: PersonMatchReference,
  reason: PersonMatchReferenceRejectionReason,
  faceCount = 0,
  detectionScore: O.Option<number> = O.none()
) =>
  ReferenceObservation.make({
    reference: PersonMatchReference.make({ ...base, reason, faceCount, ...O.getSomesStruct({ detectionScore }) }),
    vector: O.none(),
  });
const readReference = Effect.fn("Files.PersonMatch.readReference")(function* (
  sourcePath: string,
  inference: FaceInference,
  options: MatchPersonOptions
) {
  const path = yield* Path.Path;
  const base = PersonMatchReference.make({
    sourceName: path.basename(sourcePath),
    sourcePath,
    accepted: false,
    faceCount: 0,
  });
  const image = yield* decodeFaceImage(sourcePath);
  if (O.isNone(image)) return rejectedReference(base, "unreadable-image");
  const faces = yield* inference.detect(image.value, options.detectionThreshold);
  if (A.some(faces, (face) => O.isNone(face.embedding))) return rejectedReference(base, "aligner-confidence-failed");
  const face = faces[0];
  if (faces.length !== 1 || face === undefined)
    return rejectedReference(base, faces.length === 0 ? "no-face" : "multiple-faces", faces.length);
  if (
    O.isNone(face.embedding) ||
    face.embedding.value.length === 0 ||
    A.some(face.embedding.value, (v) => !Number.isFinite(v))
  )
    return rejectedReference(base, "invalid-embedding", 1, O.some(round(face.score)));
  return ReferenceObservation.make({
    reference: PersonMatchReference.make({ ...base, accepted: true, faceCount: 1, detectionScore: round(face.score) }),
    vector: face.embedding,
  });
});
const collectReferences = Effect.fn("Files.PersonMatch.collectReferences")(function* (
  paths: ReadonlyArray<string>,
  inference: FaceInference,
  options: MatchPersonOptions
) {
  const observations = yield* Effect.forEach(paths, (source) => readReference(source, inference, options), {
    concurrency: 1,
  });
  const references = A.map(observations, (o) => o.reference);
  const vectors = A.getSomes(A.map(observations, (o) => o.vector));
  const names = A.map(
    A.filter(references, (r) => r.accepted),
    (r) => r.sourceName
  );
  if (vectors.length === 0)
    return yield* error(
      "no-accepted-references",
      "No reference image contained exactly one detectable face with a valid embedding."
    );
  if (options.recursive && HashSet.size(HashSet.fromIterable(names)) !== names.length)
    return yield* error("invalid-arguments", "Recursive accepted reference names must be unique.");
  const centroid = normalizeFaceVector(
    A.makeBy(
      vectors[0]?.length ?? 0,
      (i) => A.reduce(vectors, 0, (sum, vector) => sum + (vector[i] ?? 0)) / vectors.length
    )
  );
  return ReferenceSet.make({ references, vectors, names, centroid });
});
const scoreFace = (
  image: FaceImage,
  face: InferredFace,
  embedding: ReadonlyArray<number>,
  referenceSet: ReferenceSet,
  options: MatchPersonOptions
): ScoredFace => {
  const scores = A.map(referenceSet.vectors, (v) => dot(v, embedding));
  const descending = A.take(A.sort(scores, Order.flip(Num.Order)), 3);
  const median =
    descending.length === 2
      ? ((descending[0] ?? 0) + (descending[1] ?? 0)) / 2
      : (descending[Math.floor(descending.length / 2)] ?? 0);
  const best = Math.max(...scores);
  const bestIndex = A.findFirstIndex(scores, (s) => s === best);
  const centroidScore = dot(referenceSet.centroid, embedding);
  const q = quality(image, face, options.minFaceAreaPct);
  const matchScore = Math.max(centroidScore, median);

  return ScoredFace.make({
    face: PersonMatchFace.make({
      box: PersonMatchFaceBox.make({
        x1: round(Math.max(0, Math.min(image.width, face.box.x1)), 3),
        y1: round(Math.max(0, Math.min(image.height, face.box.y1)), 3),
        x2: round(Math.max(0, Math.min(image.width, face.box.x2)), 3),
        y2: round(Math.max(0, Math.min(image.height, face.box.y2)), 3),
      }),
      detectionScore: round(face.score),
      faceAreaPct: round(q.area),
      matchScore: round(matchScore),
      centroidScore: round(centroidScore),
      top3MedianScore: round(median),
      bestReferenceScore: round(best),
      bestReferenceName: referenceSet.names[O.getOrElse(bestIndex, () => 0)] ?? "",
      qualityFlags: q.flags,
    }),
    score: matchScore,
  });
};
const matchingDisposition = (scored: ReadonlyArray<ScoredFace>): PersonMatchDisposition => {
  if (scored.length > 1) return "group-match";
  return A.some(scored, (s) => s.face.qualityFlags.length > 0) ? "low-quality-match" : "solo-match";
};
const classifyFaces = (
  scored: ReadonlyArray<ScoredFace>,
  rejected: boolean,
  options: MatchPersonOptions
): PersonMatchDisposition => {
  if (scored.length === 0) return "no-face";
  if (rejected) return "review";
  if (A.some(scored, (face) => face.score >= options.matchThreshold)) return matchingDisposition(scored);
  return Math.max(...A.map(scored, (face) => face.score)) >= options.reviewThreshold ? "review" : "no-match";
};
const ComparableEmbedding = S.NonEmptyArray(S.Finite).pipe(
  $I.annoteSchema("ComparableEmbedding", {
    description: "A nonempty finite vector that can participate in candidate scoring.",
  })
);
const isComparableEmbedding = S.is(ComparableEmbedding);
const candidateRejectionReason = (detected: ReadonlyArray<InferredFace>): O.Option<PersonMatchEntryReason> => {
  if (A.some(detected, (face) => O.exists(face.embedding, (embedding) => !isComparableEmbedding(embedding))))
    return O.some("invalid-embedding");
  return A.some(detected, (face) => O.isNone(face.embedding)) ? O.some("aligner-confidence-failed") : O.none();
};
const candidateEntry = Effect.fn("Files.PersonMatch.candidateEntry")(function* (
  sourcePath: string,
  inputs: CanonicalMatchPersonInputs,
  inference: FaceInference,
  referenceSet: ReferenceSet,
  options: MatchPersonOptions
) {
  const path = yield* Path.Path;
  const base = {
    sourceName: path.basename(sourcePath),
    sourcePath,
    relativePath: A.join(Str.split(path.relative(inputs.candidateDirectory, sourcePath), path.sep), "/"),
  };
  const image = yield* decodeFaceImage(sourcePath);
  if (O.isNone(image))
    return PersonMatchEntry.make({
      ...base,
      disposition: "unreadable",
      faceCount: 0,
      faces: [],
      reason: "image-decode-failed",
    });
  const detected = yield* inference.detect(image.value, options.detectionThreshold);
  const scored = A.getSomes(
    A.map(detected, (face) =>
      O.map(O.filter(face.embedding, isComparableEmbedding), (embedding) =>
        scoreFace(image.value, face, embedding, referenceSet, options)
      )
    )
  );
  const faces = A.map(scored, (s) => s.face);
  const reason = candidateRejectionReason(detected);
  const best = faces.length === 0 ? O.none() : O.some(Math.max(...A.map(scored, (s) => s.score)));
  return PersonMatchEntry.make({
    ...base,
    disposition: O.contains(reason, "invalid-embedding") ? "review" : classifyFaces(scored, O.isSome(reason), options),
    faceCount: faces.length,
    faces,
    ...(O.isSome(best) ? { bestScore: round(best.value) } : {}),
    ...O.getSomesStruct({ reason }),
  });
});
const scanCandidates = Effect.fn("Files.PersonMatch.scanCandidates")(function* (
  candidates: ReadonlyArray<string>,
  inputs: CanonicalMatchPersonInputs,
  inference: FaceInference,
  referenceSet: ReferenceSet,
  options: MatchPersonOptions
) {
  const entries: Array<PersonMatchEntry> = [];
  let reported = A.reduce(referenceSet.references, 0, (sum, reference) => sum + reference.faceCount);
  for (const sourcePath of candidates) {
    const entry = yield* candidateEntry(sourcePath, inputs, inference, referenceSet, options);
    reported += entry.faceCount;
    if (reported > 65536) return yield* error("input-limit-exceeded", "Reported face count exceeds 65536.");
    entries.push(entry);
  }

  return entries;
});
const runWorker = Effect.fn("Files.PersonMatch.run")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
) {
  const started = yield* Clock.clockWith((clock) => Effect.succeed(clock.currentTimeMillisUnsafe()));
  if (options.batchSize !== 1)
    return yield* error("invalid-arguments", "Native person matching supports only batch size 1.");
  if (options.compute !== "cpu")
    return yield* error("invalid-arguments", "Native person matching runs on CPU only; request compute policy cpu.");
  if (!options.acceptModelLicense)
    return yield* MatchPersonError.license("Model terms must be acknowledged before loading weights.");
  const referencePaths = yield* discover(inputs.referenceDirectory, options.recursive, 256);
  const candidates = yield* discover(inputs.candidateDirectory, options.recursive, 10000);
  if (referencePaths.length === 0) return yield* error("no-reference-images", "No supported reference images.");
  const resources = yield* PersonMatchOnnxResources;
  const runtimeVersion = yield* resources.version();
  const prepared = yield* resources.prepare(inputs.modelRoot, options.backend);
  const detector = yield* resources.open(prepared.detectorPath);
  const aligner = O.isSome(prepared.ada)
    ? yield* resources
        .graph(prepared.ada.value.alignerPath, inputs.modelRoot, "aligner")
        .pipe(Effect.flatMap(resources.open), Effect.asSome)
    : O.none();
  const recognizerPath = O.isSome(prepared.ada)
    ? yield* resources.graph(prepared.ada.value.recognizerPath, inputs.modelRoot, "recognizer")
    : prepared.recognizerPath;
  const recognizer = yield* resources.open(recognizerPath);
  const inference = makeFaceInference(detector, recognizer, aligner);
  const referenceSet = yield* collectReferences(referencePaths, inference, options);
  const references = referenceSet.references;
  const vectors = referenceSet.vectors;
  const entries = yield* scanCandidates(candidates, inputs, inference, referenceSet, options);
  const runtime = {
    framework: "onnxruntime",
    packageVersion: runtimeVersion,
    actualCompute: "cpu",
    precision: "fp32",
    providers: ["CPUExecutionProvider"],
    devices: [],
    warnings: [],
  };
  const model = {
    backend: options.backend,
    root: inputs.modelRoot,
    runtime,
    components: prepared.components,
    ...(options.backend === "adaface-kprpe"
      ? { name: "cvlface_adaface_vit_base_kprpe_webface12m", codeRevision: "308142aa50adf2e187711354f7524635d3414f1e" }
      : {
          name: "buffalo_l",
          packageName: "onnxruntime-node",
          packageVersion: runtimeVersion,
          allowedModules: ["detection", "recognition"],
        }),
  };
  const count = (disposition: PersonMatchDisposition) => A.filter(entries, (e) => e.disposition === disposition).length;
  const now = yield* Clock.clockWith((clock) => Effect.succeed(clock.currentTimeMillisUnsafe()));
  const report = yield* S.decodeUnknownEffect(PersonMatchWorkerSuccess)({
    schemaVersion: "beep.files.match-person.worker.v3",
    ok: true,
    limits: PersonMatchWorkerLimits.make({}),
    model,
    parameters: {
      backend: options.backend,
      compute: "cpu",
      actualCompute: "cpu",
      devices: [],
      batchSize: 1,
      precision: "fp32",
      thresholdSource: options.thresholdSource,
      detectionThreshold: options.detectionThreshold,
      matchThreshold: options.matchThreshold,
      reviewThreshold: options.reviewThreshold,
      minFaceAreaPct: options.minFaceAreaPct,
      recursive: options.recursive,
    },
    references,
    entries,
    summary: {
      totalCount: entries.length,
      soloMatchCount: count("solo-match"),
      groupMatchCount: count("group-match"),
      lowQualityMatchCount: count("low-quality-match"),
      reviewCount: count("review"),
      noMatchCount: count("no-match"),
      noFaceCount: count("no-face"),
      unreadableCount: count("unreadable"),
      acceptedReferenceCount: vectors.length,
      rejectedReferenceCount: references.length - vectors.length,
    },
    elapsedSeconds: round((now - started) / 1000, 3),
  }).pipe(Effect.mapError((cause) => MatchPersonError.protocol("Inference produced an invalid report.", cause)));
  const encoded = yield* encodeWorkerReportJson(report).pipe(
    Effect.mapError((cause) => MatchPersonError.protocol("Cannot encode inference report.", cause))
  );
  if (new TextEncoder().encode(encoded).byteLength + 1 > 67108864)
    return yield* error("report-limit-exceeded", "Person-match report exceeds 64 MiB.");
  const verify = yield* PersonMatchModelArtifactVerifier;
  yield* verify(report.model, inputs.modelRoot);
  return report;
});
const makeService = Effect.fn("Files.PersonMatchWorkerService.make")(function* () {
  const context = yield* Effect.context<Requirements>();
  return PersonMatchWorkerService.of({
    run: Effect.fn("Files.PersonMatchWorkerService.run")((options, inputs) =>
      Effect.scoped(runWorker(options, inputs)).pipe(Effect.provide(context))
    ),
  });
});
/**
 * Matcher layer requiring explicit native resources, filesystem, HTTP and secure randomness.
 *
 * **Example** (Provide the live matcher)
 *
 * ```ts
 * import { PersonMatchWorkerServiceLayer } from "./MatchPerson.worker-service.ts"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(PersonMatchWorkerServiceLayer))
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const PersonMatchWorkerServiceLayer = Layer.effect(PersonMatchWorkerService, makeService());
/**
 * Production native resources for the in-process matcher.
 *
 * **Example** (Inspect layers)
 * ```ts
 * import { PersonMatchWorkerServiceLive } from "./MatchPerson.worker-service.ts"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(PersonMatchWorkerServiceLive))
 * ```
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const PersonMatchWorkerServiceLive = PersonMatchWorkerServiceLayer.pipe(
  Layer.provide(
    Layer.succeed(PersonMatchOnnxResources, {
      prepare: preparePersonMatchOnnxModels,
      graph: compiledGraph,
      open: openFaceSession,
      version: faceRuntimeVersion,
    })
  )
);

/**
 * Collect reference decisions through the production image and inference boundary.
 * **Example** (Reference the regression seam)
 * ```ts
 * import { collectReferencesForTesting } from "@beep/repo-cli/test/Files"
 * console.log(typeof collectReferencesForTesting)
 * ```
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const collectReferencesForTesting = collectReferences;
/**
 * Compile and repair a pinned graph cache through the production path.
 * **Example** (Reference the cache regression seam)
 * ```ts
 * import { compiledGraphForTesting } from "@beep/repo-cli/test/Files"
 * console.log(typeof compiledGraphForTesting)
 * ```
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const compiledGraphForTesting = compiledGraph;
