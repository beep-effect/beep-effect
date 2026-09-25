import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess } from "effect/process";

const writeExecutable = Effect.fn("SetupEffectRefTest.writeExecutable")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});
layer(NodeServices.layer, { timeout: "30 seconds" })("setup-effect-ref", (it) => {
  for (const useDefault of [false, true]) {
    it.effect(`provisions reference links idempotently with the ${useDefault ? "default" : "relative"} root`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
        const path = yield* Path.Path;
        const ambientPath = yield* Config.String("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/setup-effect-ref.sh", import.meta.url)
        );
        const binDir = path.join(tempDir, "bin");
        const repoRoot = path.join(tempDir, "repo");
        const workingDirectory = path.join(tempDir, "working");
        const home = path.join(tempDir, "home");
        const gitLog = path.join(tempDir, "git.log");
        const realpathLog = path.join(tempDir, "realpath.log");
        yield* Effect.forEach(
          [binDir, repoRoot, workingDirectory, home],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* writeExecutable(
          path.join(binDir, "git"),
          [
            "#!/bin/sh",
            'printf "%s\\n" "$*" >> "$GIT_LOG"',
            '[ "$1" = "clone" ] || exit 92',
            "for argument do target=$argument; done",
            'mkdir -p "$target/.git"',
            "",
          ].join("\n")
        );
        yield* writeExecutable(
          path.join(binDir, "realpath"),
          '#!/bin/sh\nprintf "called\\n" >> "$REALPATH_LOG"\nexit 91\n'
        );
        const canonicalTempDir = yield* fs.realPath(tempDir);
        const expectedRoot = useDefault
          ? path.join(canonicalTempDir, "home", "YeeBois", "references", "effect")
          : path.join(canonicalTempDir, "working", "effect reference");
        const run = Effect.fn("SetupEffectRefTest.run")(function* () {
          const handle = yield* ChildProcess.make("bash", [setupScriptPath, repoRoot], {
            cwd: workingDirectory,
            env: {
              HOME: home,
              BEEP_REFERENCES_ROOT: useDefault ? "" : "missing-segment/../effect reference",
              GIT_LOG: gitLog,
              REALPATH_LOG: realpathLog,
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
          expect(exitCode, stderr).toBe(0);
          return { stderr, stdout };
        }, Effect.scoped);
        const links = ["effect", "effect-tsgo", "effect-workspace"];
        const assertLinks = Effect.fn("SetupEffectRefTest.assertLinks")(function* () {
          for (const name of links) {
            expect(yield* fs.readLink(path.join(repoRoot, ".repos", name))).toBe(
              name === "effect-workspace" ? expectedRoot : path.join(expectedRoot, name)
            );
          }
        });
        expect((yield* run()).stderr).toBe("");
        yield* assertLinks();
        const clones = yield* fs.readFileString(gitLog);
        expect(clones).toBe(
          [
            `clone --quiet git@github.com:Effect-TS/effect.git ${expectedRoot}/effect`,
            `clone --quiet git@github.com:Effect-TS/tsgo.git ${expectedRoot}/effect-tsgo`,
            "",
          ].join("\n")
        );
        const before = yield* Effect.forEach(links, (name) => fs.stat(path.join(repoRoot, ".repos", name)));
        const second = yield* run();
        expect(second.stderr).toBe("");
        expect(second.stdout).not.toContain("cloning");
        expect(second.stdout).not.toContain("relinking");
        yield* assertLinks();
        expect(yield* fs.readFileString(gitLog)).toBe(clones);
        expect(yield* Effect.forEach(links, (name) => fs.stat(path.join(repoRoot, ".repos", name)))).toEqual(before);

        // A linked worktree has a .git file; even dirty content must survive.
        const gitEntry = path.join(expectedRoot, "effect", ".git");
        yield* fs.remove(gitEntry, { recursive: true });
        yield* fs.writeFileString(gitEntry, "gitdir: elsewhere\n");
        const dirtyFile = path.join(expectedRoot, "effect", "dirty.txt");
        yield* fs.writeFileString(dirtyFile, "preserve me\n");
        for (const name of links) {
          const link = path.join(repoRoot, ".repos", name);
          yield* fs.remove(link);
          yield* fs.symlink(path.join(tempDir, "missing-old-target"), link);
        }
        expect((yield* run()).stderr).toBe("");
        yield* assertLinks();
        expect(yield* fs.readFileString(gitLog)).toBe(clones);
        expect(yield* fs.readFileString(dirtyFile)).toBe("preserve me\n");
        expect(yield* fs.readFileString(gitEntry)).toBe("gitdir: elsewhere\n");

        for (const name of links) {
          const link = path.join(repoRoot, ".repos", name);
          yield* fs.remove(link);
          yield* fs.makeDirectory(link);
          yield* fs.writeFileString(path.join(link, "keep"), name);
        }
        const collisions = yield* run();
        for (const name of links) {
          expect(collisions.stderr).toContain(`.repos/${name} exists and is not a symlink`);
          expect(yield* fs.readFileString(path.join(repoRoot, ".repos", name, "keep"))).toBe(name);
        }
        expect(yield* fs.readFileString(gitLog)).toBe(clones);
        expect(yield* fs.exists(realpathLog)).toBe(false);
      })
    );
  }
  it.effect("repairs blank remote-cache placeholders without replacing configured values", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
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
  );
  it.effect("replaces a stale remote-cache token reference only when explicitly enabled", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
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
              TURBO_TOKEN_REF: "op://new-vault/new-item/cache/password",
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
      expect(configured).toContain("TURBO_TOKEN=op://new-vault/new-item/cache/password");
      expect(configured).toContain("TURBO_API=https://existing.example.test");
      expect(configured).toContain("TURBO_TEAM=existing-team");
    })
  );
  it.effect("replaces a resolved remote-cache token without rendering it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
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
  );
  it.effect("rejects an incomplete replacement reference without modifying the configured token", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
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
        "TURBO_TOKEN_REF must be a 1Password reference (op://vault/item/[section/]field), never a token value"
      );
      expect(yield* fs.readFileString(envPath)).toBe(original);
    })
  );
  it.effect("rejects duplicate remote-cache assignments without modifying the file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
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
  );
});
