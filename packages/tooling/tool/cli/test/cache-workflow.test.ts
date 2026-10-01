import { collectCacheProducerWorkflowFiles, CacheRuntimeProcess as StepExec } from "@beep/repo-cli/test/Cache";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";

const fixture = Effect.fn("WorkflowTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = yield* fs.makeTempDirectoryScoped({ prefix: "cache-workflow-" });
  const root = path.join(parent, "checkout");
  yield* fs.makeDirectory(root);
  const git = Effect.fn("WorkflowTest.git")(function* (args: ReadonlyArray<string>) {
    const result = yield* StepExec.runCaptured({
      command: "/usr/bin/git",
      args,
      cwd: root,
      extendEnv: false,
      env: { PATH: "/usr/bin", HOME: root, GIT_CONFIG_NOSYSTEM: "1" },
      source: "all",
    });
    expect(result.exitCode).toBe(0);
  });
  yield* git(["init", "--template=", "."]);
  yield* fs.makeDirectory(path.join(root, "packages/fixture/src"), { recursive: true });
  const source = path.join(root, "packages/fixture/src/main.ts");
  yield* fs.writeFileString(source, "export const value = 1;\n");
  yield* git(["add", "packages"]);
  return { root, fs, path, source, git };
});
it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer))("producer workflow source identity", (it) => {
  it.effect("binds dirty tracked bytes and newly introduced source files", () =>
    Effect.gen(function* () {
      const { root, fs, path, source } = yield* fixture();
      const original = yield* collectCacheProducerWorkflowFiles(root);
      yield* fs.writeFileString(source, "export const value = 2;\n");
      const changed = yield* collectCacheProducerWorkflowFiles(root);
      expect(changed).not.toEqual(original);
      yield* fs.writeFileString(path.join(root, "packages/fixture/src/new.ts"), "export {};\n");
      expect(A.map(yield* collectCacheProducerWorkflowFiles(root), (file) => file.path)).toEqual([
        "packages/fixture/src/main.ts",
        "packages/fixture/src/new.ts",
      ]);
    }).pipe(Effect.scoped)
  );
  it.effect("preserves whitespace in Git paths instead of hashing a different file", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      const relative = "packages/fixture/src/ space\nname.ts";
      yield* fs.writeFileString(path.join(root, relative), "export {};\n");
      expect(A.some(yield* collectCacheProducerWorkflowFiles(root), (file) => file.path === relative)).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("binds source alias targets and executable permission changes", () =>
    Effect.gen(function* () {
      const { root, fs, path, source } = yield* fixture();
      const alias = path.join(root, "packages/fixture/src/alias.ts");
      yield* fs.symlink("main.ts", alias);
      const original = yield* collectCacheProducerWorkflowFiles(root);
      expect(A.some(original, (file) => O.contains(file.linkTarget, "main.ts"))).toBe(true);
      yield* fs.chmod(source, 0o700);
      expect(yield* collectCacheProducerWorkflowFiles(root)).not.toEqual(original);
    }).pipe(Effect.scoped)
  );
  it.effect("rejects an alias escaping the workflow checkout", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      yield* fs.writeFileString(path.join(path.dirname(root), "outside.ts"), "outside fixture bytes");
      yield* fs.symlink("../../../../outside.ts", path.join(root, "packages/fixture/src/alias.ts"));
      expect(Result.isFailure(yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
  it.effect("rejects missing tracked sources instead of silently dropping their binding", () =>
    Effect.gen(function* () {
      const { root, fs, source } = yield* fixture();
      yield* fs.remove(source);
      expect(Result.isFailure(yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result))).toBe(true);
    }).pipe(Effect.scoped)
  );
});
