import { purgeAtRoot } from "@beep/repo-cli/commands/Purge";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertExitFailure, assertInstanceOf, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";

const testLayer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));

const outsideWorkspaceScenario = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-purge-repo-" });
  const externalDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-purge-external-" });
  const path = yield* Path.Path;
  const workspaceDir = path.join(tmpDir, "packages", "pkg-outside");
  const externalDistDir = path.join(externalDir, "dist");
  const externalSentinelPath = path.join(externalDistDir, "sentinel.txt");

  yield* fs.writeFileString(
    path.join(tmpDir, "package.json"),
    '{ "name": "@beep/test-root", "workspaces": ["packages/*"] }\n'
  );
  yield* fs.makeDirectory(path.dirname(workspaceDir), { recursive: true });
  yield* fs.writeFileString(
    path.join(externalDir, "package.json"),
    '{ "name": "@beep/outside-workspace", "version": "1.0.0" }\n'
  );
  yield* fs.makeDirectory(externalDistDir, { recursive: true });
  yield* fs.writeFileString(externalSentinelPath, "keep\n");
  yield* fs.symlink(externalDir, workspaceDir);

  const succeeded = yield* purgeAtRoot(tmpDir, false).pipe(
    Effect.match({
      onFailure: () => false,
      onSuccess: () => true,
    })
  );

  expect(succeeded).toBe(false);
  expect(yield* fs.exists(externalDistDir)).toBe(true);
  expect(yield* fs.readFileString(externalSentinelPath)).toBe("keep\n");
});

const canonicalRootScenario = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-purge-repo-" });
  const externalDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-purge-external-" });
  const path = yield* Path.Path;
  const repoAlias = path.join(externalDir, "repo-alias");
  const workspaceDir = path.join(tmpDir, "packages", "pkg-a");
  const rootNodeModules = path.join(tmpDir, "node_modules");
  const workspaceDist = path.join(workspaceDir, "dist");

  yield* fs.writeFileString(
    path.join(tmpDir, "package.json"),
    '{ "name": "@beep/test-root", "workspaces": ["packages/*"] }\n'
  );
  yield* fs.makeDirectory(workspaceDir, { recursive: true });
  yield* fs.writeFileString(path.join(workspaceDir, "package.json"), '{ "name": "@beep/pkg-a", "version": "1.0.0" }\n');
  yield* fs.makeDirectory(rootNodeModules, { recursive: true });
  yield* fs.makeDirectory(workspaceDist, { recursive: true });
  yield* fs.symlink(tmpDir, repoAlias);

  const succeeded = yield* purgeAtRoot(repoAlias, false).pipe(
    Effect.match({
      onFailure: () => false,
      onSuccess: () => true,
    })
  );

  expect(succeeded).toBe(true);
  expect(yield* fs.exists(rootNodeModules)).toBe(false);
  expect(yield* fs.exists(workspaceDist)).toBe(false);
});

it.layer(testLayer, { timeout: "5 seconds" })("purge security", (it) => {
  it.effect(
    "fails closed before deleting artifacts from a symlinked workspace outside the repo root",
    outsideWorkspaceScenario
  );

  it.effect(
    "accepts a symlinked repo root when every purge target stays inside the canonical repository",
    canonicalRootScenario
  );
  for (const mode of [
    "second acquisition failure",
    "second acquisition interruption",
    "repository cleanup failure",
    "external cleanup failure",
  ]) {
    it.effect(
      `purge fixture owns both acquisitions during ${mode}`,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const roots = yield* Ref.make(A.empty<string>());
        const acquisitions = yield* Ref.make(0);
        const removalError = yield* Ref.make<O.Option<PlatformError.PlatformError>>(O.none());
        const failure = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "makeTempDirectoryScoped",
          pathOrDescriptor: "second fixture root",
          description: "injected acquisition failure",
        });
        yield* Effect.addFinalizer(
          Effect.fnUntraced(function* () {
            for (const directory of yield* Ref.get(roots)) {
              if (yield* fs.exists(directory).pipe(Effect.orDie)) {
                yield* fs.chmod(directory, 0o700).pipe(Effect.orDie);
                yield* fs.remove(directory, { recursive: true }).pipe(Effect.orDie);
              }
            }
          })
        );
        const failAcquisition = mode === "second acquisition failure" || mode === "second acquisition interruption";
        const failedReleaseIndex = mode === "repository cleanup failure" ? 0 : 1;
        const observedFs = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: Effect.fnUntraced(function* (
            options: Parameters<FileSystem.FileSystem["makeTempDirectoryScoped"]>[0]
          ) {
            const count = yield* Ref.updateAndGet(acquisitions, (n) => n + 1);
            if (count === 2 && failAcquisition) {
              if (mode === "second acquisition interruption") return yield* Effect.interrupt;
              return yield* failure;
            }
            const directory = yield* Effect.acquireRelease(fs.makeTempDirectory(options), (directory) =>
              fs.remove(directory, { recursive: true }).pipe(
                Effect.tapError((error) => Ref.set(removalError, O.some(error))),
                Effect.orDie
              )
            );
            yield* Ref.update(roots, A.append(directory));
            return directory;
          }),
          writeFileString: Effect.fnUntraced(function* () {
            const acquired = yield* Ref.get(roots);
            expect(acquired).toHaveLength(2);
            const deniedRoot = acquired[failedReleaseIndex];
            // Narrow before using the indexed root so a missing acquisition cannot pass the control.
            assertTrue(deniedRoot !== undefined);
            yield* fs.writeFileString(path.join(deniedRoot, "cleanup-witness"), "retained\n");
            yield* fs.chmod(deniedRoot, 0o000);
            return yield* failure;
          }),
        });
        const exit = yield* outsideWorkspaceScenario().pipe(
          Effect.provideService(FileSystem.FileSystem, observedFs),
          Effect.scoped,
          Effect.exit
        );
        assertTrue(exit._tag === "Failure");
        expect(yield* Ref.get(acquisitions)).toBe(2);
        const acquired = yield* Ref.get(roots);
        if (failAcquisition) {
          expect(acquired).toHaveLength(1);
          if (mode === "second acquisition interruption") {
            exit.cause.pipe(Cause.hasInterruptsOnly, assertTrue);
          } else {
            const expected = Cause.annotate(Cause.fail(failure), Cause.annotations(exit.cause));
            assertExitFailure(exit, expected);
            expect(() =>
              assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
            ).toThrow();
            expect(() =>
              assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
            ).toThrow();
          }
          for (const directory of acquired) expect(yield* fs.exists(directory)).toBe(false);
          return;
        }
        {
          const error = O.getOrThrow(yield* Ref.get(removalError));
          assertInstanceOf(error.reason, PlatformError.SystemError);
          expect(error.reason._tag).toBe("PermissionDenied");
          expect(error.reason.method).toBe("remove");
          expect(error.reason.pathOrDescriptor).toBe(acquired[failedReleaseIndex]);
          const expected = Cause.annotate(
            Cause.combine(Cause.fail(failure), Cause.die(error)),
            Cause.annotations(exit.cause)
          );
          assertExitFailure(exit, expected);
          const wrongDie = Cause.annotate(
            Cause.combine(Cause.fail(failure), Cause.die(new Error("boom"))),
            Cause.annotations(exit.cause)
          );
          expect(() => assertExitFailure(Exit.failCause(wrongDie), expected)).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
          ).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
          ).toThrow();
          expect(acquired).toHaveLength(2);
          yield* Effect.forEach(
            acquired,
            Effect.fnUntraced(function* (directory, index) {
              expect(yield* fs.exists(directory)).toBe(index === failedReleaseIndex);
            }),
            { discard: true }
          );
        }
      })
    );
  }
});
