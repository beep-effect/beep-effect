import { collectTypeScriptFiles } from "@beep/repo-cli/test/Lint";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { assertExitFailure, assertInstanceOf, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";

const lintSecurityScenario = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-lint-security-" });
  const repoRoot = path.join(tmpDir, "repo");
  const sourceRoot = path.join(repoRoot, "src");
  const externalRoot = path.join(tmpDir, "external");
  const loopLink = path.join(sourceRoot, "loop");
  const escapeLink = path.join(sourceRoot, "escape");
  const internalFile = path.join(sourceRoot, "index.ts");
  const externalFile = path.join(externalRoot, "escape.ts");

  yield* fs.makeDirectory(sourceRoot, { recursive: true });
  yield* fs.makeDirectory(externalRoot, { recursive: true });
  yield* fs.writeFileString(internalFile, "export const ok = true;\n");
  yield* fs.writeFileString(externalFile, "export const nope = true;\n");
  yield* fs.symlink(sourceRoot, loopLink);
  yield* fs.symlink(externalRoot, escapeLink);

  const files = yield* collectTypeScriptFiles(sourceRoot);

  expect(files).toEqual([internalFile]);
});

layer(NodeServices.layer, { timeout: "5 seconds" })("Lint security", (it) => {
  describe("collectTypeScriptFiles", () => {
    it.effect("skips symlinked directories that loop or escape the lint root", lintSecurityScenario);
  });
  for (const mode of ["setup failure", "body failure", "interruption", "cleanup failure"]) {
    it.effect(
      `lint fixture releases its native root after ${mode}`,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* Ref.make("");
        const faulted = yield* Ref.make(false);
        const removalError = yield* Ref.make<O.Option<PlatformError.PlatformError>>(O.none());
        const failure = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "makeDirectory",
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
          makeDirectory: Effect.fnUntraced(function* (
            target: string,
            options: Parameters<FileSystem.FileSystem["makeDirectory"]>[1]
          ) {
            if (mode === "body failure") return yield* fs.makeDirectory(target, options);
            yield* Ref.set(faulted, true);
            if (mode === "cleanup failure") {
              const directory = yield* Ref.get(root);
              yield* fs.writeFileString(path.join(directory, "cleanup-witness"), "retained\n");
              yield* fs.chmod(directory, 0o000);
            }
            if (mode === "interruption") return yield* Effect.interrupt;
            return yield* failure;
          }),
          readDirectory: Effect.fnUntraced(function* (
            target: string,
            options: Parameters<FileSystem.FileSystem["readDirectory"]>[1]
          ) {
            if (mode !== "body failure") return yield* fs.readDirectory(target, options);
            yield* Ref.set(faulted, true);
            return yield* Effect.die(failure);
          }),
        });
        const exit = yield* lintSecurityScenario().pipe(
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
