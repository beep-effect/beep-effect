import {
  alignFaceImage,
  decodeFaceImage,
  FaceImage,
  faceRuntimeVersion,
  makeFaceInference,
  normalizeFaceVector,
  openFaceSession,
} from "@beep/repo-cli/test/Files";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as ort from "onnxruntime-node";
import type { FaceSession } from "@beep/repo-cli/test/Files";

const image = FaceImage.make({ width: 3, height: 5, pixels: new Uint8Array(45).fill(127) });
const names = ["s8", "s16", "s32", "b8", "b16", "b32", "k8", "k16", "k32"];
const canned = (
  outputs: ort.InferenceSession.ReturnType,
  inputNames: ReadonlyArray<string> = [],
  outputNames: ReadonlyArray<string> = []
): FaceSession => ({
  inputNames,
  outputNames,
  run: () => Promise.resolve(outputs),
});
const detector = (count: number): FaceSession => {
  const scores = new Float32Array(count * 2).fill(0.9);
  const boxes = new Float32Array(count * 8).fill(0.1);
  return canned(
    { s8: new ort.Tensor("float32", scores, [scores.length]), b8: new ort.Tensor("float32", boxes, [count * 2, 4]) },
    [],
    names
  );
};
const recognizer = canned({ output: new ort.Tensor("float32", new Float32Array(512).fill(1), [1, 512]) });
const aligner = canned({ output: new ort.Tensor("float32", new Float32Array(16), [1, 16]) });

describe("model-free inference boundary cases", () => {
  it("normalizes empty, sparse, non-finite, tiny and huge vectors", () => {
    expect(normalizeFaceVector([])).toEqual([]);
    expect(normalizeFaceVector([0, 0])).toEqual([]);
    expect(normalizeFaceVector([Number.POSITIVE_INFINITY, 1])).toEqual([]);
    expect(normalizeFaceVector([Number.NaN])).toEqual([]);
    expect(normalizeFaceVector({ length: 2, 1: 3 })).toEqual([0, 1]);
    expect(normalizeFaceVector([Number.MIN_VALUE])).toEqual([1]);
    expect(normalizeFaceVector([Number.MAX_VALUE, -Number.MAX_VALUE])).toEqual([1 / Math.sqrt(2), -1 / Math.sqrt(2)]);
  });
  it("resamples odd and degenerate landmark geometry without non-finite bytes", () => {
    const crop = alignFaceImage([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ])(image);
    expect(crop.pixels.length).toBe(112 * 112 * 3);
    expect(A.every(A.fromIterable(crop.pixels), (pixel) => pixel === 0)).toBe(true);
  });
  it.effect("returns None for an unreadable image and a typed native model load error", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeFaceImage("/missing-photo-face-fixture.png");
      expect(O.isNone(decoded)).toBe(true);
      const error = yield* openFaceSession("/missing-photo-face-model.onnx").pipe(Effect.scoped, Effect.flip);
      expect(error.message).toBe("Could not load ONNX model.");
      const version = yield* faceRuntimeVersion();
      expect(version).toBe(ort.env.versions.node);
    })
  );
  it.effect("accepts empty and non-float detector output without inventing faces", () =>
    Effect.gen(function* () {
      for (const outputs of [{}, { s8: new ort.Tensor("int32", Int32Array.of(1), [1]) }]) {
        const inference = makeFaceInference(recognizer, O.none())(canned(outputs));
        const faces = yield* inference.detect(image, 0.5);
        expect(faces).toEqual([]);
      }
      const noScores = makeFaceInference(detector(1), recognizer, O.none());
      const faces = yield* noScores.detect(FaceImage.make({ width: 5, height: 3, pixels: new Uint8Array() }), 1);
      expect(faces).toEqual([]);
    })
  );
  it.effect("maps failed native inference and unexpected recognizer shapes to typed errors", () =>
    Effect.gen(function* () {
      const failed: FaceSession = {
        inputNames: [],
        outputNames: [],
        run: () => Promise.reject("synthetic runtime failure"),
      };
      const failure = yield* makeFaceInference(failed, recognizer, O.none()).detect(image, 0.5).pipe(Effect.flip);
      expect(failure.message).toBe("ONNX inference failed.");
      for (const output of [
        {},
        { output: new ort.Tensor("int32", Int32Array.of(1), [1]) },
        { output: new ort.Tensor("float32", Float32Array.of(1), [1]) },
      ]) {
        const error = yield* makeFaceInference(detector(1), canned(output), O.none())
          .detect(image, 0.5)
          .pipe(Effect.flip);
        expect(error.workerCode).toBe("missing-embedding");
      }
    })
  );
  it.effect("rejects extreme portrait and landscape aspect ratios before calling a session", () =>
    Effect.gen(function* () {
      for (const [width, height] of [
        [1, 1000],
        [1000, 1],
      ] satisfies ReadonlyArray<readonly [number, number]>) {
        const error = yield* makeFaceInference(detector(1), recognizer, O.none())
          .detect(FaceImage.make({ width, height, pixels: new Uint8Array() }), 0.5)
          .pipe(Effect.flip);
        expect(error.workerCode).toBe("worker-failed");
      }
    })
  );
  it.effect(
    "suppresses duplicate anchors, caps AdaFace by center rank and rejects Buffalo overflow",
    () =>
      Effect.gen(function* () {
        const large = FaceImage.make({ width: 640, height: 640, pixels: new Uint8Array(640 * 640 * 3) });
        const overflow = yield* makeFaceInference(detector(33), recognizer, O.none())
          .detect(large, 0.5)
          .pipe(Effect.flip);
        expect(overflow.workerCode).toBe("input-limit-exceeded");
        const faces = yield* makeFaceInference(detector(33), recognizer, O.some(aligner)).detect(large, 0.5);
        expect(faces.length).toBe(32);
        expect(faces[0]?.box.x1).toBeCloseTo(7.2, 5);
        expect(faces[31]?.box.x1).toBeCloseTo(255.2, 5);
        expect(O.isSome(faces[0]?.embedding ?? O.none())).toBe(true);
      }),
    { timeout: 30_000 }
  );
});
