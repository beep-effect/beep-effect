import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  defaultPersonMatchBackendForPlatform,
  PersonMatchModel,
  PersonMatchModelArtifactVerifier,
  validatePersonMatchBackendPlatform,
} from "@beep/repo-cli/test/Files";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type {} from "@beep/repo-cli/test/Files";

const PlatformLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);
describe("person-match backend portability", () => {
  it("keeps AdaFace as the Linux x64 default", () => {
    expect(defaultPersonMatchBackendForPlatform("linux", "x64")).toBe("adaface-kprpe");
  });

  it("selects Buffalo when AdaFace is unsupported", () => {
    expect(defaultPersonMatchBackendForPlatform("darwin", "arm64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("darwin", "x64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("win32", "x64")).toBe("buffalo-l");
    expect(defaultPersonMatchBackendForPlatform("linux", "arm64")).toBe("buffalo-l");
  });
  it.layer(PlatformLayer, { timeout: "5 seconds" })((it) => {
    it.effect("keeps physical model verification fail-closed by default", () =>
      Effect.gen(function* () {
        const verifier = yield* PersonMatchModelArtifactVerifier;
        expect(typeof verifier).toBe("function");

        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const installed = path.join(root, "models", "beep_buffalo_l_v1");
        const detector = path.join(installed, "det_10g.onnx");
        yield* fs.makeDirectory(installed, { recursive: true });
        yield* fs.writeFile(detector, Uint8Array.of(1, 2, 3));
        const source = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip";
        const licenseNotice =
          "InsightFace pretrained-model terms: https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md";
        const detectorSha256 = "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91";
        const model = yield* S.decodeEffect(PersonMatchModel)({
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
          components: [
            {
              role: "detector",
              name: "insightface-det_10g",
              revision: "v0.7",
              source,
              licenseNotice,
              artifacts: [{ name: "det_10g.onnx", path: detector, sizeBytes: 16_923_827, sha256: detectorSha256 }],
            },
            {
              role: "recognizer",
              name: "insightface-w600k_r50",
              revision: "v0.7",
              source,
              licenseNotice,
              artifacts: [
                {
                  name: "w600k_r50.onnx",
                  path: path.join(installed, "w600k_r50.onnx"),
                  sizeBytes: 174_383_860,
                  sha256: "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
                },
              ],
            },
          ],
        });
        const failure = yield* Effect.flip(verifier(model, root));
        expect(failure._tag).toBe("MatchPersonModelIntegrityError");
        expect(failure.message).toBe(
          `Model artifact integrity mismatch for detector: expected 16923827 bytes and SHA-256 ${detectorSha256}.`
        );
      })
    );
  });
  it.effect("accepts Buffalo on every supported native ONNX platform", () =>
    Effect.all(
      [
        validatePersonMatchBackendPlatform("buffalo-l", "linux", "x64"),
        validatePersonMatchBackendPlatform("buffalo-l", "linux", "arm64"),
        validatePersonMatchBackendPlatform("buffalo-l", "darwin", "arm64"),
        validatePersonMatchBackendPlatform("buffalo-l", "win32", "x64"),
      ],
      { concurrency: 5, discard: true }
    )
  );

  it.effect("rejects explicit AdaFace before its platform-locked runtime can start", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(validatePersonMatchBackendPlatform("adaface-kprpe", "win32", "x64"));

      expect(error.message).toBe(
        "AdaFace KP-RPE is unavailable on win32/x64; its fixed CPU ONNX runtime supports only Linux x64. " +
          "Re-run with --backend buffalo-l."
      );
    })
  );

  it.effect("rejects Buffalo where its native runtime is unsupported", () =>
    Effect.gen(function* () {
      const intelMac = yield* Effect.flip(validatePersonMatchBackendPlatform("buffalo-l", "darwin", "x64"));
      expect(intelMac.message).toContain("unavailable on darwin/x64");
      const windowsArm = yield* Effect.flip(validatePersonMatchBackendPlatform("buffalo-l", "win32", "arm64"));
      const freeBsd = yield* Effect.flip(validatePersonMatchBackendPlatform("buffalo-l", "freebsd", "x64"));

      expect(windowsArm.message).toContain("unavailable on win32/arm64");
      expect(freeBsd.message).toContain("unavailable on freebsd/x64");
    })
  );
});
