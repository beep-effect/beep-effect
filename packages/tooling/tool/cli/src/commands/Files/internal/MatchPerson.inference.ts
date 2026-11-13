/**
 * CPU face inference, image resampling and SCRFD decoding.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { PosInt } from "@beep/repo-cli-kit/schema/PosInt";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import sharp from "sharp";
import { MatchPersonError } from "./MatchPerson.errors.ts";
import type * as ort from "onnxruntime-node";
import type { MatchPersonRuntimeError } from "./MatchPerson.errors.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.inference");
const Point = S.Tuple([S.Finite, S.Finite]);
/**
 * Unclipped detector geometry, including coordinates outside the image.
 *
 * **Example** (Represent a face crossing the image edge)
 * ```ts
 * import { FaceDetectionBox } from "@beep/repo-cli/test/Files"
 * const box = FaceDetectionBox.make({ x1: -5, y1: 2, x2: 80, y2: 100 })
 * console.log(box.x1) // -5
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class FaceDetectionBox extends S.Opaque<FaceDetectionBox, { readonly brand: unique symbol }>()(
  S.Struct({ x1: S.Finite, y1: S.Finite, x2: S.Finite, y2: S.Finite }).pipe(
    $I.annoteSchema("FaceDetectionBox", { description: "Raw SCRFD box before clipping to report coordinates." })
  )
) {}

/**
 * Decoded RGB pixels admitted under the image-size limit.
 *
 * **Example** (Construct a decoded image)
 *
 * ```ts
 * import { FaceImage } from "@beep/repo-cli/test/Files"
 * const image = FaceImage.make({ width: 1, height: 1, pixels: Uint8Array.of(255, 255, 255) })
 * console.log(image.width)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class FaceImage extends S.Opaque<FaceImage, { readonly brand: unique symbol }>()(
  S.Struct({
    width: PosInt,
    height: PosInt,
    pixels: S.Uint8Array,
  }).pipe($I.annoteSchema("FaceImage", { description: "Bounded decoded RGB image with no alpha channel." }))
) {}
/**
 * Detector geometry, confidence and an optional normalized identity embedding.
 *
 * **Example** (Describe an unrecognized detection)
 *
 * ```ts
 * import { InferredFace, FaceDetectionBox } from "@beep/repo-cli/test/Files"
 * import * as O from "effect/Option"
 * const face = InferredFace.make({ box: FaceDetectionBox.make({ x1: 0, y1: 0, x2: 10, y2: 10 }), score: 0.9, landmarks: [], embedding: O.none(), confidence: 0 })
 * console.log(O.isNone(face.embedding))
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class InferredFace extends S.Opaque<InferredFace, { readonly brand: unique symbol }>()(
  S.Struct({
    box: FaceDetectionBox,
    score: S.Finite,
    landmarks: S.Array(Point),
    embedding: S.Array(S.Finite).pipe(S.Option),
    confidence: S.Finite,
  }).pipe(
    $I.annoteSchema("InferredFace", {
      description: "A SCRFD detection with five keypoints and optional accepted embedding.",
    })
  )
) {}
/**
 * Service contract for detecting faces and computing identity embeddings in memory.
 *
 * **Example** (Access the inference operation)
 *
 * ```ts
 * import { PersonMatchInference } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * const operation = PersonMatchInference.use((service) => Effect.succeed(service.detect))
 * console.log(operation)
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class PersonMatchInference extends Context.Service<
  PersonMatchInference,
  {
    readonly detect: (
      image: FaceImage,
      threshold: number
    ) => Effect.Effect<ReadonlyArray<InferredFace>, MatchPersonRuntimeError>;
  }
>()($I`PersonMatchInference`) {}

const loadRuntime = Effect.fn("Files.loadFaceRuntime")(() =>
  Effect.tryPromise({
    try: () => import("onnxruntime-node"),
    catch: (cause) => MatchPersonError.runtime("Could not load native CPU ONNX Runtime.", cause),
  })
);

const failure = (message: string, cause?: unknown) => MatchPersonError.runtime(message, cause);
/**
 * Decode a supported image as RGB, returning None for corrupt or oversized input.
 *
 * **Example** (Build a decode effect)
 *
 * ```ts
 * import { decodeFaceImage } from "@beep/repo-cli/test/Files"
 * const decoded = decodeFaceImage("/photos/reference.png")
 * console.log(decoded)
 * ```
 *
 * @param path - Image file to decode.
 * @returns An optional image; decoder failures are image-level rejections.
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const decodeFaceImage = Effect.fn("Files.decodeFaceImage")((path: string) =>
  Effect.tryPromise({
    try: () =>
      sharp(path, { limitInputPixels: 100_000_000, failOn: "error" })
        .rotate()
        .removeAlpha()
        .toColourspace("srgb")
        .raw()
        .toBuffer({ resolveWithObject: true }),
    catch: (cause) => failure("Could not decode image.", cause),
  }).pipe(
    Effect.map(({ data, info }) => FaceImage.make({ pixels: data, width: info.width, height: info.height })),
    Effect.option
  )
);

const at = (values: ArrayLike<number>, i: number) => values[i] ?? 0;
/**
 * Scale a vector to unit length before cosine comparison.
 *
 * **Example** (Normalize a two-dimensional vector)
 *
 * ```ts
 * import { normalizeFaceVector } from "@beep/repo-cli/test/Files"
 * console.log(normalizeFaceVector([3, 4])) // [0.6, 0.8]
 * ```
 *
 * @param values - Finite embedding components with nonzero magnitude.
 * @returns The normalized components; callers reject non-finite output.
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const normalizeFaceVector = (values: ArrayLike<number>): ReadonlyArray<number> => {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += at(values, i) ** 2;
  const magnitude = Math.sqrt(sum);
  return A.makeBy(values.length, (i) => at(values, i) / magnitude);
};
// OpenCV-compatible inverse affine resampling with black borders.
const warpFace = (image: FaceImage, transform: ReadonlyArray<number>, side = 112): FaceImage => {
  const [a = 1, b = 0, tx = 0, c = 0, d = 1, ty = 0] = transform;
  const det = a * d - b * c;
  const pixels = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      // OpenCV INTER_LINEAR uses a 32-entry interpolation table.
      const sx = Math.round(((d * (x - tx) - b * (y - ty)) / det) * 32) / 32;
      const sy = Math.round(((-c * (x - tx) + a * (y - ty)) / det) * 32) / 32;
      const ix = Math.floor(sx);
      const floorY = Math.floor(sy);
      const dx = sx - ix;
      const dy = sy - floorY;
      for (let channel = 0; channel < 3; channel++) {
        let value = 0;
        for (let yy = 0; yy < 2; yy++)
          for (let xx = 0; xx < 2; xx++) {
            if (ix + xx < 0 || ix + xx >= image.width || floorY + yy < 0 || floorY + yy >= image.height) continue;
            value +=
              at(image.pixels, ((floorY + yy) * image.width + ix + xx) * 3 + channel) *
              (xx === 0 ? 1 - dx : dx) *
              (yy === 0 ? 1 - dy : dy);
          }
        pixels[(y * side + x) * 3 + channel] = Math.round(value);
      }
    }
  return FaceImage.make({ width: side, height: side, pixels });
};
/**
 * Fit the five detector landmarks to the ArcFace template and resample a 112x112 crop.
 *
 * **Example** (Align a detected face)
 *
 * ```ts
 * import { FaceImage, alignFaceImage } from "@beep/repo-cli/test/Files"
 * const image = FaceImage.make({ width: 112, height: 112, pixels: new Uint8Array(112 * 112 * 3) })
 * const crop = alignFaceImage(image, [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]])
 * console.log(crop.width) // 112
 * ```
 *
 * @param image - Original decoded RGB pixels.
 * @param points - Five eye, nose and mouth landmark coordinates.
 * @returns The geometrically aligned RGB crop.
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const alignFaceImage: {
  (image: FaceImage, points: ReadonlyArray<readonly [number, number]>): FaceImage;
  (points: ReadonlyArray<readonly [number, number]>): (image: FaceImage) => FaceImage;
} = dual(2, (image: FaceImage, points: ReadonlyArray<readonly [number, number]>): FaceImage => {
  const target = [
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
  ];
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < 5; i++) {
    sx += points[i]?.[0] ?? 0;
    sy += points[i]?.[1] ?? 0;
    dx += target[i]?.[0] ?? 0;
    dy += target[i]?.[1] ?? 0;
  }
  sx /= 5;
  sy /= 5;
  dx /= 5;
  dy /= 5;
  let aa = 0;
  let bb = 0;
  let denominator = 0;
  for (let i = 0; i < 5; i++) {
    const x = (points[i]?.[0] ?? 0) - sx;
    const y = (points[i]?.[1] ?? 0) - sy;
    const u = (target[i]?.[0] ?? 0) - dx;
    const v = (target[i]?.[1] ?? 0) - dy;
    aa += x * u + y * v;
    bb += x * v - y * u;
    denominator += x * x + y * y;
  }
  const a = aa / denominator;
  const b = bb / denominator;
  return warpFace(image, [a, -b, dx - a * sx + b * sy, b, a, dy - b * sx - a * sy]);
});
const squareCrop = (image: FaceImage, box: FaceDetectionBox) => {
  const x1 = Math.max(0, Math.min(image.width, box.x1));
  const x2 = Math.max(0, Math.min(image.width, box.x2));
  const y1 = Math.max(0, Math.min(image.height, box.y1));
  const y2 = Math.max(0, Math.min(image.height, box.y2));
  const side = Math.max(x2 - x1, y2 - y1) * 1.5;
  const scale = 112 / side;
  return warpFace(image, [scale, 0, (-(x1 + x2 - side) / 2) * scale, 0, scale, (-(y1 + y2 - side) / 2) * scale]);
};
const channels = (image: FaceImage, mean: number, scale: number) => {
  const values = new Float32Array(image.width * image.height * 3);
  const plane = image.width * image.height;
  for (let i = 0; i < plane; i++)
    for (let c = 0; c < 3; c++) values[c * plane + i] = (at(image.pixels, i * 3 + c) - mean) / scale;
  return values;
};
const outputValues = (output: ort.InferenceSession.ReturnType, name: string): Float32Array => {
  const tensor = output[name];
  return tensor?.data instanceof Float32Array ? tensor.data : new Float32Array();
};
const run = (session: ort.InferenceSession, inputs: ort.InferenceSession.FeedsType) =>
  Effect.tryPromise({
    try: () => session.run(inputs),
    catch: (cause) => failure("ONNX inference failed.", cause),
  });
const iou = (a: FaceDetectionBox, b: FaceDetectionBox) => {
  const intersection =
    Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) + 1) *
    Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) + 1);
  return intersection / ((a.x2 - a.x1 + 1) * (a.y2 - a.y1 + 1) + (b.x2 - b.x1 + 1) * (b.y2 - b.y1 + 1) - intersection);
};
const faceOrder = Order.mapInput(Num.Order, (f: InferredFace) => -f.score);
const positionOrder = Order.combineAll([
  Order.mapInput(Num.Order, (f: InferredFace) => f.box.y1),
  Order.mapInput(Num.Order, (f: InferredFace) => f.box.x1),
  Order.mapInput(Num.Order, (f: InferredFace) => f.box.y2),
  Order.mapInput(Num.Order, (f: InferredFace) => f.box.x2),
  faceOrder,
]);
/**
 * Acquire a CPU ONNX session and release native resources when its scope ends.
 *
 * **Example** (Scope a model session)
 *
 * ```ts
 * import { openFaceSession } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * const session = Effect.scoped(openFaceSession("/cache/det_10g.onnx"))
 * console.log(session)
 * ```
 *
 * @param path - Verified local ONNX model path.
 * @returns A session owned by the surrounding Effect scope.
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const openFaceSession = Effect.fn("Files.openFaceSession")((path: string) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        import("onnxruntime-node").then((runtime) =>
          runtime.InferenceSession.create(path, { executionProviders: ["cpu"], intraOpNumThreads: 4 })
        ),
      catch: (cause) => failure("Could not load ONNX model.", cause),
    }),
    (session) => Effect.promise(() => session.release())
  )
);
// Compose the fixed CPU detector and recognition sessions.
const makeFaceInferenceImpl = (
  detector: ort.InferenceSession,
  recognizer: ort.InferenceSession,
  aligner: O.Option<ort.InferenceSession>
) =>
  PersonMatchInference.of({
    detect: Effect.fn("Files.PersonMatchInference.detect")(function* (image, threshold) {
      const runtime = yield* loadRuntime();
      const ratio = Math.min(640 / image.width, 640 / image.height);
      const width = Math.floor(image.width * ratio);
      const height = Math.floor(image.height * ratio);
      const resized = new Uint8Array(width * height * 3);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const sx = Math.max(0, Math.min(image.width - 1, ((x + 0.5) * image.width) / width - 0.5));
          const sy = Math.max(0, Math.min(image.height - 1, ((y + 0.5) * image.height) / height - 0.5));
          const ix = Math.floor(sx);
          const floorY = Math.floor(sy);
          const dx = sx - ix;
          const dy = sy - floorY;
          for (let c = 0; c < 3; c++) {
            let v = 0;
            for (let yy = 0; yy < 2; yy++)
              for (let xx = 0; xx < 2; xx++)
                v +=
                  at(
                    image.pixels,
                    (Math.min(image.height - 1, floorY + yy) * image.width + Math.min(image.width - 1, ix + xx)) * 3 + c
                  ) *
                  (xx === 0 ? 1 - dx : dx) *
                  (yy === 0 ? 1 - dy : dy);
            resized[(y * width + x) * 3 + c] = Math.round(v);
          }
        }
      const plane = 640 * 640;
      const values = new Float32Array(plane * 3);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          for (let c = 0; c < 3; c++)
            values[c * plane + y * 640 + x] = (at(resized, (y * width + x) * 3 + c) - 127.5) / 128;
      // Padded detector pixels are black before normalization.
      for (let y = 0; y < 640; y++)
        for (let x = 0; x < 640; x++)
          if (y >= height || x >= width) for (let c = 0; c < 3; c++) values[c * plane + y * 640 + x] = -127.5 / 128;
      const outputs = yield* run(detector, {
        [detector.inputNames[0] ?? "input.1"]: new runtime.Tensor("float32", values, [1, 3, 640, 640]),
      });
      const detections: Array<InferredFace> = [];
      for (let level = 0; level < 3; level++) {
        const stride = 8 * 2 ** level;
        const size = 640 / stride;
        const scores = outputValues(outputs, detector.outputNames[level] ?? "");
        const boxes = outputValues(outputs, detector.outputNames[level + 3] ?? "");
        const landmarks = outputValues(outputs, detector.outputNames[level + 6] ?? "");
        for (let i = 0; i < scores.length; i++) {
          const score = at(scores, i);
          if (score < threshold) continue;
          const cx = (Math.floor(i / 2) % size) * stride;
          const cy = Math.floor(Math.floor(i / 2) / size) * stride;
          const scale = image.height / height;
          const box = FaceDetectionBox.make({
            x1: (cx - at(boxes, i * 4) * stride) * scale,
            y1: (cy - at(boxes, i * 4 + 1) * stride) * scale,
            x2: (cx + at(boxes, i * 4 + 2) * stride) * scale,
            y2: (cy + at(boxes, i * 4 + 3) * stride) * scale,
          });
          detections.push(
            InferredFace.make({
              box,
              score,
              landmarks: A.makeBy(5, (j): readonly [number, number] => [
                (cx + at(landmarks, i * 10 + j * 2) * stride) * scale,
                (cy + at(landmarks, i * 10 + j * 2 + 1) * stride) * scale,
              ]),
              embedding: O.none(),
              confidence: 1,
            })
          );
        }
      }
      const kept: Array<InferredFace> = [];
      for (const face of A.sort(detections, faceOrder))
        if (A.every(kept, (other) => iou(face.box, other.box) <= 0.4)) kept.push(face);
      // AdaFace's detector max_num=32 chooses area minus twice squared center distance.
      const selected =
        O.isSome(aligner) && kept.length > 32
          ? A.take(
              A.sort(
                kept,
                Order.mapInput(
                  Num.Order,
                  (f: InferredFace) =>
                    -(
                      (f.box.x2 - f.box.x1) * (f.box.y2 - f.box.y1) -
                      2 *
                        (((f.box.x1 + f.box.x2) / 2 - image.width / 2) ** 2 +
                          ((f.box.y1 + f.box.y2) / 2 - image.height / 2) ** 2)
                    )
                )
              ),
              32
            )
          : kept;
      if (selected.length > 32)
        return yield* MatchPersonError.runtimeFromWorker(
          "input-limit-exceeded",
          "Detected more than 32 faces in one image."
        );
      return yield* Effect.forEach(
        A.sort(selected, positionOrder),
        Effect.fnUntraced(function* (face) {
          const crop = O.isSome(aligner) ? squareCrop(image, face.box) : alignFaceImage(image, face.landmarks);
          const tensor = channels(crop, 127.5, 127.5);
          let confidence = 1;
          let keypoints: ReadonlyArray<number> = [];
          if (O.isSome(aligner)) {
            // torch interpolate(..., align_corners=True), followed by RGB -> BGR.
            const aligned = new Float32Array(3 * 160 * 160);
            for (let c = 0; c < 3; c++)
              for (let y = 0; y < 160; y++)
                for (let x = 0; x < 160; x++) {
                  const sx = (x * 111) / 159;
                  const sy = (y * 111) / 159;
                  const ix = Math.floor(sx);
                  const floorY = Math.floor(sy);
                  const dx = sx - ix;
                  const dy = sy - floorY;
                  let v = 0;
                  for (let yy = 0; yy < 2; yy++)
                    for (let xx = 0; xx < 2; xx++)
                      v +=
                        at(tensor, (2 - c) * 112 * 112 + Math.min(111, floorY + yy) * 112 + Math.min(111, ix + xx)) *
                        (xx === 0 ? 1 - dx : dx) *
                        (yy === 0 ? 1 - dy : dy);
                  aligned[c * 160 * 160 + y * 160 + x] = v;
                }
            const alignerOutput = yield* run(aligner.value, {
              images: new runtime.Tensor("float32", aligned, [1, 3, 160, 160]),
            });
            const merged = outputValues(alignerOutput, "output");
            confidence = 1 / (1 + Math.exp(at(merged, 4) - at(merged, 5)));
            keypoints = A.makeBy(10, (i) => at(merged, i + 6));
          }
          if (confidence < 0.2) return InferredFace.make({ ...face, confidence, embedding: O.none() });
          const output = yield* run(recognizer, {
            [recognizer.inputNames[0] ?? "images"]: new runtime.Tensor("float32", tensor, [1, 3, 112, 112]),
            ...(O.isSome(aligner)
              ? { keypoints: new runtime.Tensor("float32", Float32Array.from(keypoints), [1, 5, 2]) }
              : {}),
          });
          const vector = outputValues(output, recognizer.outputNames[0] ?? "output");
          if (vector.length !== 512)
            return yield* MatchPersonError.runtimeFromWorker(
              "missing-embedding",
              "Recognizer returned an unexpected embedding shape."
            );
          const embedding = normalizeFaceVector(vector);
          if (A.some(embedding, (n) => !Number.isFinite(n)))
            return yield* MatchPersonError.runtimeFromWorker(
              "missing-embedding",
              "Recognizer returned an invalid embedding."
            );
          return InferredFace.make({ ...face, confidence, embedding: O.some(embedding) });
        }),
        { concurrency: 1 }
      );
    }),
  });

/**
 * Compose detector and recognition sessions, with an optional DFA aligner for AdaFace.
 *
 * **Example** (Compose Buffalo inference)
 *
 * ```ts
 * import { openFaceSession, makeFaceInference } from "@beep/repo-cli/test/Files"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * const inference = Effect.scoped(Effect.gen(function* () {
 *   const detector = yield* openFaceSession("/cache/det_10g.onnx")
 *   const recognizer = yield* openFaceSession("/cache/w600k_r50.onnx")
 *   return makeFaceInference(detector, recognizer, O.none())
 * }))
 * console.log(inference)
 * ```
 *
 * @param detector - Scoped SCRFD detector session.
 * @param recognizer - Scoped embedding session.
 * @param aligner - DFA session for AdaFace, or None for Buffalo.
 * @returns The inference service implementation.
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const makeFaceInference: {
  (
    detector: ort.InferenceSession,
    recognizer: ort.InferenceSession,
    aligner: O.Option<ort.InferenceSession>
  ): Context.Service.Shape<typeof PersonMatchInference>;
  (
    recognizer: ort.InferenceSession,
    aligner: O.Option<ort.InferenceSession>
  ): (detector: ort.InferenceSession) => Context.Service.Shape<typeof PersonMatchInference>;
} = dual(3, makeFaceInferenceImpl);

/**
 * Load native ONNX Runtime only when face matching is requested.
 *
 * **Example** (Build a runtime provenance effect)
 * ```ts
 * import { faceRuntimeVersion } from "./MatchPerson.inference.ts"
 * const version = faceRuntimeVersion()
 * console.log(version)
 * ```
 * @returns The actual native package version, or a typed runtime load error.
 * @internal
 * @category inference
 * @since 0.0.0
 */
export const faceRuntimeVersion = Effect.fn("Files.faceRuntimeVersion")(function* () {
  const runtime = yield* loadRuntime();
  const version = O.fromUndefinedOr(runtime.env.versions.node);
  if (O.isNone(version))
    return yield* MatchPersonError.runtime("ONNX Runtime did not report its native package version.");
  return version.value;
});
