import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const writeExecutable = Effect.fn("SetupEffectRefTest.writeExecutable")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});

const withTempDirectory = <A, E, R>(use: (tempDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "setup-effect-ref-test-" });
    }),
    use,
    (tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tempDir, { force: true, recursive: true });
      })
  );

describe("setup-effect-ref", () => {
  it.effect("resolves a missing relative Effect checkout without GNU realpath", () =>
    withTempDirectory((tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ambientPath = yield* Config.string("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/setup-effect-ref.sh", import.meta.url)
        );
        const binDir = path.join(tempDir, "bin");
        const repoRoot = path.join(tempDir, "repo");
        const workingDirectory = path.join(tempDir, "working");

        yield* Effect.forEach(
          [binDir, repoRoot, workingDirectory],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
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

  it.effect("installs the watcher with the supplied checkout's projects root", () =>
    withTempDirectory((tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ambientPath = yield* Config.string("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/setup-yeet-pr-lease-watcher.sh", import.meta.url)
        );
        const binDir = path.join(tempDir, "bin");
        const configDir = path.join(tempDir, "config");
        const repoRoot = path.join(tempDir, "arbitrary-checkout");

        yield* Effect.forEach(
          [binDir, configDir, repoRoot],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* writeExecutable(path.join(binDir, "systemctl"), "#!/bin/sh\nexit 0\n");

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* ChildProcess.make("bash", [setupScriptPath, repoRoot], {
              cwd: tempDir,
              env: { PATH: `${binDir}:${ambientPath}`, XDG_CONFIG_HOME: configDir },
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

        expect(result.exitCode, result.stderr).toBe(0);
        const unit = yield* fs.readFileString(
          path.join(configDir, "systemd", "user", "beep-yeet-pr-lease-watch.service")
        );
        expect(unit).toContain(`BEEP_YEET_PROJECTS_ROOT=${tempDir}`);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("repairs blank remote-cache placeholders without replacing configured values", () =>
    withTempDirectory((tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ambientPath = yield* Config.string("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/enable-turbo-remote-reads.sh", import.meta.url)
        );
        const repoRoot = path.join(tempDir, "repo");
        yield* fs.makeDirectory(repoRoot, { recursive: true });
        yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}\n");
        yield* fs.writeFileString(
          path.join(repoRoot, ".env"),
          [
            "TURBO_API=https://existing.example.test",
            "TURBO_TOKEN=op://existing/item/field",
            'TURBO_TEAM=""',
            "TURBO_CACHE=local:rw,remote:r",
            "",
          ].join("\n")
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* ChildProcess.make("bash", [setupScriptPath, repoRoot], {
              cwd: tempDir,
              env: {
                PATH: ambientPath,
                TURBO_API: "https://replacement.example.test",
                TURBO_TEAM: "configured-team",
                TURBO_TOKEN_REF: "op://replacement/item/field",
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

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain("repaired blank TURBO_TEAM=configured-team");
        expect(result.stdout).toContain("bun run check --filter=@beep/types --dry=json");
        const configured = yield* fs.readFileString(path.join(repoRoot, ".env"));
        expect(configured).toContain("TURBO_API=https://existing.example.test");
        expect(configured).toContain("TURBO_TOKEN=op://existing/item/field");
        expect(configured).toContain("TURBO_TEAM=configured-team");
        expect(configured).not.toContain("replacement.example.test");
        expect(configured).not.toContain("op://replacement/item/field");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
