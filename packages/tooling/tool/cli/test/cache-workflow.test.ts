import {
  assertCacheProducerWorkflowLocation,
  assertCacheProducerWorkflowProfile,
  collectCacheProducerWorkflowFiles,
  CacheRuntimeProcess as StepExec,
} from "@beep/repo-cli/test/Cache";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
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
  yield* fs.writeFileString(path.join(root, ".gitignore"), "ignored.ts\nnode_modules/\n");
  yield* git(["add", "."]);
  yield* git([
    "-c",
    "user.name=Workflow Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture sources",
  ]);
  return { root, fs, path, source, git };
});
it.layer(Layer.mergeAll(NodeCrypto.layer, NodeServices.layer), { timeout: "30 seconds" })(
  "producer workflow source identity",
  (it) => {
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
      })
    );
    it.effect("preserves whitespace in Git paths instead of hashing a different file", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* fixture();
        const relative = "packages/fixture/src/ space\nname.ts";
        yield* fs.writeFileString(path.join(root, relative), "export {};\n");
        expect(A.some(yield* collectCacheProducerWorkflowFiles(root), (file) => file.path === relative)).toBe(true);
      })
    );
    it.effect("binds source alias targets and executable permission changes", () =>
      Effect.gen(function* () {
        const { root, fs, path, source } = yield* fixture();
        const alias = path.join(root, "packages/fixture/src/alias.ts");
        yield* fs.symlink("main.ts", alias);
        const original = yield* collectCacheProducerWorkflowFiles(root);
        assertTrue(A.some(original, (file) => O.contains(file.linkTarget, "main.ts")));
        yield* fs.chmod(source, 0o700);
        expect(yield* collectCacheProducerWorkflowFiles(root)).not.toEqual(original);
      })
    );
    it.effect("rejects an alias escaping the workflow checkout", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* fixture();
        yield* fs.writeFileString(path.join(path.dirname(root), "outside.ts"), "outside fixture bytes");
        yield* fs.symlink("../../../../outside.ts", path.join(root, "packages/fixture/src/alias.ts"));
        assertTrue(Result.isFailure(yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result)));
      })
    );
    it.effect("rejects missing tracked sources instead of silently dropping their binding", () =>
      Effect.gen(function* () {
        const { root, fs, source } = yield* fixture();
        yield* fs.remove(source);
        assertTrue(Result.isFailure(yield* collectCacheProducerWorkflowFiles(root).pipe(Effect.result)));
      })
    );

    it.effect("accepts committed source without hidden executable inputs", () =>
      Effect.gen(function* () {
        const { root } = yield* fixture();
        yield* assertCacheProducerWorkflowProfile(root);
      })
    );
    it.effect("rejects unstaged and staged source changes", () =>
      Effect.gen(function* () {
        const { root, fs, source, git } = yield* fixture();
        yield* fs.writeFileString(source, "export const value = 2;\n");
        assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)));
        yield* git(["add", "packages"]);
        assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)));
      })
    );
    it.effect("rejects untracked and ignored executable additions", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* fixture();
        for (const name of ["unreviewed.ts", "ignored.ts"]) {
          const file = path.join(root, "packages/fixture/src", name);
          yield* fs.writeFileString(file, "export {};\n");
          assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)));
          yield* fs.remove(file);
        }
        yield* assertCacheProducerWorkflowProfile(root);
      })
    );
    it.effect("rejects workspace-local dependency resolution overrides", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* fixture();
        const directory = path.join(root, "packages/fixture/node_modules/effect");
        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.writeFileString(path.join(directory, "index.js"), "export {};\n");
        assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)));
      })
    );
    it.effect("rejects ambient dotenv files without reading their contents", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* fixture();
        for (const name of [".env", ".env.production.local", ".env.test.local"]) {
          const file = path.join(root, name);
          yield* fs.writeFileString(file, "FIXTURE_ONLY=true\n");
          assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)));
          yield* fs.remove(file);
        }
        yield* fs.symlink("missing-env-target", path.join(root, ".env.local"));
        assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowProfile(root).pipe(Effect.result)));
      })
    );
    it.effect("binds the loaded supervisor to its own checkout", () =>
      Effect.gen(function* () {
        const { root, path } = yield* fixture();
        const testFile = yield* path.fromFileUrl(new URL(import.meta.url));
        const owner = path.resolve(path.dirname(testFile), "../../../../..");
        yield* assertCacheProducerWorkflowLocation(owner);
        assertTrue(Result.isFailure(yield* assertCacheProducerWorkflowLocation(root).pipe(Effect.result)));
      })
    );
  }
);
