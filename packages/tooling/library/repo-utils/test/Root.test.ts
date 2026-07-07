import { findRepoRoot } from "@beep/repo-utils/Root";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import * as Fs from "effect/FileSystem";

layer(NodeFileSystem.layer)("Root", (it) => {
  describe("findRepoRoot", () => {
    it.effect(
      "should find repo root from current directory",
      Effect.fn(function* () {
        const root = yield* findRepoRoot();
        // The repo root should contain a .git directory
        const fs = yield* Fs.FileSystem;
        const hasGit = yield* fs.exists(`${root}/.git`);
        expect(hasGit).toBe(true);
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
        // First find the actual root
        const root = yield* findRepoRoot();
        // Then verify starting from root finds root
        const rootAgain = yield* findRepoRoot(root);
        expect(rootAgain).toBe(root);
      })
    );

    it.effect(
      "should fail with NoSuchFileError when no marker is found",
      Effect.fn(function* () {
        const markerFreeFileSystem = Fs.makeNoop({
          exists: () => Effect.succeed(false),
        });

        const result = yield* findRepoRoot("/marker-free/deep/nested/dir").pipe(
          Effect.provideService(Fs.FileSystem, markerFreeFileSystem),
          Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e._tag}`))
        );
        expect(result).toBe("caught: NoSuchFileError");
      })
    );

    it.effect(
      "should detect bun.lock as a root marker",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const subDir = `${tmpDir}/sub/dir`;
        yield* fs.makeDirectory(subDir, { recursive: true });

        // Create a bun.lock at the tmp root
        yield* fs.writeFileString(`${tmpDir}/bun.lock`, "");

        const root = yield* findRepoRoot(subDir);
        expect(root).toBe(tmpDir);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "should detect .git as a root marker",
      Effect.fn(function* () {
        const fs = yield* Fs.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        const subDir = `${tmpDir}/a/b/c`;
        yield* fs.makeDirectory(subDir, { recursive: true });

        // Create a .git directory at the tmp root
        yield* fs.makeDirectory(`${tmpDir}/.git`);

        const root = yield* findRepoRoot(subDir);
        expect(root).toBe(tmpDir);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });
});
