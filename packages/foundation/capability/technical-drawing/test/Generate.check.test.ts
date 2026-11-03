import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";

it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  it.effect("exposes check mode through the real CLI without reading font inputs", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = path.resolve(import.meta.dirname, "..");
      const handle = yield* spawner.spawn(
        ChildProcess.make("bun", ["--no-env-file", path.join(root, "scripts/generate-label-glyphs.ts"), "--help"], {
          cwd: root,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          Stream.mkString(Stream.decodeText(handle.stdout)),
          Stream.mkString(Stream.decodeText(handle.stderr)),
          handle.exitCode,
        ],
        { concurrency: 3 }
      );
      expect(exitCode).toBe(0);
      expect(stdout + stderr).toContain("--check");
      expect(stdout + stderr).toContain("sans");
      expect(stdout + stderr).toContain("serif");
    })
  );
});
