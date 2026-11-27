import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fs from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

describe("Root", () => {
  describe("findRepoRoot", () => {
    it.layer(NodeFileSystem.layer, { timeout: "10 seconds" })((it) => {
      it.effect(
        "should find repo root from current directory",
        Effect.fn(function* () {
          const root = yield* findRepoRoot();
          const fs = yield* Fs.FileSystem;
          const hasGit = yield* fs.exists(`${root}/.git`);
          expect(hasGit, "the repo root found from the current directory holds .git").toBe(true);
        })
      );

      it.effect(
        "should find repo root from a subdirectory",
        Effect.fn(function* () {
          const root = yield* findRepoRoot(`${__dirname}/../src/errors`);
          const fs = yield* Fs.FileSystem;
          const hasGit = yield* fs.exists(`${root}/.git`);
          expect(hasGit).toBe(true);
        })
      );

      it.effect(
        "should find repo root when starting from itself",
        Effect.fn(function* () {
          const root = yield* findRepoRoot();
          const rootAgain = yield* findRepoRoot(root);
          expect(rootAgain).toBe(root);
        })
      );
    });

    it.layer(Layer.succeed(Fs.FileSystem, Fs.makeNoop({ exists: () => Effect.succeed(false) })), {
      timeout: "10 seconds",
    })((it) => {
      it.effect(
        "should fail with NoSuchFileError when no marker is found",
        Effect.fn(function* () {
          const result = yield* findRepoRoot("/beep-repo-utils-root/deep/nested/dir").pipe(
            Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e._tag}`))
          );
          expect(result).toBe("caught: NoSuchFileError");
        })
      );
    });

    describe("lexical ascent", () => {
      const onlyMarkers = (...markers: ReadonlyArray<string>) =>
        Effect.provideService(
          Fs.FileSystem,
          Fs.makeNoop({ exists: (candidate) => Effect.succeed(A.contains(markers, candidate)) })
        );

      it.effect(
        "stops a relative start at '.' instead of jumping to the filesystem root",
        Effect.fn(function* () {
          const error = yield* findRepoRoot("a/b").pipe(onlyMarkers("/.git", "/bun.lock"), Effect.flip);
          expect(error._tag).toBe("NoSuchFileError");
          expect(error.message).toBe('Could not find repository root (looked for .git, bun.lock) starting from "a/b"');
        })
      );

      it.effect(
        "never answers '.' for a parent-relative start, which is not an ancestor of it",
        Effect.fn(function* () {
          const error = yield* findRepoRoot("../other/pkg").pipe(onlyMarkers(".git"), Effect.flip);
          expect(error._tag).toBe("NoSuchFileError");
        })
      );

      it.effect(
        "finds a marker in the relative root '.'",
        Effect.fn(function* () {
          const root = yield* findRepoRoot("a/b").pipe(onlyMarkers(".git"));
          expect(root).toBe(".");
        })
      );

      it.effect(
        "returns the marked directory without a trailing separator",
        Effect.fn(function* () {
          const root = yield* findRepoRoot("/repo/").pipe(onlyMarkers("/repo/bun.lock"));
          expect(root).toBe("/repo");
        })
      );
    });

    it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), {
      timeout: "10 seconds",
    })((it) => {
      it.effect(
        "should detect bun.lock as a root marker",
        Effect.fn(function* () {
          const fs = yield* Fs.FileSystem;
          const tmpDir = yield* fs.makeTempDirectoryScoped();
          const subDir = `${tmpDir}/sub/dir`;
          yield* fs.makeDirectory(subDir, { recursive: true });

          yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");

          const root = yield* findRepoRoot(subDir);
          expect(root).toBe(tmpDir);
        })
      );

      it.effect(
        "should detect .git as a root marker",
        Effect.fn(function* () {
          const fs = yield* Fs.FileSystem;
          const tmpDir = yield* fs.makeTempDirectoryScoped();
          const subDir = `${tmpDir}/a/b/c`;
          yield* fs.makeDirectory(subDir, { recursive: true });

          yield* fs.makeDirectory(`${tmpDir}/.git`);

          const root = yield* findRepoRoot(subDir);
          expect(root).toBe(tmpDir);
        })
      );
    });
  });
});
