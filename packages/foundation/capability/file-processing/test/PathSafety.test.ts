import { writeFileWithinRootAtomically } from "@beep/file-processing/PathSafety";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Ref, Result } from "effect";

const PathSafetyTestLayer = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const payload = new TextEncoder().encode("safe payload");

describe("@beep/file-processing PathSafety", () => {
  it.effect("writes nested bytes atomically and removes temporary artifacts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const target = yield* writeFileWithinRootAtomically({
        root,
        candidate: "nested/report.bin",
        bytes: payload,
      });

      expect(target).toBe(path.join(root, "nested", "report.bin"));
      expect(new TextDecoder().decode(yield* fs.readFile(target))).toBe("safe payload");
      expect(yield* fs.readDirectory(path.dirname(target))).toEqual(["report.bin"]);
      expect(Result.isFailure(yield* Effect.result(fs.readLink(target)))).toBe(true);
      expect((yield* fs.stat(target)).mode & 0o777).toBe(0o600);
    }).pipe(provideScopedLayer(PathSafetyTestLayer))
  );

  it.effect("rejects the root itself before the first mutating filesystem operation", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      const makeDirectoryCalls = yield* Ref.make(0);
      const instrumentedFileSystem: FileSystem.FileSystem = {
        ...fs,
        makeDirectory: (target, options) =>
          Ref.update(makeDirectoryCalls, (count) => count + 1).pipe(Effect.andThen(fs.makeDirectory(target, options))),
      };

      const result = yield* Effect.result(
        writeFileWithinRootAtomically({ root, candidate: ".", bytes: payload }).pipe(
          Effect.provideService(FileSystem.FileSystem, instrumentedFileSystem)
        )
      );

      expect(Result.isFailure(result)).toBe(true);
      expect(yield* Ref.get(makeDirectoryCalls)).toBe(0);
      expect(yield* fs.readDirectory(root)).toEqual([]);
    }).pipe(provideScopedLayer(PathSafetyTestLayer))
  );

  it.effect("refuses a pre-positioned temporary payload symlink even if the temporary directory is compromised", () =>
    Effect.gen(function* () {
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
      const result = yield* Effect.result(
        writeFileWithinRootAtomically({ root, candidate: "result.bin", bytes: payload }).pipe(
          Effect.provideService(FileSystem.FileSystem, compromisedFileSystem)
        )
      );

      expect(Result.isFailure(result)).toBe(true);
      expect(yield* fs.readFileString(outsideVictim)).toBe("unchanged");
      expect(yield* fs.exists(path.join(root, "result.bin"))).toBe(false);
      expect(yield* fs.exists(compromisedTemporaryDirectory)).toBe(false);
    }).pipe(provideScopedLayer(PathSafetyTestLayer))
  );

  it.effect("removes the temporary directory when promotion fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-path-safety-" });
      yield* fs.makeDirectory(`${root}/blocked`);

      const result = yield* Effect.result(
        writeFileWithinRootAtomically({ root, candidate: "blocked", bytes: payload })
      );

      expect(Result.isFailure(result)).toBe(true);
      expect(yield* fs.readDirectory(root)).toEqual(["blocked"]);
    }).pipe(provideScopedLayer(PathSafetyTestLayer))
  );
});
