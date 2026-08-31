import { PersonMatchModel, prepareAdaFaceArtifacts, verifyPersonMatchModelArtifacts } from "@beep/repo-cli/test/Files";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

const insightFaceSource = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip";
const insightFaceLicense =
  "InsightFace pretrained-model terms: https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md";
const cvlFaceLicense =
  "CVLFace code is MIT-licensed; checkpoint use is also subject to the training-dataset and model-card terms at the pinned source.";

const detectorSha256 = "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91";
const recognizerSha256 = "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43";

const noDownloadClient = HttpClient.make((request) =>
  Effect.die(`Unexpected model download during store test: ${request.url}`)
);

const testLayer = Layer.mergeAll(NodeServices.layer, Layer.succeed(HttpClient.HttpClient, noDownloadClient));

const withTempRoot = <A, E, R>(use: (root: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    FileSystem.FileSystem.use((fs) => fs.makeTempDirectory()),
    use,
    (root) => FileSystem.FileSystem.use((fs) => fs.remove(root, { force: true, recursive: true }).pipe(Effect.ignore))
  ).pipe(provideScopedLayer(testLayer));

const detectorArtifact = (path: string) => ({
  name: "det_10g.onnx",
  path,
  sizeBytes: 16_923_827,
  sha256: detectorSha256,
});

const buffaloRecognizerArtifact = (path: string) => ({
  name: "w600k_r50.onnx",
  path,
  sizeBytes: 174_383_860,
  sha256: recognizerSha256,
});

const detectorComponent = (artifacts: ReadonlyArray<ReturnType<typeof detectorArtifact>>) => ({
  role: "detector",
  name: "insightface-det_10g",
  revision: "v0.7",
  source: insightFaceSource,
  licenseNotice: insightFaceLicense,
  artifacts,
});

const recognizerComponent = (artifacts: ReadonlyArray<ReturnType<typeof buffaloRecognizerArtifact>>) => ({
  role: "recognizer",
  name: "insightface-w600k_r50",
  revision: "v0.7",
  source: insightFaceSource,
  licenseNotice: insightFaceLicense,
  artifacts,
});

const decodeModel = S.decodeUnknownEffect(PersonMatchModel);

const buffaloModel = (root: string, components: ReadonlyArray<unknown>) =>
  decodeModel({
    backend: "buffalo-l",
    name: "buffalo_l",
    packageName: "insightface",
    packageVersion: "1.0.1",
    runtime: {
      framework: "onnxruntime",
      packageVersion: "1.23.2",
      actualCompute: "cpu",
      precision: "fp32",
      providers: ["CPUExecutionProvider"],
      devices: [],
      warnings: [],
    },
    root,
    allowedModules: ["detection", "recognition"],
    components,
  });

const adaFaceModel = (root: string, components: ReadonlyArray<unknown>) =>
  decodeModel({
    backend: "adaface-kprpe",
    name: "cvlface_adaface_vit_base_kprpe_webface12m",
    codeRevision: "308142aa50adf2e187711354f7524635d3414f1e",
    runtime: {
      framework: "pytorch",
      distribution: "cpu",
      packageVersion: "2.9.1+cpu",
      actualCompute: "cpu",
      precision: "fp32",
      devices: [],
      warnings: [],
    },
    root,
    components,
  });

const expectIntegrityFailure = Effect.fnUntraced(function* <A, R>(
  operation: Effect.Effect<A, { readonly _tag: string; readonly message: string }, R>,
  message: string
) {
  const error = yield* Effect.flip(operation);
  expect(error._tag).toBe("MatchPersonModelIntegrityError");
  expect(error.message).toContain(message);
});

describe("person-match model store", { concurrent: false }, () => {
  it("rejects an existing corrupt pin and releases its acquisition lock", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const alignerDirectory = path.join(root, "pinned", "aligner");
          const lockPath = path.join(root, ".adaface-model-store.lock");
          yield* fs.makeDirectory(alignerDirectory, { recursive: true });
          yield* fs.writeFile(path.join(alignerDirectory, "model.safetensors"), Uint8Array.of(1, 2, 3));

          yield* expectIntegrityFailure(prepareAdaFaceArtifacts(root), "integrity mismatch for aligner");

          expect(yield* fs.exists(lockPath)).toBe(false);
          expect(yield* fs.readDirectory(path.join(root, "pinned"))).toEqual(["aligner"]);
        })
      )
    ));

  it("rejects a dangling pin without attempting a download and releases its lock", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const alignerDirectory = path.join(root, "pinned", "aligner");
          const artifactPath = path.join(alignerDirectory, "model.safetensors");
          const lockPath = path.join(root, ".adaface-model-store.lock");
          yield* fs.makeDirectory(alignerDirectory, { recursive: true });
          yield* fs.symlink(path.join(root, "missing-model.safetensors"), artifactPath);

          yield* expectIntegrityFailure(prepareAdaFaceArtifacts(root), "Refusing a dangling model artifact symlink");

          expect(yield* fs.exists(lockPath)).toBe(false);
          expect(yield* fs.readLink(artifactPath)).toBe(path.join(root, "missing-model.safetensors"));
        })
      )
    ));

  it("rejects an aliased existing pin and releases its lock", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const alignerDirectory = path.join(root, "pinned", "aligner");
          const actualPath = path.join(root, "actual-model.safetensors");
          const artifactPath = path.join(alignerDirectory, "model.safetensors");
          yield* fs.makeDirectory(alignerDirectory, { recursive: true });
          yield* fs.writeFile(actualPath, Uint8Array.of(1, 2, 3));
          yield* fs.symlink(actualPath, artifactPath);

          yield* expectIntegrityFailure(
            prepareAdaFaceArtifacts(root),
            "Refusing a symlinked or aliased model artifact"
          );

          expect(yield* fs.exists(path.join(root, ".adaface-model-store.lock"))).toBe(false);
        })
      )
    ));

  it("maps an occupied model-store lock to the typed acquisition channel and preserves its owner token", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const lockPath = path.join(root, ".adaface-model-store.lock");
          yield* fs.writeFileString(lockPath, "active-owner-token");

          const error = yield* Effect.flip(prepareAdaFaceArtifacts(root));

          expect(error._tag).toBe("MatchPersonModelAcquisitionError");
          expect(error.message).toContain("Could not acquire the AdaFace model-store lock");
          expect(yield* fs.readFileString(lockPath)).toBe("active-owner-token");
        })
      )
    ));

  it("rejects a model root that is a regular file through the typed integrity channel", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fileRoot = path.join(root, "model-root-file");
          yield* fs.writeFile(fileRoot, Uint8Array.of(1));

          yield* expectIntegrityFailure(prepareAdaFaceArtifacts(fileRoot), "Failed to create AdaFace model root");
        })
      )
    ));

  it("rejects incomplete Buffalo and AdaFace component sets before reading artifacts", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const buffalo = yield* buffaloModel(root, []);
          const adaFace = yield* adaFaceModel(root, []);

          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(buffalo, root),
            "omitted or added a pinned model component"
          );
          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(adaFace, root),
            "omitted or added a pinned model component"
          );
        })
      )
    ));

  it("rejects a same-size component set that omits the detector role", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
          const recognizer = recognizerComponent([buffaloRecognizerArtifact(path.join(runtimeRoot, "w600k_r50.onnx"))]);
          const model = yield* buffaloModel(root, [recognizer, recognizer]);

          yield* expectIntegrityFailure(verifyPersonMatchModelArtifacts(model, root), "omitted the detector component");
        })
      )
    ));

  it("rejects altered component provenance before reading its artifacts", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
          const alteredDetector = {
            ...detectorComponent([detectorArtifact(path.join(runtimeRoot, "det_10g.onnx"))]),
            revision: "mutable-latest",
          };
          const model = yield* buffaloModel(root, [
            alteredDetector,
            recognizerComponent([buffaloRecognizerArtifact(path.join(runtimeRoot, "w600k_r50.onnx"))]),
          ]);

          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(model, root),
            "detector component does not match its pinned name, revision, source, or license notice"
          );
        })
      )
    ));

  it("rejects missing and duplicate artifact provenance for a pinned component", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
          const recognizer = recognizerComponent([buffaloRecognizerArtifact(path.join(runtimeRoot, "w600k_r50.onnx"))]);
          const absent = yield* buffaloModel(root, [detectorComponent([]), recognizer]);
          const duplicateArtifact = detectorArtifact(path.join(runtimeRoot, "det_10g.onnx"));
          const duplicated = yield* buffaloModel(root, [
            detectorComponent([duplicateArtifact, duplicateArtifact]),
            recognizer,
          ]);

          yield* expectIntegrityFailure(verifyPersonMatchModelArtifacts(absent, root), "omitted the detector artifact");
          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(duplicated, root),
            "reported multiple detector artifacts"
          );
        })
      )
    ));

  it("rejects altered artifact metadata before trusting its installation path", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
          const model = yield* buffaloModel(root, [
            detectorComponent([
              {
                ...detectorArtifact(path.join(runtimeRoot, "det_10g.onnx")),
                name: "renamed-detector.onnx",
              },
            ]),
            recognizerComponent([buffaloRecognizerArtifact(path.join(runtimeRoot, "w600k_r50.onnx"))]),
          ]);

          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(model, root),
            "detector artifact does not match its pinned path, size, or SHA-256"
          );
        })
      )
    ));

  it("re-hashes exact reported metadata and rejects corrupt physical bytes", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
          const detectorPath = path.join(runtimeRoot, "det_10g.onnx");
          yield* fs.makeDirectory(runtimeRoot, { recursive: true });
          yield* fs.writeFile(detectorPath, Uint8Array.of(1, 2, 3));
          const model = yield* buffaloModel(root, [
            detectorComponent([detectorArtifact(detectorPath)]),
            recognizerComponent([buffaloRecognizerArtifact(path.join(runtimeRoot, "w600k_r50.onnx"))]),
          ]);

          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(model, root),
            "Model artifact integrity mismatch for detector"
          );
        })
      )
    ));

  it("rejects an exact reported artifact when its installation path is an alias", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const runtimeRoot = path.join(root, "models", "beep_buffalo_l_v1");
          const detectorPath = path.join(runtimeRoot, "det_10g.onnx");
          const realPath = path.join(root, "detector-real.onnx");
          yield* fs.makeDirectory(runtimeRoot, { recursive: true });
          yield* fs.writeFile(realPath, Uint8Array.of(1, 2, 3));
          yield* fs.symlink(realPath, detectorPath);
          const model = yield* buffaloModel(root, [
            detectorComponent([detectorArtifact(detectorPath)]),
            recognizerComponent([buffaloRecognizerArtifact(path.join(runtimeRoot, "w600k_r50.onnx"))]),
          ]);

          yield* expectIntegrityFailure(
            verifyPersonMatchModelArtifacts(model, root),
            "Refusing a symlinked or aliased model artifact"
          );
        })
      )
    ));

  it("builds the AdaFace allowlist and rejects its missing detector artifact", () =>
    Effect.runPromise(
      withTempRoot((root) =>
        Effect.gen(function* () {
          const components = [
            detectorComponent([]),
            {
              role: "aligner",
              name: "cvlface_DFA_mobilenet",
              revision: "8317e6dda53d91e7074979923144c2cc08906a33",
              source:
                "https://huggingface.co/minchul/cvlface_DFA_mobilenet/resolve/8317e6dda53d91e7074979923144c2cc08906a33/model.safetensors",
              licenseNotice: cvlFaceLicense,
              artifacts: [],
            },
            {
              role: "recognizer",
              name: "cvlface_adaface_vit_base_kprpe_webface12m",
              revision: "daefd5012d369588bd214fbaf4cc6b1d286e7066",
              source:
                "https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/resolve/daefd5012d369588bd214fbaf4cc6b1d286e7066/model.safetensors",
              licenseNotice: cvlFaceLicense,
              artifacts: [],
            },
          ];
          const model = yield* adaFaceModel(root, components);

          yield* expectIntegrityFailure(verifyPersonMatchModelArtifacts(model, root), "omitted the detector artifact");
        })
      )
    ));
});
