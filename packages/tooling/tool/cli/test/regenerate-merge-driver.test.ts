import { fileURLToPath } from "node:url";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertExitFailure, assertInstanceOf, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";

const sourceRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const driverPath = `${sourceRoot}scripts/regenerate-merge-driver.sh`;
const setupPath = `${sourceRoot}scripts/setup-regenerate-merge-driver.sh`;
const mergeDriverScenario = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-regenerate-driver-" });
  const git = (args: ReadonlyArray<string>) =>
    Bun.spawnSync({ cmd: ["git", ...args], cwd: root, stderr: "pipe", stdout: "pipe" });
  expect(git(["init"]).exitCode).toBe(0);

  const ancestor = path.join(root, "ancestor");
  const current = path.join(root, "current");
  const other = path.join(root, "other");
  yield* fs.writeFileString(ancestor, "ancestor\n");
  yield* fs.writeFileString(current, "current\n");
  yield* fs.writeFileString(other, "other\n");
  const generated = Bun.spawnSync({
    cmd: [driverPath, ancestor, current, other, "tsconfig.json"],
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  expect(generated.exitCode).not.toBe(0);
  expect(generated.stderr.toString()).toContain("left tsconfig.json conflicted");
  expect(yield* fs.readFileString(current)).toBe("current\n");

  const refused = Bun.spawnSync({
    cmd: [driverPath, ancestor, current, other, "bun.lock"],
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  expect(refused.exitCode).not.toBe(0);
  expect(refused.stderr.toString()).toContain("refused non-projection path: bun.lock");

  const installed = Bun.spawnSync({
    cmd: [setupPath, root],
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  expect(installed.exitCode, installed.stderr.toString()).toBe(0);
  const configured = git(["config", "--local", "--get", "merge.regenerate.driver"]);
  expect(configured.exitCode).toBe(0);
  expect(configured.stdout.toString()).toContain("scripts/regenerate-merge-driver.sh");
});

it.layer(NodeServices.layer, { timeout: "5 seconds" })("regenerate merge driver", (it) => {
  it.effect("leaves allowlisted projections conflicted until the merged tree is available", mergeDriverScenario);
  for (const mode of ["setup failure", "body failure", "interruption", "cleanup failure"]) {
    it.effect(
      `merge-driver fixture releases its native root after ${mode}`,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* Ref.make("");
        const faulted = yield* Ref.make(false);
        const removalError = yield* Ref.make<O.Option<PlatformError.PlatformError>>(O.none());
        const failure = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "writeFileString",
          pathOrDescriptor: "resource-control",
          description: "injected fixture failure",
        });
        // Rescue is outside the observed scope: failed assertions cannot leave mode-000 residue.
        yield* Effect.addFinalizer(
          Effect.fnUntraced(function* () {
            const directory = yield* Ref.get(root);
            if (directory !== "" && (yield* fs.exists(directory).pipe(Effect.orDie))) {
              yield* fs.chmod(directory, 0o700).pipe(Effect.orDie);
              yield* fs.remove(directory, { recursive: true }).pipe(Effect.orDie);
            }
          })
        );
        const observedFs = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: Effect.fnUntraced(function* (
            options: Parameters<FileSystem.FileSystem["makeTempDirectoryScoped"]>[0]
          ) {
            const directory = yield* Effect.acquireRelease(fs.makeTempDirectory(options), (directory) =>
              fs.remove(directory, { recursive: true }).pipe(
                Effect.tapError((error) => Ref.set(removalError, O.some(error))),
                Effect.orDie
              )
            );
            yield* Ref.set(root, directory);
            return directory;
          }),
          writeFileString: Effect.fnUntraced(function* (
            target: string,
            options: Parameters<FileSystem.FileSystem["writeFileString"]>[1]
          ) {
            if (mode === "body failure") return yield* fs.writeFileString(target, options);
            yield* Ref.set(faulted, true);
            if (mode === "cleanup failure") {
              const directory = yield* Ref.get(root);
              yield* fs.writeFileString(path.join(directory, "cleanup-witness"), "retained\n");
              yield* fs.chmod(directory, 0o000);
            }
            if (mode === "interruption") return yield* Effect.interrupt;
            return yield* failure;
          }),
          readFileString: Effect.fnUntraced(function* (
            target: string,
            options: Parameters<FileSystem.FileSystem["readFileString"]>[1]
          ) {
            if (mode !== "body failure") return yield* fs.readFileString(target, options);
            yield* Ref.set(faulted, true);
            return yield* Effect.die(failure);
          }),
        });
        const exit = yield* mergeDriverScenario().pipe(
          Effect.provideService(FileSystem.FileSystem, observedFs),
          Effect.scoped,
          Effect.exit
        );
        assertTrue(exit._tag === "Failure");
        if (mode === "interruption") {
          exit.cause.pipe(Cause.hasInterruptsOnly, assertTrue);
        } else if (mode !== "cleanup failure") {
          const expected = Cause.annotate(
            mode === "body failure" ? Cause.die(failure) : Cause.fail(failure),
            Cause.annotations(exit.cause)
          );
          assertExitFailure(exit, expected);
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
          ).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
          ).toThrow();
        }
        const directory = yield* Ref.get(root);
        expect(directory).not.toBe("");
        expect(yield* Ref.get(faulted)).toBe(true);
        if (mode === "cleanup failure") {
          const error = O.getOrThrow(yield* Ref.get(removalError));
          assertInstanceOf(error.reason, PlatformError.SystemError);
          expect(error.reason._tag).toBe("PermissionDenied");
          expect(error.reason.method).toBe("remove");
          expect(error.reason.pathOrDescriptor).toBe(directory);
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
          expect(yield* fs.exists(directory)).toBe(true);
        } else {
          expect(yield* fs.exists(directory)).toBe(false);
        }
      })
    );
  }
});
