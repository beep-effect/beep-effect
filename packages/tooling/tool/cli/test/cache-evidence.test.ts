import { requireCacheSupervisorCapture } from "@beep/repo-cli/commands/Cache/Cache.evidence";
import {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheExperimentBytes,
} from "@beep/repo-cli/test/Cache";
import { CapturedStreams } from "@beep/repo-cli/test/Process";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

it.layer(testLayer, { timeout: "5 seconds" })((it) => {
  describe("shared bounded experiment artifacts", () => {
    it.effect("ignores failure-like output from a successful supervisor", () =>
      requireCacheSupervisorCapture(
        CapturedStreams.make({
          exitCode: 0,
          stdout: "Signed fresh comparisons lack positive native selected-task overlap.",
          stderr: "synthetic-worker-private-data",
          truncated: false,
        }),
        "Signed pilot"
      )
    );

    it.effect("quotes only a fixed hint from private stdout without retaining a raw cause", () =>
      Effect.gen(function* () {
        const error = yield* requireCacheSupervisorCapture(
          CapturedStreams.make({
            exitCode: 7,
            stdout:
              "synthetic-worker-private-data\u001b[31m Signed fresh comparisons lack positive\n native selected-task overlap. arbitrary-private-suffix",
            stderr: "private-stderr",
            truncated: false,
          }),
          "Signed pilot"
        ).pipe(Effect.flip);
        expect(error.message).toBe(
          "Signed pilot supervisor exited with exit code 7. Hint: Signed fresh comparisons lack positive native selected-task overlap."
        );
        expect(error.cause).toBeUndefined();
      })
    );

    it.effect("recognizes a fixed hint in stderr through the curried API", () =>
      Effect.gen(function* () {
        const error = yield* requireCacheSupervisorCapture("Protocol")(
          CapturedStreams.make({
            exitCode: 2,
            stdout: "private-stdout",
            stderr: "private-prefix Cannot find package private-package-name private-suffix",
            truncated: false,
          })
        ).pipe(Effect.flip);
        expect(error.message).toBe("Protocol supervisor exited with exit code 2. Hint: Cannot find package");
        expect(error.cause).toBeUndefined();
      })
    );

    it.effect("keeps unknown and partial failure output private", () =>
      Effect.gen(function* () {
        const error = yield* requireCacheSupervisorCapture(
          CapturedStreams.make({
            exitCode: 1,
            stdout: "Signed fresh comparisons lack positive native selected-task",
            stderr: "synthetic-worker-private-data",
            truncated: false,
          }),
          "Signed pilot"
        ).pipe(Effect.flip);
        expect(error.message).toBe("Signed pilot supervisor exited with exit code 1.");
        expect(error.cause).toBeUndefined();
      })
    );

    it.effect("rejects truncated success before recognizing any hint", () =>
      Effect.gen(function* () {
        const error = yield* requireCacheSupervisorCapture(
          CapturedStreams.make({
            exitCode: 0,
            stdout: "Signed fresh comparisons lack positive native selected-task overlap.",
            stderr: "synthetic-worker-private-data",
            truncated: true,
          }),
          "Signed pilot"
        ).pipe(Effect.flip);
        expect(error.message).toBe("Signed pilot supervisor exceeded its capture bound.");
        expect(error.cause).toBeUndefined();
      })
    );

    it.effect("preserves valid UTF-8 and rejects malformed bytes", () =>
      Effect.gen(function* () {
        const text = "café λ\n";
        const decodedCacheExperimentText = yield* decodeCacheExperimentText(new TextEncoder().encode(text));
        expect(decodedCacheExperimentText).toBe(text);
        (yield* decodeCacheExperimentText(new Uint8Array([0xc3, 0x28])).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
      })
    );

    it.effect("accepts the exact byte bound and rejects missing, oversized and symlink artifacts", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-evidence-test-" });
        yield* fs.writeFileString(path.join(root, "artifact"), "four");
        const pipe1 = yield* readCacheExperimentBytes(root, "artifact", 4).pipe(
          Effect.flatMap(decodeCacheExperimentText)
        );
        expect(pipe1).toBe("four");
        (yield* readCacheExperimentBytes(root, "artifact", 3).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        (yield* readCacheExperimentBytes(root, "absent", 4).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        yield* fs.symlink(path.join(root, "artifact"), path.join(root, "link"));
        (yield* readCacheExperimentBytes(root, "link", 4).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      })
    );

    it.effect("binds executable identity to exact bytes without following a symlink", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-executable-test-" });
        const executable = path.join(root, "tool");
        const bytes = new TextEncoder().encode("fixture executable");
        yield* fs.writeFile(executable, bytes);
        const hashCacheExperimentExecutable2 = yield* hashCacheExperimentExecutable(executable);
        const expectation = expect(hashCacheExperimentExecutable2);
        const hashBytes1 = yield* hashBytes(bytes);
        expectation.toBe(hashBytes1);
        yield* fs.symlink(executable, path.join(root, "link"));
        (yield* hashCacheExperimentExecutable(path.join(root, "link")).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
      })
    );
  });
});
