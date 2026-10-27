import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { collectFiles } from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";

// Lists one entry that no longer exists by the time it is stat'ed: the shape of
// a scoped temporary directory another test tears down mid-walk.
const racingFileSystem = Layer.effect(
  FileSystem.FileSystem,
  Effect.map(FileSystem.FileSystem, (fs) => ({
    ...fs,
    readDirectory: (directory: string, options?: { readonly recursive?: boolean | undefined }) =>
      fs.readDirectory(directory, options).pipe(Effect.map(A.append(".scratch-gone"))),
  }))
).pipe(Layer.provide(MemoryFileSystem.layer));

const failingStat = Layer.effect(
  FileSystem.FileSystem,
  Effect.map(FileSystem.FileSystem, (fs) => ({
    ...fs,
    stat: (file: string) =>
      Effect.fail(
        PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "stat",
          pathOrDescriptor: file,
        })
      ),
  }))
).pipe(Layer.provide(MemoryFileSystem.layer));

const seed = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("/repo/src", { recursive: true });
  yield* fs.writeFileString("/repo/src/keep.ts", "export {};\n");
});

describe("collectFiles under concurrent teardown", () => {
  it.layer(Layer.mergeAll(racingFileSystem, Path.layer), { timeout: "10 seconds" })((it) => {
    it.effect("drops a listed entry that vanished before it was stat'ed and keeps the rest", () =>
      Effect.gen(function* () {
        yield* seed;
        const files = yield* collectFiles(
          "/repo",
          () => true,
          () => false
        );
        expect(files).toEqual(["/repo/src/keep.ts"]);
      })
    );
  });

  it.layer(Layer.mergeAll(failingStat, Path.layer), { timeout: "10 seconds" })((it) => {
    it.effect("still fails the walk on any other stat failure", () =>
      Effect.gen(function* () {
        yield* seed;
        const error = yield* collectFiles(
          "/repo",
          () => true,
          () => false
        ).pipe(Effect.flip);
        expect(error.message).toContain("Failed to stat /repo/src.");
      })
    );
  });
});
