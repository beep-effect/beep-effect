import {
  CacheQualificationLive,
  CacheQualificationService,
  CacheRemoteReadsRequest,
} from "@beep/repo-cli/commands/Cache";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcess } from "effect/process";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { expect } from "vitest";

it.layer(NodeServices.layer, { timeout: "30 seconds" })("cache remote-reads", (it) => {
  it.effect(
    "creates a missing env, backs up owned-field edits, preserves quoted values, and is idempotent",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-owned-fields-" });
      yield* fs.writeFileString(path.join(root, "turbo.json"), "{}");
      const input = CacheRemoteReadsRequest.make({
        api: "https://cache.example.test",
        team: "fixture",
        tokenRef: "op://fixture/item/token",
        replaceToken: false,
      });
      const run = CacheQualificationService.use((service) => service.remoteReads(root, input)).pipe(
        Effect.provide(CacheQualificationLive)
      );
      yield* run;
      const first = yield* fs.readFileString(path.join(root, ".env"));
      expect(first).toContain("TURBO_TOKEN=op://fixture/item/token");
      expect(A.some(yield* run, Str.startsWith("backup:"))).toBe(false);
      yield* fs.writeFileString(
        path.join(root, ".env"),
        '# unrelated\nPRIVATE_FIXTURE="keep me"\nexport TURBO_TEAM = ""\nTURBO_API="https://preserved.example.test"\n'
      );
      const original = yield* fs.readFileString(path.join(root, ".env"));
      const changed = yield* run;
      const backup = A.findFirst(changed, Str.startsWith("backup:"));
      expect(O.isSome(backup)).toBe(true);
      if (O.isSome(backup))
        expect(yield* fs.readFileString(path.join(root, Str.slice(8)(backup.value)))).toBe(original);
      const next = yield* fs.readFileString(path.join(root, ".env"));
      expect(next).toContain('PRIVATE_FIXTURE="keep me"');
      expect(next).toContain('TURBO_API="https://preserved.example.test"');
      expect(next).toContain("TURBO_TEAM=fixture");
      yield* run;
      expect(yield* fs.readFileString(path.join(root, ".env"))).toBe(next);
    })
  );

  it.effect(
    "refuses whitespace/export duplicates, symlinked env files, and non-https configuration before mutation",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-refusal-" });
      yield* fs.writeFileString(path.join(root, "turbo.json"), "{}");
      const input = CacheRemoteReadsRequest.make({
        api: "https://cache.example.test",
        team: "fixture",
        tokenRef: "op://fixture/item/token",
        replaceToken: false,
      });
      const run = CacheQualificationService.use((service) => service.remoteReads(root, input)).pipe(
        Effect.provide(CacheQualificationLive)
      );
      const text = 'TURBO_TEAM=one\nexport TURBO_TEAM = "two"\n';
      yield* fs.writeFileString(path.join(root, ".env"), text);
      expect(yield* run.pipe(Effect.isFailure)).toBe(true);
      expect(yield* fs.readFileString(path.join(root, ".env"))).toBe(text);
      yield* fs.remove(path.join(root, ".env"));
      yield* fs.writeFileString(path.join(root, "referent"), "keep");
      yield* fs.symlink(path.join(root, "referent"), path.join(root, ".env"));
      expect(yield* run.pipe(Effect.isFailure)).toBe(true);
      expect(yield* fs.readFileString(path.join(root, "referent"))).toBe("keep");
      expect(
        yield* S.decodeUnknownEffect(CacheRemoteReadsRequest)({ ...input, api: "http://cache.example.test" }).pipe(
          Effect.isFailure
        )
      ).toBe(true);
    })
  );
  it.effect("repairs blank remote-cache placeholders without replacing configured values", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
      const setupScriptPath = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
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
          const handle = yield* ChildProcess.make(
            "bun",
            [setupScriptPath, "cache", "remote-reads", "--checkout", repoRoot],
            {
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
            }
          );
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
      const setupScriptPath = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
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
          const handle = yield* ChildProcess.make(
            "bun",
            [setupScriptPath, "cache", "remote-reads", "--checkout", repoRoot],
            {
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
            }
          );
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
      expect(result.stdout).toContain("replaced TURBO_TOKEN");
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
      const setupScriptPath = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
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
          const handle = yield* ChildProcess.make(
            "bun",
            [setupScriptPath, "cache", "remote-reads", "--checkout", repoRoot],
            {
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
            }
          );
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
      expect(result.stdout).toContain("replaced TURBO_TOKEN");
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
      const setupScriptPath = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
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
          const handle = yield* ChildProcess.make(
            "bun",
            [setupScriptPath, "cache", "remote-reads", "--checkout", repoRoot],
            {
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
            }
          );
          const [exitCode, stderr] = yield* Effect.all(
            [handle.exitCode, handle.stderr.pipe(Stream.decodeText(), Stream.mkString)],
            { concurrency: "unbounded" }
          );
          return { exitCode, stderr };
        })
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("op://vault/item/[section/]field");
      expect(yield* fs.readFileString(envPath)).toBe(original);
    })
  );
  it.effect("rejects duplicate remote-cache assignments without modifying the file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
      const path = yield* Path.Path;
      const ambientPath = yield* Config.String("PATH");
      const setupScriptPath = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
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
          const handle = yield* ChildProcess.make(
            "bun",
            [setupScriptPath, "cache", "remote-reads", "--checkout", repoRoot],
            {
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
            }
          );
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
