import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";

const provideNodeServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const writeExecutable = Effect.fn("SetupAgentMemoryTest.writeExecutable")(function* (
  filePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});

describe("setup-agent-memory", () => {
  it("resolves a missing relative Effect checkout without GNU realpath", () =>
    Effect.runPromise(
      provideNodeServices(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-agent-memory-test-" });
          const setupScriptPath = fileURLToPath(
            new URL("../../../../../scripts/setup-agent-memory.sh", import.meta.url)
          );
          const binDir = path.join(tempDir, "bin");
          const repoRoot = path.join(tempDir, "repo");
          const storeDir = path.join(tempDir, "store");
          const workingDirectory = path.join(tempDir, "working");

          yield* Effect.forEach(
            [binDir, repoRoot, storeDir, workingDirectory],
            (directory) => fs.makeDirectory(directory, { recursive: true }),
            { concurrency: "unbounded", discard: true }
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

          const handle = yield* ChildProcess.make("bash", [setupScriptPath, repoRoot], {
            cwd: workingDirectory,
            env: {
              BEEP_EFFECT_CHECKOUT: "missing-segment/../effect-reference",
              BEEP_SETUP_SKIP_USER_SERVICES: "1",
              BEEP_SHARED_STORE: storeDir,
              PATH: `${binDir}:${Bun.env.PATH ?? ""}`,
            },
            extendEnv: true,
            stdin: "ignore",
            stderr: "pipe",
            stdout: "pipe",
          });
          const [exitCode, stderr] = yield* Effect.all(
            [handle.exitCode, Stream.mkString(Stream.decodeText(handle.stderr)), Stream.runDrain(handle.stdout)],
            { concurrency: "unbounded" }
          );

          expect(stderr).toBe("");
          expect(exitCode, stderr).toBe(0);
          expect(yield* fs.readLink(path.join(repoRoot, ".repos", "effect"))).toBe(expectedEffectRef);
        })
      )
    ));
});
