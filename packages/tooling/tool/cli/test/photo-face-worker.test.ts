import { fcRuns } from "@beep/fc-runs";
import { $RepoCliId } from "@beep/identity/packages";
import {
  BuffaloArtifactPins,
  CanonicalMatchPersonInputs,
  compiledGraphForTesting,
  decodePersonMatchWorkerReportJson,
  encodePersonMatchReport,
  MatchPersonError,
  MatchPersonOptions,
  normalizeFaceVector,
  PersonMatchBuffaloPins,
  PersonMatchGraphCompiler,
  PersonMatchGraphPins,
  PersonMatchGraphSourcePins,
  PersonMatchModelArtifactVerifier,
  PersonMatchOnnxResources,
  PersonMatchWorkerService,
  PersonMatchWorkerServiceLayer,
  PersonMatchWorkerSuccess,
  PreparedAdaFaceArtifacts,
  PreparedOnnxModels,
  preparePersonMatchOnnxModels,
  toFilesCommandError,
  writePersonMatchModelBytes,
} from "@beep/repo-cli/test/Files";
import { PosInt } from "@beep/repo-cli-kit/schema/PosInt";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { zipSync } from "fflate";
import { Tensor } from "onnxruntime-node";
import sharp from "sharp";
import type { FaceSession } from "@beep/repo-cli/test/Files";

const $I = $RepoCliId.create("test/photo-face-worker");
const nativeLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => Effect.die(`Unexpected download: ${request.url}`))
  )
);
class Frame extends S.Opaque<Frame, { readonly brand: unique symbol }>()(
  S.Struct({
    count: S.Int,
    confidence: S.Array(S.Finite),
    vector: S.Array(S.Finite),
  }).pipe($I.annoteSchema("Frame", { description: "Canned SCRFD/recognizer/DFA output for one decoded image." }))
) {}
const frame = (count = 1, vector: ReadonlyArray<number> = [1, 0], confidence: ReadonlyArray<number> = [1, 1]) =>
  Frame.make({ count, vector, confidence });
const encodeRecordedWorker = S.encodeEffect(S.fromJsonString(PersonMatchWorkerSuccess));
const outputs = ["s8", "s16", "s32", "b8", "b16", "b32", "k8", "k16", "k32"];
const template: ReadonlyArray<readonly [number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];
const populateAnchor = (
  count: number,
  n: number,
  scores: Float32Array,
  boxes: Float32Array,
  landmarks: Float32Array
): void => {
  const column = count === 1 ? 40 : 10 + (n % 8) * 8;
  const row = count === 1 ? 40 : 10 + Math.floor(n / 8) * 8;
  const anchor = (row * 80 + column) * 2;
  scores[anchor] = 0.95;
  for (let i = 0; i < 4; i++) boxes[anchor * 4 + i] = count === 1 ? 28 : 3;
  for (const [i, [x, y]] of template.entries()) {
    landmarks[anchor * 10 + i * 2] = ((x * 640) / 112 - column * 8) / 8;
    landmarks[anchor * 10 + i * 2 + 1] = ((y * 640) / 112 - row * 8) / 8;
  }
};
const detectorTensors = (count: number) => {
  const scores = new Float32Array(12800);
  const boxes = new Float32Array(12800 * 4);
  const landmarks = new Float32Array(12800 * 10);
  for (let n = 0; n < count; n++) populateAnchor(count, n, scores, boxes, landmarks);
  return {
    s8: new Tensor("float32", scores, [12800, 1]),
    s16: new Tensor("float32", Float32Array.of(0), [1, 1]),
    s32: new Tensor("float32", Float32Array.of(0), [1, 1]),
    b8: new Tensor("float32", boxes, [12800, 4]),
    b16: new Tensor("float32", new Float32Array(4), [1, 4]),
    b32: new Tensor("float32", new Float32Array(4), [1, 4]),
    k8: new Tensor("float32", landmarks, [12800, 10]),
    k16: new Tensor("float32", new Float32Array(10), [1, 10]),
    k32: new Tensor("float32", new Float32Array(10), [1, 10]),
  };
};
const sessions = (frames: ReadonlyArray<Frame>, ada: boolean) => {
  let index = 0;
  let current = frame(0);
  let face = 0;
  const detector: FaceSession = {
    inputNames: ["images"],
    outputNames: outputs,
    run: () => {
      current = frames[index++] ?? frame(0);
      face = 0;
      return Promise.resolve(detectorTensors(current.count));
    },
  };
  const aligner: FaceSession = {
    inputNames: ["images"],
    outputNames: ["output"],
    run: () => {
      const confidence = current.confidence[face++] ?? 1;
      const values = Float32Array.from([
        0,
        0,
        1,
        1,
        0,
        confidence > 0.2 ? 10 : -10,
        0.3,
        0.4,
        0.7,
        0.4,
        0.5,
        0.6,
        0.35,
        0.8,
        0.65,
        0.8,
      ]);
      return Promise.resolve({ output: new Tensor("float32", values, [1, 16]) });
    },
  };
  const recognizer: FaceSession = {
    inputNames: ["images"],
    outputNames: ["embedding"],
    run: () => {
      if (!ada) face++;
      const vector = new Float32Array(512);
      vector.set(current.vector);
      return Promise.resolve({ embedding: new Tensor("float32", vector, [1, 512]) });
    },
  };
  return { detector, aligner, recognizer };
};
const writeImage = Effect.fn("Test.writeImage")((file: string, flat: boolean) =>
  Effect.gen(function* () {
    const pixels = Uint8Array.from(
      A.makeBy(112 * 112 * 3, (i) => (flat ? 120 : 60 + ((i * 37 + Math.floor(i / 23)) % 140)))
    );
    yield* Effect.promise(() =>
      sharp(pixels, { raw: { width: 112, height: 112, channels: 3 } })
        .png()
        .toFile(file)
    );
  })
);
const runScanCore = Effect.fn("Test.runScan")(
  (
    frames: ReadonlyArray<Frame>,
    backend: "buffalo-l" | "adaface-kprpe",
    references: number,
    flat: boolean,
    license: boolean,
    corrupt: boolean,
    recursive: boolean,
    missingDirectory: boolean,
    runtimeVersion: string,
    batchSize: number
  ) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const refs = path.join(root, "refs");
      const candidates = path.join(root, "candidates");
      yield* fs.makeDirectory(refs);
      yield* fs.makeDirectory(candidates);
      for (let i = 0; i < references; i++) yield* writeImage(path.join(refs, `${i}.png`), false);
      yield* writeImage(path.join(candidates, "candidate.png"), flat);
      if (corrupt) yield* fs.writeFileString(path.join(candidates, "broken.png"), "broken png");
      const prepared = PreparedOnnxModels.make({
        detectorPath: "detector",
        recognizerPath: "recognizer",
        ada:
          backend === "adaface-kprpe"
            ? O.some(PreparedAdaFaceArtifacts.make({ alignerPath: "aligner", recognizerPath: "recognizer" }))
            : O.none(),
        components: [],
      });
      const canned = sessions(frames, backend === "adaface-kprpe");
      let opened = 0;
      let closed = 0;
      const resources = PersonMatchOnnxResources.of({
        prepare: Effect.fn("Test.prepare")(() =>
          batchSize === 1 ? Effect.succeed(prepared) : Effect.die("Model preparation ran before batch-size validation")
        ),
        graph: Effect.fn("Test.graph")((source: string) => Effect.succeed(source)),
        version: Effect.fn("Test.version")(() => Effect.succeed(runtimeVersion)),
        open: Effect.fn("Test.open")((name) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              opened++;
              return name === "detector" ? canned.detector : name === "aligner" ? canned.aligner : canned.recognizer;
            }),
            () =>
              Effect.sync(() => {
                closed++;
              })
          )
        ),
      });
      const options = MatchPersonOptions.make({
        dir: candidates,
        references: refs,
        manifest: path.join(root, "report.json"),
        backend,
        detectionThreshold: 0.5,
        matchThreshold: 0.7,
        reviewThreshold: 0.3,
        minFaceAreaPct: 0.5,
        batchSize: PosInt.make(batchSize),
        acceptModelLicense: license,
        recursive,
      });
      const inputs = CanonicalMatchPersonInputs.make({
        cacheRoot: root,
        modelRoot: root,
        candidateDirectory: candidates,
        referenceDirectory: missingDirectory ? path.join(root, "missing") : refs,
        manifestPath: options.manifest,
        outputDirectory: O.none(),
      });
      const layer = PersonMatchWorkerServiceLayer.pipe(
        Layer.provide(Layer.succeed(PersonMatchOnnxResources, resources))
      );
      const services = yield* Layer.build(layer).pipe(
        Effect.provideService(PersonMatchModelArtifactVerifier, () => Effect.void)
      );
      const service = Context.get(services, PersonMatchWorkerService);
      const result = yield* service.run(options, inputs).pipe(Effect.result);
      expect(closed).toBe(opened);
      return result;
    })
);
const runScan = (
  frames: ReadonlyArray<Frame>,
  backend: "buffalo-l" | "adaface-kprpe" = "buffalo-l",
  references = 1,
  flat = false,
  license = true,
  corrupt = false,
  recursive = false,
  missingDirectory = false,
  runtimeVersion = "1.31.1",
  batchSize = 1
) =>
  runScanCore(
    frames,
    backend,
    references,
    flat,
    license,
    corrupt,
    recursive,
    missingDirectory,
    runtimeVersion,
    batchSize
  );
it.layer(nativeLayer)((it) => {
  it.effect("classifies identity, group, quality and rejection evidence without model files", () =>
    Effect.gen(function* () {
      for (const [candidate, expected, flat] of [
        [frame(), "solo-match", false],
        [frame(2), "group-match", false],
        [frame(), "low-quality-match", true],
        [frame(0), "no-face", false],
        [frame(1, [0, 1]), "no-match", false],
        [frame(1, [0.5, Math.sqrt(0.75)]), "review", false],
      ] satisfies ReadonlyArray<readonly [Frame, string, boolean]>) {
        const result = yield* runScan([frame(), candidate], "buffalo-l", 1, flat);
        expect(result._tag).toBe("Success");
        if (result._tag === "Success") {
          expect(result.success.entries[0]?.disposition).toBe(expected);
          expect(result.success.model.runtime.packageVersion).toBe("1.31.1");
          expect(result.success.parameters.batchSize).toBe(1);
        }
      }
    })
  );
  it.effect("rejects non-unit batch size before model preparation", () =>
    Effect.gen(function* () {
      const result = yield* runScan([frame(), frame()], "buffalo-l", 1, false, true, false, false, false, "1.31.1", 2);
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure._tag).toBe("MatchPersonRuntimeError");
        expect(result.failure).toMatchObject({
          workerCode: "invalid-arguments",
          message: "Native person matching supports only batch size 1.",
        });
      }
    })
  );
  it.effect("reviews invalid candidate vectors without inventing comparable face evidence", () =>
    Effect.gen(function* () {
      for (const vector of [
        [0, 0],
        [Number.MAX_VALUE, Number.MAX_VALUE],
      ]) {
        const result = yield* runScan([frame(), frame(1, vector)]);
        if (result._tag !== "Success") return expect.fail("invalid candidate aborted the scan");
        expect(result.success.entries[0]).toMatchObject({
          disposition: "review",
          reason: "invalid-embedding",
          faceCount: 0,
          faces: [],
        });
        expect(result.success.entries[0]?.bestScore).toBeUndefined();
        expect(result.success.summary.reviewCount).toBe(1);
        expect(result.success.summary.noMatchCount).toBe(0);
      }
    })
  );
  it.effect("distinguishes rejected aligners, partial rejection and unreadable candidates", () =>
    Effect.gen(function* () {
      const none = yield* runScan([frame(), frame(1, [1, 0], [0])], "adaface-kprpe");
      const partial = yield* runScan([frame(), frame(2, [1, 0], [1, 0])], "adaface-kprpe");
      const corrupt = yield* runScan([frame(), frame()], "buffalo-l", 1, false, true, true, true);
      if (none._tag === "Success") {
        expect(none.success.entries[0]?.disposition).toBe("no-face");
        expect(none.success.entries[0]?.reason).toBe("aligner-confidence-failed");
      } else expect.fail("scan failed");
      if (partial._tag === "Success") {
        expect(partial.success.entries[0]?.disposition).toBe("review");
        expect(partial.success.entries[0]?.reason).toBe("aligner-confidence-failed");
      } else expect.fail("scan failed");
      if (corrupt._tag === "Success")
        expect(A.map(corrupt.success.entries, (e) => e.disposition)).toContain("unreadable");
      else expect.fail("scan failed");
    })
  );
  it.effect("retains reference rejection reasons and both two-reference median and top-three scoring", () =>
    Effect.gen(function* () {
      const result = yield* runScan(
        [frame(0), frame(2), frame(1, [0, 0]), frame(1, [1, 0], [0]), frame(), frame(), frame()],
        "adaface-kprpe",
        6
      );
      if (result._tag === "Success") {
        expect(A.map(result.success.references, (r) => r.reason)).toEqual([
          "no-face",
          "multiple-faces",
          "invalid-embedding",
          "aligner-confidence-failed",
          undefined,
          undefined,
        ]);
        expect(result.success.summary.acceptedReferenceCount).toBe(2);
      } else expect.fail("scan failed");
      const top3 = yield* runScan([frame(), frame(), frame(), frame()], "buffalo-l", 3);
      expect(top3._tag).toBe("Success");
    })
  );
  it.effect("returns typed failures for unlicensed, empty, rejected-reference and excessive-face scans", () =>
    Effect.gen(function* () {
      const unlicensed = yield* runScan([], "buffalo-l", 1, false, false);
      const empty = yield* runScan([], "buffalo-l", 0);
      const missing = yield* runScan([], "buffalo-l", 1, false, true, false, false, true);
      expect(missing._tag).toBe("Failure");
      const rejected = yield* runScan([frame(0)]);
      const excessive = yield* runScan([frame(), frame(33)]);
      const invalidRuntime = yield* runScan([frame(), frame()], "buffalo-l", 1, false, true, false, false, false, "");
      expect(invalidRuntime._tag).toBe("Failure");
      if (invalidRuntime._tag === "Failure") expect(invalidRuntime.failure._tag).toBe("MatchPersonProtocolError");
      for (const result of [unlicensed, empty, rejected, excessive]) expect(result._tag).toBe("Failure");
    })
  );
  it.effect("roundtrips worker and public reports through both codec call forms", () =>
    Effect.gen(function* () {
      const result = yield* runScan([frame(), frame()]);
      if (result._tag !== "Success") return expect.fail("scan failed");
      const json = yield* encodeRecordedWorker(result.success);
      expect((yield* decodePersonMatchWorkerReportJson(json)).ok).toBe(true);
      const decode = decodePersonMatchWorkerReportJson();
      const decoded = yield* decode(json);
      expect(decoded.ok).toBe(true);
      const report = {
        ...result.success,
        schemaVersion: "beep.files.match-person.v2",
        manifestPath: "/report.json",
        manifestWritten: true,
      };
      const direct = yield* encodePersonMatchReport(report);
      const curried = yield* encodePersonMatchReport()(report);
      expect(direct).toEqual(curried);
    })
  );
  it.effect("maps every typed boundary error while preserving message and optional cause", () =>
    Effect.gen(function* () {
      for (const constructor of [
        MatchPersonError.config,
        MatchPersonError.license,
        MatchPersonError.materialization,
        MatchPersonError.modelAcquisition,
        MatchPersonError.modelIntegrity,
        MatchPersonError.path,
        MatchPersonError.protocol,
        MatchPersonError.runtime,
        MatchPersonError.semantic,
      ]) {
        for (const cause of [undefined, "original cause"]) {
          const original = constructor("typed failure", cause);
          const mapped = toFilesCommandError(original);
          expect(mapped.message).toBe("typed failure");
          expect(mapped.cause).toBe(cause);
        }
      }
      expect(toFilesCommandError(MatchPersonError.runtimeFromWorker("missing-embedding", "bad shape")).message).toBe(
        "bad shape"
      );
    })
  );
});

const tinyDetector = Uint8Array.of(1, 2, 3);
const tinyRecognizer = Uint8Array.of(4, 5, 6, 7);
const tinyArchive = zipSync({ "det_10g.onnx": tinyDetector, "w600k_r50.onnx": tinyRecognizer });
const pin = (component: "detector" | "recognizer", name: string, bytes: Uint8Array) => ({
  component,
  fileName: name,
  name,
  revision: "test",
  url: "https://example.invalid/model",
  licenseNotice: "test-only model bytes",
  sha256: Hex.encode(sha256(bytes)),
  sizeBytes: bytes.length,
});
const tinyPins = S.decodeEffect(BuffaloArtifactPins)({
  detector: pin("detector", "det_10g.onnx", tinyDetector),
  recognizer: pin("recognizer", "w600k_r50.onnx", tinyRecognizer),
  archive: pin("detector", "buffalo_l.zip", tinyArchive),
});
it.layer(nativeLayer)((it) => {
  it.effect("keeps valid shared detector bytes and repairs both interrupted ONNX files without downloads", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const defaults = yield* PersonMatchBuffaloPins;
      expect(defaults.detector.fileName).toBe("det_10g.onnx");
      const root = yield* fs.makeTempDirectoryScoped();
      const directory = path.join(root, "models", "beep_buffalo_l_v1");
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFile(path.join(root, "buffalo_l.zip"), tinyArchive);
      yield* fs.writeFile(path.join(directory, "det_10g.onnx"), tinyDetector);
      const pins = yield* tinyPins;
      const prepare = preparePersonMatchOnnxModels(root, "buffalo-l").pipe(
        Effect.provideService(PersonMatchBuffaloPins, pins)
      );
      const result = yield* prepare;
      const detector = yield* fs.readFile(result.detectorPath);
      expect(Uint8Array.from(detector)).toEqual(tinyDetector);
      const recognizer = yield* fs.readFile(result.recognizerPath);
      expect(Uint8Array.from(recognizer)).toEqual(tinyRecognizer);
      yield* fs.writeFile(result.detectorPath, Uint8Array.of(9));
      yield* fs.writeFile(result.recognizerPath, Uint8Array.of(9));
      yield* prepare;
      const repairedDetector = yield* fs.readFile(result.detectorPath);
      const repairedRecognizer = yield* fs.readFile(result.recognizerPath);
      expect(Uint8Array.from(repairedDetector)).toEqual(tinyDetector);
      expect(Uint8Array.from(repairedRecognizer)).toEqual(tinyRecognizer);
      yield* prepare;
      const entries = yield* fs.readDirectory(directory);
      expect(A.some(entries, Str.startsWith(".beep-model-"))).toBe(false);
    })
  );
  it.effect("refuses corrupt authenticated archives and unsafe cache aliases", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const pins = yield* tinyPins;
      yield* fs.writeFile(path.join(root, "buffalo_l.zip"), Uint8Array.of(9));
      const failure = yield* preparePersonMatchOnnxModels(root, "buffalo-l").pipe(
        Effect.provideService(PersonMatchBuffaloPins, pins),
        Effect.flip
      );
      expect(failure._tag).toBe("MatchPersonModelIntegrityError");
      const outside = path.join(root, "outside.onnx");
      const alias = path.join(root, "alias.onnx");
      yield* fs.writeFile(outside, tinyDetector);
      yield* fs.symlink(outside, alias);
      const refused = yield* writePersonMatchModelBytes(alias, tinyRecognizer).pipe(Effect.flip);
      expect(refused._tag).toBe("MatchPersonModelIntegrityError");
      const original = yield* fs.readFile(outside);
      expect(Uint8Array.from(original)).toEqual(tinyDetector);
    })
  );
  it.effect("repairs truncated and concurrent graph caches from verified tiny source bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const defaults = yield* PersonMatchGraphSourcePins;
      expect(defaults.aligner).toHaveLength(64);
      const root = yield* fs.makeTempDirectoryScoped();
      const source = path.join(root, "source.safetensors");
      yield* fs.writeFile(source, tinyDetector);
      const hash = Sha256Hex.make(Hex.encode(sha256(tinyDetector)));
      const pins = PersonMatchGraphPins.make({ aligner: hash, recognizer: hash });
      const compiler = Effect.fn("Test.compile")(() => Effect.succeed(tinyRecognizer));
      const graph = (component: "aligner" | "recognizer") =>
        compiledGraphForTesting(source, root, component).pipe(
          Effect.provideService(PersonMatchGraphSourcePins, pins),
          Effect.provideService(PersonMatchGraphCompiler, compiler)
        );
      const target = yield* graph("aligner");
      yield* fs.writeFile(target, Uint8Array.of(0));
      const results = yield* Effect.all([graph("aligner"), graph("aligner")], { concurrency: 2 });
      expect(results).toEqual([target, target]);
      const repaired = yield* fs.readFile(target);
      expect(Uint8Array.from(repaired)).toEqual(tinyRecognizer);
      const denied = PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "readFile",
        pathOrDescriptor: target,
      });
      const unreadable = FileSystem.make({
        ...fs,
        readFile: (name) => (name === target ? Effect.fail(denied) : fs.readFile(name)),
      });
      const readError = yield* graph("aligner").pipe(
        Effect.provideService(FileSystem.FileSystem, unreadable),
        Effect.flip
      );
      expect(readError.message).toContain("Cannot read generated graph cache");
      const unprobeable = FileSystem.FileSystem.of({
        ...fs,
        exists: Effect.fn("Test.unprobeable")(() => Effect.fail(denied)),
      });
      const probeError = yield* graph("aligner").pipe(
        Effect.provideService(FileSystem.FileSystem, unprobeable),
        Effect.flip
      );
      expect(probeError.message).toContain("Unsafe generated graph path");
      yield* graph("recognizer");
      const invalidRoot = path.join(root, "file-instead-of-directory");
      yield* fs.writeFile(invalidRoot, tinyDetector);
      const unsafe = yield* compiledGraphForTesting(source, invalidRoot, "aligner").pipe(
        Effect.provideService(PersonMatchGraphSourcePins, pins),
        Effect.provideService(PersonMatchGraphCompiler, compiler),
        Effect.flip
      );
      expect(unsafe._tag).toBe("MatchPersonModelIntegrityError");
      yield* fs.writeFile(source, Uint8Array.of(9));
      const mismatch = yield* graph("aligner").pipe(Effect.flip);
      expect(mismatch.message).toContain("changed after model verification");
      yield* fs.remove(source);
      const missing = yield* graph("aligner").pipe(Effect.flip);
      expect(missing.message).toContain("Cannot read pinned");
    })
  );
});
it.layer(nativeLayer)((it) => {
  it.effect("rejects missing, malformed and per-entry-corrupt authenticated ZIP archives", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const archive of [
        zipSync({ "det_10g.onnx": tinyDetector }),
        Uint8Array.of(1, 2, 3),
        zipSync({ "det_10g.onnx": tinyDetector, "w600k_r50.onnx": Uint8Array.of(9) }),
      ]) {
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFile(path.join(root, "buffalo_l.zip"), archive);
        const defaults = yield* tinyPins;
        const pins = yield* S.decodeEffect(BuffaloArtifactPins)({
          ...defaults,
          archive: pin("detector", "buffalo_l.zip", archive),
        });
        const error = yield* preparePersonMatchOnnxModels(root, "buffalo-l").pipe(
          Effect.provideService(PersonMatchBuffaloPins, pins),
          Effect.flip
        );
        expect(error._tag).toBe("MatchPersonModelIntegrityError");
      }
    })
  );
});

it.effect("normalizes subnormal and very large embedding components to unit length", () =>
  Effect.sync(() => {
    const unitSquares = (vector: ReadonlyArray<number>) =>
      A.reduce(normalizeFaceVector(vector), 0, (sum, value) => sum + value * value);
    expect(unitSquares([5e-324, 5e-324])).toBeCloseTo(1, 6);
    expect(unitSquares([1e-162, 3e-162, -2e-162])).toBeCloseTo(1, 6);
    expect(unitSquares([1e300, -1e300])).toBeCloseTo(1, 6);
    expect(normalizeFaceVector([0, 0])).toStrictEqual([]);
    expect(normalizeFaceVector([1, Number.NaN])).toStrictEqual([]);
  })
);

it.effect.prop(
  "normalizes schema-derived finite embedding vectors",
  [Arbitrary.schema(Frame.fields.vector)],
  ([vector]) =>
    Effect.sync(() => {
      const normalized = normalizeFaceVector(vector);
      expect(A.every(normalized, Number.isFinite)).toBe(true);
      if (normalized.length > 0) expect(A.reduce(normalized, 0, (sum, value) => sum + value * value)).toBeCloseTo(1, 6);
    }),
  { arbitrary: fcRuns(50) }
);

it.layer(nativeLayer)((it) => {
  it.effect("uses a valid Buffalo cache despite a pre-existing acquisition lock", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const directory = path.join(root, "models", "beep_buffalo_l_v1");
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFile(path.join(directory, "det_10g.onnx"), tinyDetector);
      yield* fs.writeFile(path.join(directory, "w600k_r50.onnx"), tinyRecognizer);
      const lock = path.join(directory, ".adaface-model-store.lock");
      yield* fs.writeFileString(lock, "existing-acquisition");
      const pins = yield* tinyPins;
      const prepared = yield* preparePersonMatchOnnxModels(root, "buffalo-l").pipe(
        Effect.provideService(PersonMatchBuffaloPins, pins)
      );
      expect(prepared.detectorPath).toBe(path.join(directory, "det_10g.onnx"));
      const token = yield* fs.readFileString(lock);
      expect(token).toBe("existing-acquisition");
    })
  );
  it.effect("refuses repair under a held lock with a backend-neutral typed error", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const directory = path.join(root, "models", "beep_buffalo_l_v1");
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFile(path.join(directory, "det_10g.onnx"), tinyDetector);
      yield* fs.writeFile(path.join(directory, "w600k_r50.onnx"), Uint8Array.of(0));
      const lock = path.join(directory, ".adaface-model-store.lock");
      yield* fs.writeFileString(lock, "held-by-another-run");
      const pins = yield* tinyPins;
      const failure = yield* preparePersonMatchOnnxModels(root, "buffalo-l").pipe(
        Effect.provideService(PersonMatchBuffaloPins, pins),
        Effect.flip
      );
      expect(failure._tag).toBe("MatchPersonModelAcquisitionError");
      expect(failure.message).toContain("Could not acquire the person-match model-store lock");
      expect(failure.message).not.toContain("AdaFace");
      const token = yield* fs.readFileString(lock);
      expect(token).toBe("held-by-another-run");
    })
  );
});
