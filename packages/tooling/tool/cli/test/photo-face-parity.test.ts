import {
  collectReferencesForTesting,
  compileAdaFaceOnnx,
  compiledGraphForTesting,
  decodeFaceImage,
  FaceDetectionBox,
  FaceImage,
  faceQualityForTesting,
  InferredFace,
  MatchPersonOptions,
  makeFaceInference,
  normalizeFaceVector,
  openFaceSession,
  preparePersonMatchOnnxModels,
} from "@beep/repo-cli/test/Files";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, expect } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import reference from "./fixtures/photo-face/python-reference.json" with { type: "json" };
import type { PersonMatchBackend } from "@beep/repo-cli/test/Files";
import type { InferenceSession } from "onnxruntime-node";

const modelDirectory = Effect.runSync(Config.String("BEEP_PHOTO_FACE_PARITY_MODELS").pipe(Config.option));
const nativeModelLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => Effect.die(`Unexpected model download: ${request.url}`))
  )
);
const fixtureDirectory = new URL("./fixtures/photo-face/", import.meta.url);
// Native path for a fixture: URL.pathname keeps percent-escapes and a leading slash on Windows drives.
const fixturePath = Effect.fnUntraced(function* (name: string) {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL(name, fixtureDirectory));
});
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

it.layer(nativeModelLayer)((it) => {
  it.effect("rejects only the zero-magnitude reference and retains valid identity evidence", () =>
    Effect.gen(function* () {
      const options = MatchPersonOptions.make({
        dir: "/images",
        references: "/refs",
        manifest: "/report.json",
        backend: "buffalo-l",
        detectionThreshold: 0.5,
        matchThreshold: 0.5,
        reviewThreshold: 0.4,
        minFaceAreaPct: 0.5,
      });
      let calls = 0;
      const inference = {
        detect: Effect.fnUntraced(function* () {
          const embedding = normalizeFaceVector(calls++ === 0 ? [0, 0] : [3, 4]);
          return [
            InferredFace.make({
              box: FaceDetectionBox.make({ x1: 0, y1: 0, x2: 10, y2: 10 }),
              score: 0.9,
              confidence: 1,
              landmarks: [
                [1, 1],
                [2, 1],
                [1.5, 2],
                [1, 3],
                [2, 3],
              ],
              embedding: O.some(embedding),
            }),
          ];
        }),
      };
      const result = yield* collectReferencesForTesting(
        [yield* fixturePath("astronaut.png"), yield* fixturePath("astronaut-small.png")],
        inference,
        options
      );
      expect(result.references[0]?.reason).toBe("invalid-embedding");
      expect(result.references[1]?.accepted).toBe(true);
      expect(result.vectors).toEqual([[0.6, 0.8]]);
    })
  );
});

const assertFaceParity = (
  image: FaceImage,
  face: InferredFace,
  recorded: (typeof reference)["fixtures"][number]["backends"]["buffalo-l"][number]
): void => {
  if (O.isNone(face.embedding)) assert.fail("Fixture unexpectedly rejected.");
  const cosine = A.reduce(A.zip(face.embedding.value, recorded.embedding), 0, (sum, [a, b]) => sum + a * b);
  expect(cosine).toBeGreaterThanOrEqual(0.999);
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = recorded.box;
  const intersection =
    Math.max(0, Math.min(x2, face.box.x2) - Math.max(x1, face.box.x1)) *
    Math.max(0, Math.min(y2, face.box.y2) - Math.max(y1, face.box.y1));
  const union = (x2 - x1) * (y2 - y1) + (face.box.x2 - face.box.x1) * (face.box.y2 - face.box.y1) - intersection;
  expect(intersection / union).toBeGreaterThanOrEqual(0.998);
  expect(Math.abs(face.score - recorded.score)).toBeLessThan(0.001);
  expect(Math.abs(face.confidence - recorded.confidence)).toBeLessThan(0.00001);
  const quality = faceQualityForTesting(image, face, 0.5);
  expect(quality.flags).toEqual(recorded.quality.flags);
  expect(Math.abs(quality.area - recorded.quality.area)).toBeLessThan(0.005);
  expect(Math.abs(quality.brightness - recorded.quality.brightness)).toBeLessThan(0.05);
  expect(Math.abs(quality.blurVariance - recorded.quality.blurVariance) / recorded.quality.blurVariance).toBeLessThan(
    0.005
  );
};
const compareBackendFixtures = Effect.fnUntraced(function* (
  backend: PersonMatchBackend,
  detector: InferenceSession,
  aligner: InferenceSession,
  temporary: string
) {
  const path = yield* Path.Path;
  const root = O.getOrElse(modelDirectory, () => "");

  const recognizer = yield* openFaceSession(
    backend === "buffalo-l" ? path.join(root, "w600k_r50.onnx") : path.join(temporary, "recognizer.onnx")
  );
  const inference = makeFaceInference(detector, recognizer, backend === "buffalo-l" ? O.none() : O.some(aligner));
  const blank = FaceImage.make({ width: 32, height: 32, pixels: new Uint8Array(32 * 32 * 3) });
  const noFaces = yield* inference.detect(blank, 0.5);
  expect(noFaces).toEqual([]);
  for (const fixture of reference.fixtures) {
    const imagePath = yield* fixturePath(fixture.image);
    const image = yield* decodeFaceImage(imagePath).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.die(`Fixture cannot decode: ${fixture.image}`),
          onSome: Effect.succeed,
        })
      )
    );
    const faces = yield* inference.detect(image, 0.5);
    const expected = fixture.backends[backend];
    expect(faces.length).toBe(expected.length);
    for (const [face, recorded] of A.zip(faces, expected)) {
      assertFaceParity(image, face, recorded);
    }
  }
});
describe.skipIf(O.isNone(modelDirectory))("pinned model parity against Python", () => {
  it.layer(nativeModelLayer)((it) => {
    it.effect(
      "shares one cache across AdaFace then Buffalo and repairs interrupted model writes",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = O.getOrElse(modelDirectory, () => "");
          const cache = yield* fs.makeTempDirectoryScoped();
          yield* fs.copyFile(path.join(root, "buffalo_l.zip"), path.join(cache, "buffalo_l.zip"));
          for (const component of ["aligner", "recognizer"]) {
            const directory = path.join(cache, "pinned", component);
            yield* fs.makeDirectory(directory, { recursive: true });
            yield* fs.copyFile(path.join(root, `${component}.safetensors`), path.join(directory, "model.safetensors"));
          }
          const ada = yield* preparePersonMatchOnnxModels(cache, "adaface-kprpe");
          const hasBuffalo = yield* fs.exists(ada.recognizerPath);
          expect(hasBuffalo).toBe(false);
          const before = yield* fs.stat(ada.detectorPath);
          const buffalo = yield* preparePersonMatchOnnxModels(cache, "buffalo-l");
          const after = yield* fs.stat(buffalo.detectorPath);
          expect(after.mtime).toEqual(before.mtime);
          const installed = yield* fs.readFile(buffalo.recognizerPath);
          expect(Hex.encode(sha256(installed))).toBe(pins[1]?.[1]);
          yield* fs.writeFile(buffalo.recognizerPath, Uint8Array.of(1, 2, 3));
          yield* preparePersonMatchOnnxModels(cache, "buffalo-l");
          const repaired = yield* fs.readFile(buffalo.recognizerPath);
          expect(Hex.encode(sha256(repaired))).toBe(pins[1]?.[1]);
        }),
      60_000
    );
    it.effect(
      "repairs a truncated generated graph and publishes concurrent compiles atomically",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = O.getOrElse(modelDirectory, () => "");
          const cache = yield* fs.makeTempDirectoryScoped();
          const source = path.join(root, "aligner.safetensors");
          const target = yield* compiledGraphForTesting(source, cache, "aligner");
          const expected = yield* fs.readFile(target);
          yield* fs.writeFile(target, Uint8Array.of(1, 2, 3));
          const results = yield* Effect.all(
            [compiledGraphForTesting(source, cache, "aligner"), compiledGraphForTesting(source, cache, "aligner")],
            { concurrency: 2 }
          );
          expect(results).toEqual([target, target]);
          const repaired = yield* fs.readFile(target);
          expect(repaired).toEqual(expected);
          const session = yield* openFaceSession(target);
          expect(session.inputNames).toContain("images");
        }),
      60_000
    );
    it.effect(
      "matches saved embeddings, boxes, detector and quality scores for both backends",
      () =>
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
          for (const backend of ["buffalo-l", "adaface-kprpe"] satisfies ReadonlyArray<"buffalo-l" | "adaface-kprpe">) {
            yield* compareBackendFixtures(backend, detector, aligner, temporary);
          }
        }),
      60_000
    );
  });
});
