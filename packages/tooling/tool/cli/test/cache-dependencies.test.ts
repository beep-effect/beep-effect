import { CacheCensusWorkspace, CacheDependencyMaterialization } from "@beep/repo-cli/commands/Cache";
import { inspectCacheDependencyTree } from "@beep/repo-cli/test/Cache";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const fixture = Effect.fn("CacheDependenciesTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-dependencies-test-" });
  const modules = path.join(root, "node_modules");
  yield* fs.makeDirectory(path.join(modules, "example"), { recursive: true });
  const source = path.join(modules, "example/index.js");
  yield* fs.writeFileString(source, "export const value = 1;\n");
  return { root, modules, source, fs, path };
});

describe("installed cache dependency integrity", () => {
  it("roundtrips materialization evidence through its schema", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.schema(CacheDependencyMaterialization),
          (value) => {
            const codec = S.fromJsonString(CacheDependencyMaterialization);
            const encoded = Result.getOrThrow(S.encodeResult(codec)(value));
            const decoded = Result.getOrThrow(S.decodeResult(codec)(encoded));
            expect(S.toEquivalence(CacheDependencyMaterialization)(value, decoded)).toBe(true);
            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });

  it.effect("normalizes location and timestamps while detecting bytes, modes and entries", () =>
    Effect.gen(function* () {
      const first = yield* fixture();
      const second = yield* fixture();
      const before = yield* inspectCacheDependencyTree(first.root, []);
      expect((yield* inspectCacheDependencyTree(second.root, [])).sha256).toBe(before.sha256);
      yield* first.fs.utimes(first.source, 1, 1);
      expect((yield* inspectCacheDependencyTree(first.root, [])).sha256).toBe(before.sha256);
      yield* first.fs.writeFileString(first.source, "export const value = 2;\n");
      const changed = yield* inspectCacheDependencyTree(first.root, []);
      expect(changed.sha256).not.toBe(before.sha256);
      yield* first.fs.chmod(first.source, 0o700);
      expect((yield* inspectCacheDependencyTree(first.root, [])).sha256).not.toBe(changed.sha256);
      yield* first.fs.remove(first.source);
      const removed = yield* inspectCacheDependencyTree(first.root, []);
      expect(removed.regularFiles).toBe(0);
      expect(removed.sha256).not.toBe(before.sha256);
    }).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("records internal and declared workspace links without following them", () =>
    Effect.gen(function* () {
      const { root, modules, fs, path } = yield* fixture();
      yield* fs.makeDirectory(path.join(modules, "@beep"));
      yield* fs.symlink("example/index.js", path.join(modules, "entry"));
      yield* fs.symlink("../../packages/example", path.join(modules, "@beep/example"));
      const workspace = CacheCensusWorkspace.make({
        name: "@beep/example",
        directory: "packages/example",
        scripts: {},
      });
      const tree = yield* inspectCacheDependencyTree(root, [workspace]);
      expect(tree.regularFiles).toBe(1);
      expect(tree.links).toEqual([
        { _tag: "Workspace", path: "@beep/example", target: "../../packages/example", workspace: "packages/example" },
        { _tag: "Internal", path: "entry", target: "example/index.js" },
      ]);
      expect(Result.isFailure(yield* inspectCacheDependencyTree(root, []).pipe(Effect.result))).toBe(true);
    }).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("refuses absolute and escaping links and a symlinked tree root", () =>
    Effect.gen(function* () {
      const { root, modules, fs, path } = yield* fixture();
      const link = path.join(modules, "outside");
      for (const target of ["/etc/passwd", "../../outside"]) {
        yield* fs.symlink(target, link);
        expect(Result.isFailure(yield* inspectCacheDependencyTree(root, []).pipe(Effect.result))).toBe(true);
        yield* fs.remove(link);
      }
      const alternate = yield* fs.makeTempDirectoryScoped({ prefix: "cache-dependency-link-test-" });
      yield* fs.symlink(modules, path.join(alternate, "node_modules"));
      expect(Result.isFailure(yield* inspectCacheDependencyTree(alternate, []).pipe(Effect.result))).toBe(true);
    }).pipe(provideScopedLayer(NodeServices.layer))
  );
});
