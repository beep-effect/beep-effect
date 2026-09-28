import {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheExperimentBytes,
} from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

describe("shared bounded experiment artifacts", () => {
  it.effect("preserves valid UTF-8 and rejects malformed bytes", () =>
    Effect.gen(function* () {
      const text = "café λ\n";
      expect(yield* decodeCacheExperimentText(new TextEncoder().encode(text))).toBe(text);
      assertTrue(Result.isFailure(yield* decodeCacheExperimentText(new Uint8Array([0xc3, 0x28])).pipe(Effect.result)));
    })
  );

  it.effect("accepts the exact byte bound and rejects missing, oversized and symlink artifacts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-evidence-test-" });
      yield* fs.writeFileString(path.join(root, "artifact"), "four");
      expect(yield* readCacheExperimentBytes(root, "artifact", 4).pipe(Effect.flatMap(decodeCacheExperimentText))).toBe(
        "four"
      );
      assertTrue(Result.isFailure(yield* readCacheExperimentBytes(root, "artifact", 3).pipe(Effect.result)));
      assertTrue(Result.isFailure(yield* readCacheExperimentBytes(root, "absent", 4).pipe(Effect.result)));
      yield* fs.symlink(path.join(root, "artifact"), path.join(root, "link"));
      assertTrue(Result.isFailure(yield* readCacheExperimentBytes(root, "link", 4).pipe(Effect.result)));
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("binds executable identity to exact bytes without following a symlink", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-executable-test-" });
      const executable = path.join(root, "tool");
      const bytes = new TextEncoder().encode("fixture executable");
      yield* fs.writeFile(executable, bytes);
      expect(yield* hashCacheExperimentExecutable(executable)).toBe(yield* hashBytes(bytes));
      yield* fs.symlink(executable, path.join(root, "link"));
      assertTrue(Result.isFailure(yield* hashCacheExperimentExecutable(path.join(root, "link")).pipe(Effect.result)));
    }).pipe(provideScopedLayer(testLayer))
  );
});
