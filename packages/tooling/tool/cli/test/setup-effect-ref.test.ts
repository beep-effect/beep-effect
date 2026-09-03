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
  it.effect("replaces a stale remote-cache token reference only when explicitly enabled", () =>
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
            "TURBO_TOKEN=op://old-vault/old-item/password",
            "TURBO_TEAM=existing-team",
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
                TURBO_TEAM: "replacement-team",
                TURBO_TOKEN_REF: "op://new-vault/new-item/password",
                TURBO_TOKEN_REPLACE: "1",
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
        expect(result.stdout).toContain("replaced TURBO_TOKEN (prior: reference old-vault/old-item)");
        const configured = yield* fs.readFileString(path.join(repoRoot, ".env"));
        expect(configured).toContain("TURBO_TOKEN=op://new-vault/new-item/password");
        expect(configured).toContain("TURBO_API=https://existing.example.test");
        expect(configured).toContain("TURBO_TEAM=existing-team");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
  it.effect("replaces a resolved remote-cache token without rendering it", () =>
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
            "TURBO_TOKEN=resolved-value-must-not-appear",
            "TURBO_TEAM=existing-team",
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
                TURBO_TEAM: "replacement-team",
                TURBO_TOKEN_REF: "op://new-vault/new-item/password",
                TURBO_TOKEN_REPLACE: "1",
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
        expect(result.stdout).toContain("replaced TURBO_TOKEN (prior: raw value (not shown))");
        expect(result.stdout).not.toContain("resolved-value-must-not-appear");
        expect(yield* fs.readFileString(path.join(repoRoot, ".env"))).toContain(
          "TURBO_TOKEN=op://new-vault/new-item/password"
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
  it.effect("rejects an incomplete replacement reference without modifying the configured token", () =>
    withTempDirectory((tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ambientPath = yield* Config.string("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/enable-turbo-remote-reads.sh", import.meta.url)
        );
        const repoRoot = path.join(tempDir, "repo");
        const envPath = path.join(repoRoot, ".env");
        const original = [
          "TURBO_API=https://existing.example.test",
          "TURBO_TOKEN=op://existing/item/field",
          "TURBO_TEAM=existing-team",
          "TURBO_CACHE=local:rw,remote:r",
          "",
        ].join("\n");
        yield* fs.makeDirectory(repoRoot, { recursive: true });
        yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}\n");
        yield* fs.writeFileString(envPath, original);

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* ChildProcess.make("bash", [setupScriptPath, repoRoot], {
              cwd: tempDir,
              env: {
                PATH: ambientPath,
                TURBO_API: "https://replacement.example.test",
                TURBO_TEAM: "replacement-team",
                TURBO_TOKEN_REF: "op://vault-only",
                TURBO_TOKEN_REPLACE: "1",
              },
              stdin: "ignore",
              stderr: "pipe",
              stdout: "pipe",
            });
            const [exitCode, stderr] = yield* Effect.all(
              [handle.exitCode, handle.stderr.pipe(Stream.decodeText(), Stream.mkString)],
              { concurrency: "unbounded" }
            );
            return { exitCode, stderr };
          })
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
          "TURBO_TOKEN_REF must be a 1Password reference (op://vault/item/field), never a token value"
        );
        expect(yield* fs.readFileString(envPath)).toBe(original);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
  it.effect("rejects duplicate remote-cache assignments without modifying the file", () =>
    withTempDirectory((tempDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ambientPath = yield* Config.string("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/enable-turbo-remote-reads.sh", import.meta.url)
        );
        const repoRoot = path.join(tempDir, "repo");
        const envPath = path.join(repoRoot, ".env");
        const original = [
          "TURBO_API=https://existing.example.test",
          "TURBO_TOKEN=op://existing/item/field",
          'TURBO_TEAM=""',
          "TURBO_TEAM=existing-team",
          "TURBO_CACHE=local:rw,remote:r",
          "",
        ].join("\n");
        yield* fs.makeDirectory(repoRoot, { recursive: true });
        yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}\n");
        yield* fs.writeFileString(envPath, original);

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
            const [exitCode, stderr] = yield* Effect.all(
              [handle.exitCode, handle.stderr.pipe(Stream.decodeText(), Stream.mkString)],
              { concurrency: "unbounded" }
            );
            return { exitCode, stderr };
          })
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("duplicate TURBO_TEAM assignments in .env; refusing to modify it");
        expect(yield* fs.readFileString(envPath)).toBe(original);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
