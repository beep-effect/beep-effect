import {
  compileAdaFaceOnnx,
  decodeFaceImage,
  FaceDetectionBox,
  FaceImage,
  faceQualityForTesting,
  InferredFace,
  makeFaceInference,
  normalizeFaceVector,
  openFaceSession,
} from "@beep/repo-cli/test/Files";
import { it } from "@beep/test-runner";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import reference from "./fixtures/photo-face/python-reference.json" with { type: "json" };

const modelDirectory = Effect.runSync(Config.String("BEEP_PHOTO_FACE_PARITY_MODELS").pipe(Config.option));
const fixtureDirectory = new URL("./fixtures/photo-face/", import.meta.url);
const pins = [
  ["det_10g.onnx", "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91"],
  ["w600k_r50.onnx", "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43"],
  ["aligner.safetensors", "80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a"],
  ["recognizer.safetensors", "99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db"],
];

it.effect("rejects malformed safetensors before graph construction", () =>
  Effect.gen(function* () {
    const error = yield* compileAdaFaceOnnx(Uint8Array.of(1, 2, 3), "aligner").pipe(Effect.flip);
    expect(error._tag).toBe("MatchPersonModelIntegrityError");
  })
);
it("normalizes face vectors without changing direction", () => {
  expect(normalizeFaceVector([3, 4])).toEqual([0.6, 0.8]);
});

it("retains negative detector geometry until report clipping and measures the clipped area", () => {
  const image = FaceImage.make({ width: 112, height: 112, pixels: new Uint8Array(112 * 112 * 3) });
  const face = InferredFace.make({
    box: FaceDetectionBox.make({ x1: -5, y1: -5, x2: 112, y2: 112 }),
    score: 1,
    confidence: 1,
    embedding: O.none(),
    landmarks: [
      [38.2946, 51.6963],
      [73.5318, 51.5014],
      [56.0252, 71.7366],
      [41.5493, 92.3655],
      [70.7299, 92.2041],
    ],
  });
  expect(face.box.x1).toBe(-5);
  const quality = faceQualityForTesting(image, face, 0.5);
  expect(quality.area).toBe(100);
  expect(quality.flags).toEqual(["blurry", "too-dark"]);
});

describe.skipIf(O.isNone(modelDirectory))("pinned model parity against Python", () => {
  it.layer(NodeServices.layer)((it) => {
    it.effect(
      "matches saved embeddings, boxes, detector and quality scores for both backends",
      () =>
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = O.getOrElse(modelDirectory, () => "");
            for (const [filename, expected] of pins) {
              const data = yield* fs.readFile(path.join(root, filename ?? ""));
              expect(Hex.encode(sha256(data))).toBe(expected);
            }
            const temporary = yield* fs.makeTempDirectoryScoped();
            for (const component of ["aligner", "recognizer"] satisfies ReadonlyArray<"aligner" | "recognizer">) {
              const source = yield* fs.readFile(path.join(root, `${component}.safetensors`));
              const model = yield* compileAdaFaceOnnx(source, component);
              yield* fs.writeFile(path.join(temporary, `${component}.onnx`), model);
            }
            const detector = yield* openFaceSession(path.join(root, "det_10g.onnx"));
            const aligner = yield* openFaceSession(path.join(temporary, "aligner.onnx"));
            for (const backend of ["buffalo-l", "adaface-kprpe"] satisfies ReadonlyArray<
              "buffalo-l" | "adaface-kprpe"
            >) {
              const recognizer = yield* openFaceSession(
                backend === "buffalo-l" ? path.join(root, "w600k_r50.onnx") : path.join(temporary, "recognizer.onnx")
              );
              const inference = makeFaceInference(
                detector,
                recognizer,
                backend === "buffalo-l" ? O.none() : O.some(aligner)
              );
              const blank = FaceImage.make({ width: 32, height: 32, pixels: new Uint8Array(32 * 32 * 3) });
              const noFaces = yield* inference.detect(blank, 0.5);
              expect(noFaces).toEqual([]);
              for (const fixture of reference.fixtures) {
                const image = yield* decodeFaceImage(new URL(fixture.image, fixtureDirectory).pathname);
                if (O.isNone(image)) return yield* Effect.die(`Fixture cannot decode: ${fixture.image}`);
                const faces = yield* inference.detect(image.value, 0.5);
                const expected = fixture.backends[backend];
                expect(faces.length).toBe(expected.length);
                for (const [face, recorded] of A.zip(faces, expected)) {
                  if (O.isNone(face.embedding) || recorded.embedding === null)
                    return yield* Effect.die("Fixture unexpectedly rejected.");
                  const cosine = A.reduce(
                    A.zip(face.embedding.value, recorded.embedding),
                    0,
                    (sum, [a, b]) => sum + a * b
                  );
                  expect(cosine).toBeGreaterThanOrEqual(0.999);
                  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = recorded.box;
                  const intersection =
                    Math.max(0, Math.min(x2, face.box.x2) - Math.max(x1, face.box.x1)) *
                    Math.max(0, Math.min(y2, face.box.y2) - Math.max(y1, face.box.y1));
                  const union =
                    (x2 - x1) * (y2 - y1) + (face.box.x2 - face.box.x1) * (face.box.y2 - face.box.y1) - intersection;
                  expect(intersection / union).toBeGreaterThanOrEqual(0.998);
                  expect(Math.abs(face.score - recorded.score)).toBeLessThan(0.001);
                  expect(Math.abs(face.confidence - recorded.confidence)).toBeLessThan(0.00001);
                  const quality = faceQualityForTesting(image.value, face, 0.5);
                  expect(quality.flags).toEqual(recorded.quality.flags);
                  expect(Math.abs(quality.area - recorded.quality.area)).toBeLessThan(0.005);
                  expect(Math.abs(quality.brightness - recorded.quality.brightness)).toBeLessThan(0.05);
                  expect(
                    Math.abs(quality.blurVariance - recorded.quality.blurVariance) / recorded.quality.blurVariance
                  ).toBeLessThan(0.05);
                }
              }
            }
          })
        ),
      60_000
    );
  });
});
