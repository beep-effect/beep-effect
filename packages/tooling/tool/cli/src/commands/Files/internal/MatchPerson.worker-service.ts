/**
 * In-process person matching over scoped CPU ONNX sessions.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
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
import * as O from "effect/Option";
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
import { preparePersonMatchOnnxModels, verifyPersonMatchModelArtifacts } from "./MatchPerson.model-store.ts";
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
import type { FaceImage, InferredFace } from "./MatchPerson.inference.ts";
import type { MatchPersonOptions, PersonMatchDisposition, PersonMatchModel } from "./MatchPerson.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.worker-service");
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
type Requirements = FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom | HttpClient.HttpClient;
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
  const alignerHash = "80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a";
  const recognizerHash = "99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db";
  const hash = Hex.encode(sha256(data));
  if (hash !== (component === "aligner" ? alignerHash : recognizerHash))
    return yield* MatchPersonError.modelIntegrity("Safetensors changed after model verification.");
  const graph = yield* compileAdaFaceOnnx(data, component);
  const target = path.join(root, `${component}-${alignerHash}-${recognizerHash}-fixed-v1.onnx`);
  const canonical = yield* canonicalizeFileTargetPath(target, "generated ONNX graph").pipe(
    Effect.mapError((cause) => MatchPersonError.modelIntegrity("Unsafe generated graph path.", cause))
  );
  if (canonical !== target) return yield* MatchPersonError.modelIntegrity("Refusing an aliased generated graph cache.");
  const exists = yield* fs
    .exists(target)
    .pipe(Effect.mapError((cause) => MatchPersonError.modelIntegrity("Cannot inspect generated graph cache.", cause)));
  if (exists) {
    const cached = yield* fs
      .readFile(target)
      .pipe(Effect.mapError((cause) => MatchPersonError.modelIntegrity("Cannot read generated graph cache.", cause)));
    if (Hex.encode(sha256(cached)) !== Hex.encode(sha256(graph)))
      return yield* MatchPersonError.modelIntegrity("Generated ONNX cache integrity mismatch.");
  } else {
    yield* fs
      .writeFile(target, graph, { flag: "wx" })
      .pipe(Effect.mapError((cause) => MatchPersonError.modelIntegrity("Cannot cache generated ONNX graph.", cause)));
  }
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
const quality = (image: FaceImage, face: InferredFace, minArea: number) => {
  const crop = alignFaceImage(image, face.landmarks);
  const gray = new Float64Array(112 * 112);
  for (let i = 0; i < gray.length; i++)
    gray[i] = Math.round(
      (crop.pixels[i * 3] ?? 0) * 0.299 + (crop.pixels[i * 3 + 1] ?? 0) * 0.587 + (crop.pixels[i * 3 + 2] ?? 0) * 0.114
    );
  let mean = 0;
  let sum = 0;
  let squared = 0;
  const reflect = (n: number) => (n < 0 ? -n : n > 111 ? 222 - n : n);
  for (let y = 0; y < 112; y++)
    for (let x = 0; x < 112; x++) {
      const v = gray[y * 112 + x] ?? 0;
      mean += v;
      const lap =
        (gray[y * 112 + reflect(x - 1)] ?? 0) +
        (gray[y * 112 + reflect(x + 1)] ?? 0) +
        (gray[reflect(y - 1) * 112 + x] ?? 0) +
        (gray[reflect(y + 1) * 112 + x] ?? 0) -
        4 * v;
      sum += lap;
      squared += lap * lap;
    }
  mean /= gray.length;
  const variance = squared / gray.length - (sum / gray.length) ** 2;
  const box = face.box;
  const area =
    ((Math.max(0, Math.min(image.width, box.x2) - Math.max(0, box.x1)) *
      Math.max(0, Math.min(image.height, box.y2) - Math.max(0, box.y1))) /
      (image.width * image.height)) *
    100;
  const flags: Array<PersonMatchQualityFlag> = [];
  if (area < minArea) flags.push("face-too-small");
  if (variance < 45) flags.push("blurry");
  if (mean < 45) flags.push("too-dark");
  if (mean > 220) flags.push("too-bright");
  const left = face.landmarks[0] ?? [0, 0];
  const right = face.landmarks[1] ?? [0, 0];
  const angle = -Math.atan2(right[1] - left[1], right[0] - left[0]);
  const xs = A.map(
    face.landmarks,
    (p) => (p[0] - (left[0] + right[0]) / 2) * Math.cos(angle) - (p[1] - (left[1] + right[1]) / 2) * Math.sin(angle)
  );
  const span = Math.abs((xs[1] ?? 0) - (xs[0] ?? 0));
  const nose = xs[2] ?? 0;
  const axis = ((xs[0] ?? 0) + (xs[1] ?? 0) + (xs[3] ?? 0) + (xs[4] ?? 0)) / 4;
  const dl = Math.abs(nose - (xs[0] ?? 0));
  const dr = Math.abs((xs[1] ?? 0) - nose);
  if (span > 1e-6 && (Math.abs(nose - axis) / span > 0.18 || Math.min(dl, dr) / Math.max(dl, dr) < 0.38))
    flags.push("side-face");
  return FaceQuality.make({ flags, area, brightness: mean, blurVariance: variance });
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
const runWorker = Effect.fn("Files.PersonMatch.run")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
) {
  const started = yield* Clock.clockWith((clock) => Effect.succeed(clock.currentTimeMillisUnsafe()));
  const path = yield* Path.Path;
  if (!options.acceptModelLicense)
    return yield* MatchPersonError.license("Model terms must be acknowledged before loading weights.");
  const referencePaths = yield* discover(inputs.referenceDirectory, options.recursive, 256);
  const candidates = yield* discover(inputs.candidateDirectory, options.recursive, 10000);
  if (referencePaths.length === 0) return yield* error("no-reference-images", "No supported reference images.");
  const runtimeVersion = yield* faceRuntimeVersion();
  const prepared = yield* preparePersonMatchOnnxModels(inputs.modelRoot, options.backend);
  const detector = yield* openFaceSession(prepared.detectorPath);
  const aligner = O.isSome(prepared.ada)
    ? yield* compiledGraph(prepared.ada.value.alignerPath, inputs.modelRoot, "aligner").pipe(
        Effect.flatMap(openFaceSession),
        Effect.asSome
      )
    : O.none();
  const recognizerPath = O.isSome(prepared.ada)
    ? yield* compiledGraph(prepared.ada.value.recognizerPath, inputs.modelRoot, "recognizer")
    : prepared.recognizerPath;
  const recognizer = yield* openFaceSession(recognizerPath);
  const inference = makeFaceInference(detector, recognizer, aligner);
  const references: Array<PersonMatchReference> = [];
  const vectors: Array<ReadonlyArray<number>> = [];
  const names: Array<string> = [];
  let reported = 0;
  for (const sourcePath of referencePaths) {
    const base = { sourceName: path.basename(sourcePath), sourcePath, accepted: false, faceCount: 0 };
    const image = yield* decodeFaceImage(sourcePath);
    if (O.isNone(image)) {
      references.push(PersonMatchReference.make({ ...base, reason: "unreadable-image" }));
      continue;
    }
    const faces = yield* inference.detect(image.value, options.detectionThreshold);
    if (A.some(faces, (face) => O.isNone(face.embedding))) {
      references.push(PersonMatchReference.make({ ...base, reason: "aligner-confidence-failed" }));
      continue;
    }
    reported += faces.length;
    const face = faces[0];
    if (faces.length !== 1 || face === undefined) {
      references.push(
        PersonMatchReference.make({
          ...base,
          faceCount: faces.length,
          reason: faces.length === 0 ? "no-face" : "multiple-faces",
        })
      );
      continue;
    }
    if (O.isNone(face.embedding) || A.some(face.embedding.value, (v) => !Number.isFinite(v))) {
      references.push(
        PersonMatchReference.make({
          ...base,
          faceCount: 1,
          detectionScore: round(face.score),
          reason: "invalid-embedding",
        })
      );
      continue;
    }
    references.push(
      PersonMatchReference.make({ ...base, accepted: true, faceCount: 1, detectionScore: round(face.score) })
    );
    vectors.push(face.embedding.value);
    names.push(base.sourceName);
  }
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
  const entries: Array<PersonMatchEntry> = [];
  for (const sourcePath of candidates) {
    const base = {
      sourceName: path.basename(sourcePath),
      sourcePath,
      relativePath: A.join(Str.split(path.relative(inputs.candidateDirectory, sourcePath), path.sep), "/"),
    };
    const image = yield* decodeFaceImage(sourcePath);
    if (O.isNone(image)) {
      entries.push(
        PersonMatchEntry.make({
          ...base,
          disposition: "unreadable",
          faceCount: 0,
          faces: [],
          reason: "image-decode-failed",
        })
      );
      continue;
    }
    const detected = yield* inference.detect(image.value, options.detectionThreshold);
    const rejected = A.some(detected, (f) => O.isNone(f.embedding));
    const faces: Array<PersonMatchFace> = [];
    const rawScores: Array<number> = [];
    for (const face of detected) {
      if (O.isNone(face.embedding)) continue;
      const embedding = face.embedding.value;
      const scores = A.map(vectors, (v) => dot(v, embedding));
      const descending = A.take(A.sort(scores, Order.flip(Num.Order)), 3);
      const median =
        descending.length === 2
          ? ((descending[0] ?? 0) + (descending[1] ?? 0)) / 2
          : (descending[Math.floor(descending.length / 2)] ?? 0);
      const best = Math.max(...scores);
      const bestIndex = A.findFirstIndex(scores, (s) => s === best);
      const centroidScore = dot(centroid, embedding);
      const q = quality(image.value, face, options.minFaceAreaPct);
      const matchScore = Math.max(centroidScore, median);
      rawScores.push(matchScore);
      faces.push(
        PersonMatchFace.make({
          box: PersonMatchFaceBox.make({
            x1: round(Math.max(0, Math.min(image.value.width, face.box.x1)), 3),
            y1: round(Math.max(0, Math.min(image.value.height, face.box.y1)), 3),
            x2: round(Math.max(0, Math.min(image.value.width, face.box.x2)), 3),
            y2: round(Math.max(0, Math.min(image.value.height, face.box.y2)), 3),
          }),
          detectionScore: round(face.score),
          faceAreaPct: round(q.area),
          matchScore: round(matchScore),
          centroidScore: round(centroidScore),
          top3MedianScore: round(median),
          bestReferenceScore: round(best),
          bestReferenceName: names[O.getOrElse(bestIndex, () => 0)] ?? "",
          qualityFlags: q.flags,
        })
      );
    }
    reported += faces.length;
    if (reported > 65536) return yield* error("input-limit-exceeded", "Reported face count exceeds 65536.");
    const best = faces.length === 0 ? O.none() : O.some(Math.max(...rawScores));
    let disposition: PersonMatchDisposition = "no-face";
    if (O.isSome(best))
      disposition =
        best.value >= options.matchThreshold
          ? faces.length > 1
            ? "group-match"
            : (faces[0]?.qualityFlags.length ?? 0) > 0
              ? "low-quality-match"
              : "solo-match"
          : best.value >= options.reviewThreshold
            ? "review"
            : "no-match";
    if (rejected && faces.length > 0) disposition = "review";
    entries.push(
      PersonMatchEntry.make({
        ...base,
        disposition,
        faceCount: faces.length,
        faces,
        ...(O.isSome(best) ? { bestScore: round(best.value) } : {}),
        ...(rejected ? { reason: "aligner-confidence-failed" } : {}),
      })
    );
  }
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
          packageName: "insightface",
          packageVersion: "1.0.1",
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
      batchSize: options.batchSize,
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
  const encoded = yield* S.encodeEffect(S.fromJsonString(PersonMatchWorkerSuccess))(report).pipe(
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
 * Live matcher layer that captures filesystem, paths, HTTP and secure randomness.
 *
 * **Example** (Provide the live matcher)
 *
 * ```ts
 * import { PersonMatchWorkerServiceLive } from "./MatchPerson.worker-service.ts"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(PersonMatchWorkerServiceLive))
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const PersonMatchWorkerServiceLive = Layer.effect(PersonMatchWorkerService, makeService());
