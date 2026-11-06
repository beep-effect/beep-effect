import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";

it.layer(NodeServices.layer, { timeout: "60 seconds" })((it) => {
  it.effect("runs the actual check CLI without replacing an uncommitted generated edit", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const packageRoot = path.resolve(import.meta.dirname, "..");
      const repositoryRoot = path.resolve(packageRoot, "../../../..");
      // This is a disposable package fixture outside the workspace census, not a Git checkout.
      const fixture = yield* fs.makeTempDirectoryScoped({ prefix: "html-generator-check-" });
      yield* fs.copy(path.join(packageRoot, "src"), path.join(fixture, "src"));
      yield* fs.copy(path.join(packageRoot, "data"), path.join(fixture, "data"));
      yield* fs.makeDirectory(path.join(fixture, "scripts"));
      yield* fs.copy(path.join(packageRoot, "scripts/generate.ts"), path.join(fixture, "scripts/generate.ts"));
      yield* fs.symlink(path.join(repositoryRoot, "node_modules"), path.join(fixture, "node_modules"));
      const target = path.join(fixture, "src/Html.model.ts");
      const edited = `${yield* fs.readFileString(target)}\n// Retain this uncommitted generator-check edit.\n`;
      yield* fs.writeFileString(target, edited);
      const siblings = ["Html.meta.ts", "internal/Html.language-tag-registry.generated.ts"];
      const before = yield* Effect.forEach(
        siblings,
        (relative) => fs.readFileString(path.join(fixture, "src", relative)),
        { concurrency: 1 }
      );
      const handle = yield* spawner.spawn(
        ChildProcess.make("bun", ["--no-env-file", path.join(fixture, "scripts/generate.ts"), "--check"], {
          cwd: fixture,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText, Stream.mkString),
          handle.stderr.pipe(Stream.decodeText, Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: 3 }
      );
      expect(exitCode).not.toBe(0);
      expect(stdout + stderr).toContain("Generated output drift detected");
      const retained = yield* fs.readFileString(target);
      expect(retained).toBe(edited);
      const after = yield* Effect.forEach(
        siblings,
        (relative) => fs.readFileString(path.join(fixture, "src", relative)),
        { concurrency: 1 }
      );
      expect(after).toEqual(before);
    })
  );
});
