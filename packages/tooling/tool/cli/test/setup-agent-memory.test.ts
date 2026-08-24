import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const writeExecutable = Effect.fn("SetupAgentMemoryTest.writeExecutable")(function* (
  filePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});

const withTempDirectory = <A, E, R>(use: (tempDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "setup-agent-memory-test-" });
    }),
    use,
    (tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tempDir, { force: true, recursive: true });
      })
  );

describe("setup-agent-memory", () => {
  it.effect("resolves a missing relative Effect checkout without GNU realpath", () =>
    withTempDirectory((tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ambientPath = yield* Config.string("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/setup-agent-memory.sh", import.meta.url)
        );
        const binDir = path.join(tempDir, "bin");
        const repoRoot = path.join(tempDir, "repo");
        const storeDir = path.join(tempDir, "store");
        const workingDirectory = path.join(tempDir, "working");

        yield* Effect.forEach(
          [binDir, repoRoot, storeDir, workingDirectory],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* writeExecutable(path.join(binDir, "uvx"), "#!/bin/sh\nprintf 'beep-shared\\n'\n");
        yield* writeExecutable(path.join(binDir, "codegraph"), "#!/bin/sh\nexit 0\n");
        yield* writeExecutable(
          path.join(binDir, "git"),
          '#!/bin/sh\nif [ "$1" = "clone" ]; then\n  for argument do target=$argument; done\n  mkdir -p "$target/.git"\nfi\n'
        );
        yield* writeExecutable(
          path.join(binDir, "realpath"),
          "#!/bin/sh\nprintf 'realpath must not be called\\n' >&2\nexit 91\n"
        );

        const canonicalWorkingDirectory = yield* fs.realPath(workingDirectory);
        const expectedEffectRef = path.join(canonicalWorkingDirectory, "effect-reference");
        expect(yield* fs.exists(expectedEffectRef)).toBe(false);

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* ChildProcess.make("bash", [setupScriptPath, repoRoot], {
              cwd: workingDirectory,
              env: {
                BEEP_EFFECT_CHECKOUT: "missing-segment/../effect-reference",
                BEEP_SHARED_STORE: storeDir,
                PATH: `${binDir}:${ambientPath}`,
              },
              stdin: "ignore",
              stderr: "pipe",
              stdout: "pipe",
            });
            const [exitCode, stderr, stdout] = yield* Effect.all(
              [
                handle.exitCode,
                handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
                handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
              ],
              { concurrency: "unbounded" }
            );
            return { exitCode, stderr, stdout };
          })
        );

        expect(result.stderr).toBe("");
        expect(result.exitCode, result.stderr).toBe(0);
        expect(yield* fs.readLink(path.join(repoRoot, ".repos", "effect"))).toBe(expectedEffectRef);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
