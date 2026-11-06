import {
  resolvePathWithinCanonicalRoot,
  writeFileWithinCanonicalRootAtomically,
  writeFileWithinRootAtomically,
} from "@beep/file-processing/PathSafety";
import { it } from "@beep/test-runner";
import { currentHostPlatform } from "@beep/utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";

const PathSafetyTestLayer = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const payload = new TextEncoder().encode("safe payload");

it.layer(PathSafetyTestLayer)("@beep/file-processing PathSafety — native filesystem", (it) => {
  it.effect(
    "writes nested bytes atomically and removes temporary artifacts",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const target = yield* writeFileWithinRootAtomically({
        root,
        candidate: "nested/report.bin",
        bytes: payload,
      });

      expect(target).toBe(path.join(root, "nested", "report.bin"));
      const argument = new TextDecoder();
      const readFile1 = yield* fs.readFile(target);
      expect(argument.decode(readFile1)).toBe("safe payload");
      const readDirectory1 = yield* fs.readDirectory(path.dirname(target));
      expect(readDirectory1).toEqual(["report.bin"]);
      yield* Effect.flip(fs.readLink(target));
      expect((yield* fs.stat(target)).mode & 0o777).toBe(0o600);
    })
  );

  it.effect(
    "rejects the root itself before the first mutating filesystem operation",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const makeDirectoryCalls = yield* Ref.make(0);
      const instrumentedFileSystem: FileSystem.FileSystem = {
        ...fs,
        makeDirectory: (target, options) =>
          Ref.update(makeDirectoryCalls, (count) => count + 1).pipe(Effect.andThen(fs.makeDirectory(target, options))),
      };

      yield* Effect.flip(
        writeFileWithinRootAtomically({ root, candidate: ".", bytes: payload }).pipe(
          Effect.provideService(FileSystem.FileSystem, instrumentedFileSystem)
        )
      );

      const got = yield* Ref.get(makeDirectoryCalls);
      expect(got).toBe(0);
      const readDirectory2 = yield* fs.readDirectory(root);
      expect(readDirectory2).toEqual([]);
    })
  );

  it.effect(
    "refuses a pre-positioned temporary payload symlink even if the temporary directory is compromised",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const outsideRoot = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-outside-" });
      const outsideVictim = path.join(outsideRoot, "victim.bin");
      const compromisedTemporaryDirectory = path.join(root, ".result.bin.tmp-compromised");

      yield* fs.writeFileString(outsideVictim, "unchanged");
      yield* fs.makeDirectory(compromisedTemporaryDirectory);
      yield* fs.symlink(outsideVictim, path.join(compromisedTemporaryDirectory, "payload"));

      const compromisedFileSystem: FileSystem.FileSystem = {
        ...fs,
        makeTempDirectory: () => Effect.succeed(compromisedTemporaryDirectory),
      };
      yield* Effect.flip(
        writeFileWithinRootAtomically({ root, candidate: "result.bin", bytes: payload }).pipe(
          Effect.provideService(FileSystem.FileSystem, compromisedFileSystem)
        )
      );

      const readFileString3 = yield* fs.readFileString(outsideVictim);
      expect(readFileString3).toBe("unchanged");
      const exists4 = yield* fs.exists(path.join(root, "result.bin"));
      expect(exists4).toBe(false);
      const exists5 = yield* fs.exists(compromisedTemporaryDirectory);
      expect(exists5).toBe(false);
    })
  );

  it.effect(
    "removes the temporary directory when promotion fails",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      yield* fs.makeDirectory(`${root}/blocked`);

      yield* Effect.flip(writeFileWithinRootAtomically({ root, candidate: "blocked", bytes: payload }));

      const readDirectory6 = yield* fs.readDirectory(root);
      expect(readDirectory6).toEqual(["blocked"]);
    })
  );

  it.effect(
    "keeps the committed target successful when post-rename cleanup fails",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const cleanupAttempts = yield* Ref.make(0);
      const cleanupFailure = PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "remove",
        description: "simulated temporary-directory cleanup failure",
      });
      const failingCleanupFileSystem: FileSystem.FileSystem = {
        ...fs,
        remove: () =>
          Ref.update(cleanupAttempts, (count) => count + 1).pipe(Effect.andThen(Effect.fail(cleanupFailure))),
      };

      const target = yield* writeFileWithinRootAtomically({
        root,
        candidate: "result.bin",
        bytes: payload,
      }).pipe(Effect.provideService(FileSystem.FileSystem, failingCleanupFileSystem));

      expect(target).toBe(path.join(root, "result.bin"));
      const got7 = yield* Ref.get(cleanupAttempts);
      expect(got7).toBe(1);
      const readFileString8 = yield* fs.readFileString(target);
      expect(readFileString8).toBe("safe payload");
    })
  );

  it.effect(
    "surfaces cleanup failure when promotion has not committed",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const cleanupAttempts = yield* Ref.make(0);
      const cleanupFailure = PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "remove",
        description: "simulated temporary-directory cleanup failure",
      });
      const failingCleanupFileSystem: FileSystem.FileSystem = {
        ...fs,
        remove: () =>
          Ref.update(cleanupAttempts, (count) => count + 1).pipe(Effect.andThen(Effect.fail(cleanupFailure))),
      };

      yield* fs.makeDirectory(`${root}/blocked`);
      const error = yield* writeFileWithinRootAtomically({
        root,
        candidate: "blocked",
        bytes: payload,
      }).pipe(Effect.provideService(FileSystem.FileSystem, failingCleanupFileSystem), Effect.flip);

      expect(error).toBe(cleanupFailure);
      const got9 = yield* Ref.get(cleanupAttempts);
      expect(got9).toBe(1);
      expect((yield* fs.stat(`${root}/blocked`)).type).toBe("Directory");
    })
  );

  it.effect(
    "keeps an already-canonical authority root pinned across a lexical root symlink swap",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const configuredRoot = path.join(sandbox, "workspace");
      const movedRoot = path.join(sandbox, "workspace-moved");
      const outsideRoot = path.join(sandbox, "outside");
      const outsideVictim = path.join(outsideRoot, "victim.bin");
      yield* fs.makeDirectory(configuredRoot);
      yield* fs.makeDirectory(outsideRoot);
      yield* fs.writeFileString(outsideVictim, "unchanged");
      const canonicalRoot = yield* fs.realPath(configuredRoot);

      yield* fs.rename(configuredRoot, movedRoot);
      yield* fs.symlink(outsideRoot, configuredRoot);

      yield* Effect.flip(resolvePathWithinCanonicalRoot({ canonicalRoot, candidate: "victim.bin" }));
      yield* Effect.flip(
        writeFileWithinCanonicalRootAtomically({ canonicalRoot, candidate: "victim.bin", bytes: payload })
      );

      const readFileString10 = yield* fs.readFileString(outsideVictim);
      expect(readFileString10).toBe("unchanged");
      const readLink11 = yield* fs.readLink(configuredRoot);
      expect(readLink11).toBe(outsideRoot);
    })
  );

  it.effect(
    "rejects a non-absolute canonical authority root before resolving or writing a candidate",
    Effect.fnUntraced(function* () {
      const resolveError = yield* resolvePathWithinCanonicalRoot({
        canonicalRoot: "relative-root",
        candidate: "victim.bin",
      }).pipe(Effect.flip);
      const writeError = yield* writeFileWithinCanonicalRootAtomically({
        canonicalRoot: "relative-root",
        candidate: "victim.bin",
        bytes: payload,
      }).pipe(Effect.flip);

      expect(resolveError.reason).toBe("canonical-root-not-absolute");
      expect(writeError).toMatchObject({ reason: "canonical-root-not-absolute" });
    })
  );

  it.effect.skipIf(Eq.equals(currentHostPlatform, "win32"))(
    "POSIX only: rejects a symlink escape through an outside sibling containing a literal backslash",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      expect(path.sep).toBe("/");

      const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const root = path.join(sandbox, "workspace");
      const outsideRoot = path.join(sandbox, "workspace\\evil");
      const outsideVictim = path.join(outsideRoot, "victim.bin");
      const link = path.join(root, "linked.bin");
      yield* fs.makeDirectory(root);
      yield* fs.makeDirectory(outsideRoot);
      yield* fs.writeFileString(outsideVictim, "unchanged");
      yield* fs.symlink(outsideVictim, link);
      const canonicalRoot = yield* fs.realPath(root);

      yield* Effect.flip(resolvePathWithinCanonicalRoot({ canonicalRoot, candidate: "linked.bin" }));
      yield* Effect.flip(
        writeFileWithinCanonicalRootAtomically({ canonicalRoot, candidate: "linked.bin", bytes: payload })
      );

      const readFileString12 = yield* fs.readFileString(outsideVictim);
      expect(readFileString12).toBe("unchanged");
      const readLink13 = yield* fs.readLink(link);
      expect(readLink13).toBe(outsideVictim);
    })
  );
});
