/**
 * Workspace discovery for the Quality artifact generators reads manifests
 * through `LenientManifest` (3-A4).
 *
 * The retired projection typed `workspaces` as unknown and kept whatever
 * string entries it found, so a malformed declaration silently discovered a
 * different package set. A malformed `workspaces` now fails the read.
 */
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { discoverWorkspacePackages } from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const writeRepository = Effect.fn(function* (rootWorkspaces: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = "/repo";
  yield* fs.makeDirectory(path.join(repoRoot, "packages", "demo"), { recursive: true });
  yield* fs.writeFileString(
    path.join(repoRoot, "package.json"),
    yield* encodeJson({ name: "@beep/root", private: true, workspaces: rootWorkspaces })
  );
  yield* fs.writeFileString(
    path.join(repoRoot, "packages", "demo", "package.json"),
    yield* encodeJson({ name: "@beep/demo", scripts: { coverage: "vitest run --coverage" } })
  );
  return { repoRoot, path };
});

it.layer(Layer.provideMerge(MemoryFileSystem.layer, NodeServices.layer), { timeout: "30 seconds" })(
  "QualityArtifactSupport workspace manifests",
  (it) => {
    describe("discoverWorkspacePackages", () => {
      it.effect("discovers the root and its workspace packages", () =>
        Effect.gen(function* () {
          const { repoRoot, path } = yield* writeRepository(["packages/*"]);
          const packages = yield* discoverWorkspacePackages(repoRoot, path);

          deepStrictEqual(pipe(MutableHashMap.keys(packages), A.fromIterable, A.sort(Order.String)), [
            "@beep/demo",
            "@beep/root",
          ]);
        })
      );

      it.effect("fails on a workspaces array with a non-string entry instead of keeping its strings", () =>
        Effect.gen(function* () {
          const { repoRoot, path } = yield* writeRepository(["packages/*", 7]);
          const error = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));

          strictEqual(error._tag, "QualityArtifactGeneratorError");
          assertTrue(Str.startsWith("Failed to decode package manifest")(error.message));
        })
      );
    });
  }
);
