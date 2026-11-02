import {
  assertCacheRuntimeKeyUnspecified,
  CacheCensusNode,
  CacheCommandError,
  CacheExecutablePin,
  CacheSigningKeyState,
  CacheSigningRequest,
  CacheSigningRole,
  CacheToolchainSnapshot,
  cacheRuntimeStep,
  cacheTaskSelectionArgs,
  hashCacheToolchain,
  resolveCacheSigningPosture,
  runCacheRuntimeTasks,
} from "@beep/repo-cli/commands/Cache";
import * as Census from "@beep/repo-cli/commands/Cache/Cache.census";
import * as Fingerprint from "@beep/repo-cli/commands/Cache/Cache.fingerprint";
import {
  collectCacheGitExclusions,
  CacheRuntimeFileGuards as FsGuards,
  CacheRuntimeProfile as Profile,
  CacheRuntimeProcess as StepExec,
} from "@beep/repo-cli/test/Cache";
import { QualityTaskStep } from "@beep/repo-cli/test/Quality";
import { CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex } from "@beep/schema";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("artifact signing posture", () => {
  it.effect("allows unsigned legacy configuration and requires keys independently of bearer roles", () =>
    Effect.gen(function* () {
      for (const role of CacheSigningRole.pick(["reader", "writer"]).literals) {
        for (const key of CacheSigningKeyState.literals) {
          expect(yield* resolveCacheSigningPosture(CacheSigningRequest.make({ required: false, role, key }))).toEqual({
            _tag: "Disabled",
          });
        }
        expect(
          yield* resolveCacheSigningPosture(CacheSigningRequest.make({ required: true, role, key: "resolved" }))
        ).toEqual({ _tag: "Ready" });
      }
      for (const key of CacheSigningKeyState.literals) {
        const failure = yield* resolveCacheSigningPosture(
          CacheSigningRequest.make({ required: false, role: "canary", key })
        ).pipe(Effect.flip);
        expect(failure.message).toBe("Signing canary requires native artifact verification to be enabled.");
      }
      expect(
        yield* resolveCacheSigningPosture(CacheSigningRequest.make({ required: true, role: "canary", key: "resolved" }))
      ).toEqual({ _tag: "Ready" });
      for (const key of CacheSigningKeyState.pick(["missing", "unresolved"]).literals) {
        expect(
          yield* resolveCacheSigningPosture(CacheSigningRequest.make({ required: true, role: "reader", key }))
        ).toEqual({ _tag: "LocalOnly", reason: key });
        for (const role of CacheSigningRole.pick(["writer", "canary"]).literals) {
          const failure = yield* resolveCacheSigningPosture(
            CacheSigningRequest.make({ required: true, role, key })
          ).pipe(Effect.flip);
          assertInstanceOf(failure, CacheCommandError);
          expect(failure.message).toContain(`Signed cache ${role} requires a resolved artifact signing key (${key})`);
          expect(failure.cause).toBeUndefined();
        }
      }
    })
  );
});

describe("cache runtime identity input", () => {
  it.effect("rejects supplied values in either environment before planned Turbo execution", () =>
    Effect.gen(function* () {
      for (const value of [
        "",
        "unverified-caller-value",
        "0000000000000000000000000000000000000000000000000000000000000000",
      ]) {
        for (const command of [
          { command: "bunx", args: ["turbo", "run", "lint"] },
          { command: "op", args: ["run", "--", "bunx", "turbo", "run", "lint"] },
        ]) {
          for (const environments of [
            { ambient: { BEEP_CACHE_TOOLCHAIN_DIGEST: value }, step: {} },
            { ambient: {}, step: { BEEP_CACHE_TOOLCHAIN_DIGEST: value } },
            { ambient: { BEEP_CACHE_TOOLCHAIN_DIGEST: value }, step: { BEEP_CACHE_TOOLCHAIN_DIGEST: undefined } },
          ]) {
            const result = yield* assertCacheRuntimeKeyUnspecified(
              command.command,
              command.args,
              environments.ambient,
              environments.step
            ).pipe(Effect.result);
            const failure = result.pipe(Result.getFailure, O.getOrThrow);
            expect(failure._tag).toBe("CacheCommandError");
            expect(failure.message).toBe(
              "BEEP_CACHE_TOOLCHAIN_DIGEST must be computed by the cache runtime; caller overrides are not accepted."
            );
          }
        }
      }
    })
  );

  it.effect("accepts absent values and leaves unrelated commands alone", () =>
    Effect.gen(function* () {
      yield* assertCacheRuntimeKeyUnspecified("bunx", ["turbo", "run", "lint"], {}, {});
      yield* assertCacheRuntimeKeyUnspecified(
        "op",
        ["run", "--", "bunx", "turbo", "run", "lint"],
        { BEEP_CACHE_TOOLCHAIN_DIGEST: undefined },
        {}
      );
      yield* assertCacheRuntimeKeyUnspecified(
        "bunx",
        ["vitest", "run"],
        { BEEP_CACHE_TOOLCHAIN_DIGEST: "unrelated" },
        {}
      );
    })
  );
});

describe("native task selection arguments", () => {
  it.effect("replaces cache controls without changing forwarded arguments", () =>
    Effect.gen(function* () {
      expect(
        yield* cacheTaskSelectionArgs([
          "run",
          "lint",
          "--filter=@qualification/b",
          "--cache",
          "remote:rw",
          "--force",
          "false",
          "--",
          "--cache=remote:rw",
          "--graph",
          "--filter=@qualification/c",
        ])
      ).toEqual([
        "run",
        "lint",
        "--filter=@qualification/b",
        "--dry=json",
        "--cache=local:",
        "--",
        "--cache=remote:rw",
        "--graph",
        "--filter=@qualification/c",
      ]);
      expect(yield* cacheTaskSelectionArgs(["run", "lint", "--cache=remote:r", "--remote-only=true"])).toEqual([
        "run",
        "lint",
        "--dry=json",
        "--cache=local:",
      ]);
    })
  );
  it.effect("rejects ambiguous non-execution modes and missing cache values", () =>
    Effect.gen(function* () {
      for (const args of [
        ["watch", "lint"],
        ["run", "lint", "--graph"],
        ["run", "lint", "--dry=json"],
        ["run", "lint", "--cwd=elsewhere"],
        ["run", "lint", "--cache"],
        ["run", "lint", "--cache", "--filter=@qualification/c"],
      ]) {
        yield* cacheTaskSelectionArgs(args).pipe(Effect.flip);
      }
    })
  );
});

const runtimeDigest = Sha256Hex.make("1111111111111111111111111111111111111111111111111111111111111111");
const runtimeTool = CacheExecutablePin.make({ version: "fixture", sha256: runtimeDigest });
const runtimeSnapshot = CacheToolchainSnapshot.make({
  profile: "local-linux-x64-bun1.4.1",
  kernel: "fixture",
  libc: "fixture",
  bun: runtimeTool,
  node: runtimeTool,
  turbo: runtimeTool,
  biome: runtimeTool,
  sources: [],
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "Git exclusion runtime identity",
  (it) => {
    it.effect("binds content across clone and linked-worktree paths and rejects unsafe files", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-git-exclusions-" });
        const clone = path.join(root, "clone");
        const worktree = path.join(root, "linked");
        yield* fs.makeDirectory(clone);
        const git = Effect.fn("test.gitExclusions.git")(function* (args: ReadonlyArray<string>) {
          const result = yield* StepExec.runCaptured({
            command: "git",
            args,
            cwd: clone,
            extendEnv: false,
            env: { PATH: "/usr/bin", HOME: root, GIT_CONFIG_NOSYSTEM: "1" },
            source: "all",
            timeout: Duration.seconds(10),
            bound: StepExec.OutputBound.make({ maxChars: 4096, truncatedNotice: "[git fixture overflow]" }),
          });
          expect(result.exitCode).toBe(0);
          expect(result.truncated).toBe(false);
        });
        yield* git(["init", "--template=", "."]);
        yield* git([
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.invalid",
          "commit",
          "--allow-empty",
          "-m",
          "fixture",
        ]);
        yield* git(["worktree", "add", "--detach", worktree]);
        const absent = yield* collectCacheGitExclusions(clone);
        yield* fs.makeDirectory(path.join(clone, ".git/info"), { recursive: true });
        const exclude = path.join(clone, ".git/info/exclude");
        yield* fs.writeFileString(exclude, "");
        expect(yield* collectCacheGitExclusions(worktree)).toEqual(absent);
        yield* fs.writeFileString(exclude, "/src/index.ts\n");
        const changed = yield* collectCacheGitExclusions(worktree);
        expect(changed).toEqual(yield* collectCacheGitExclusions(clone));
        expect(changed.path).toBe(".git/info/exclude");
        expect(changed.sha256).not.toBe(absent.sha256);
        expect(
          yield* hashCacheToolchain(CacheToolchainSnapshot.make({ ...runtimeSnapshot, sources: [changed] }))
        ).not.toBe(yield* hashCacheToolchain(CacheToolchainSnapshot.make({ ...runtimeSnapshot, sources: [absent] })));
        yield* fs.remove(exclude);
        yield* fs.makeDirectory(exclude);
        yield* collectCacheGitExclusions(clone).pipe(Effect.flip);
        yield* fs.remove(exclude, { recursive: true });
        yield* fs.writeFileString(path.join(root, "outside"), "/src/index.ts\n");
        yield* fs.symlink(path.join(root, "outside"), exclude);
        yield* collectCacheGitExclusions(clone).pipe(Effect.flip);
        yield* fs.remove(exclude);
        yield* fs.writeFile(exclude, new Uint8Array(1048577));
        yield* collectCacheGitExclusions(clone).pipe(Effect.flip);
      })
    );
  }
);
const runtimeNode = CacheCensusNode.make({
  id: "@fixture/dependency#lint",
  workspace: "@fixture/dependency",
  task: "lint",
  command: O.some("fixture-lint"),
  commandDigest: runtimeDigest,
  dependencies: [],
  configuration: CacheTaskConfiguration.make({
    cache: true,
    inputs: [],
    outputs: [],
    env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"],
    passThroughEnv: [],
    dependsOn: [],
    persistent: false,
    interactive: false,
    interruptible: false,
    outputLogs: "full",
  }),
  inputCount: S.Natural.make(0),
  inputsDigest: runtimeDigest,
});
const runtimeLayer = FsUtilsLive.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      FileSystem.layerNoop({}),
      Path.layer,
      NodeCrypto.layer,
      Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
        ChildProcessSpawner.make(() => Effect.die("Unexpected native spawn outside the mocked runtime boundary"))
      )
    )
  )
);

it.layer(runtimeLayer, { timeout: "10 seconds" })("runtime native spawn", (it) => {
  beforeEach(() => {
    vi.spyOn(Fingerprint, "readCacheSignatureRequired").mockReturnValue(Effect.succeed(false));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.effect("forces a reader without its required key to run locally without forwarding a reference", () =>
    Effect.gen(function* () {
      vi.spyOn(Fingerprint, "readCacheSignatureRequired").mockReturnValue(Effect.succeed(true));
      const select = vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      vi.stubEnv("TURBO_CACHE", "local:rw,remote:r");
      vi.stubEnv("TURBO_REMOTE_ONLY", "true");
      vi.stubEnv("TURBO_REMOTE_CACHE_READ_ONLY", "true");
      vi.stubEnv("BEEP_TURBO_TRUSTED_WRITER", "false");
      vi.stubEnv("BEEP_TURBO_SIGNING_CANARY", "false");
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
      for (const key of [undefined, "", "op://fixture/cache/signing"]) {
        vi.stubEnv("TURBO_REMOTE_CACHE_SIGNATURE_KEY", key);
        yield* runCacheRuntimeTasks("/fixture", ["run", "lint", "--cache", "remote:r", "--", "--cache=remote:rw"]);
        expect(select).toHaveBeenLastCalledWith("/fixture", [
          "run",
          "lint",
          "--cache=local:rw",
          "--",
          "--cache=remote:rw",
        ]);
        expect(spawn).toHaveBeenLastCalledWith(
          expect.objectContaining({
            args: ["run", "lint", "--cache=local:rw", "--", "--cache=remote:rw"],
            env: {
              TURBO_CACHE: "local:rw",
              TURBO_REMOTE_ONLY: undefined,
              TURBO_REMOTE_CACHE_READ_ONLY: undefined,
              TURBO_REMOTE_CACHE_SIGNATURE_KEY: undefined,
            },
          })
        );
      }
    })
  );

  it.effect("uses a selection cache directive before an ambient upload mode", () =>
    Effect.gen(function* () {
      vi.spyOn(Fingerprint, "readCacheSignatureRequired").mockReturnValue(Effect.succeed(true));
      const select = vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      vi.stubEnv("TURBO_CACHE", "local:rw,remote:rw");
      vi.stubEnv("TURBO_REMOTE_CACHE_SIGNATURE_KEY", undefined);
      vi.stubEnv("BEEP_TURBO_TRUSTED_WRITER", "false");
      vi.stubEnv("BEEP_TURBO_SIGNING_CANARY", "false");
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
      for (const mode of [["--cache=local:rw"], ["--cache", "local:rw"], ["--cache=remote:r"]]) {
        yield* runCacheRuntimeTasks("/fixture", ["run", "lint", ...mode, "--", "--cache=remote:rw"]);
        expect(select).toHaveBeenLastCalledWith("/fixture", [
          "run",
          "lint",
          "--cache=local:rw",
          "--",
          "--cache=remote:rw",
        ]);
        expect(spawn).toHaveBeenLastCalledWith(
          expect.objectContaining({ args: ["run", "lint", "--cache=local:rw", "--", "--cache=remote:rw"] })
        );
      }
    })
  );

  it.effect("preserves native execution when an upload-capable caller has its resolved key", () =>
    Effect.gen(function* () {
      vi.spyOn(Fingerprint, "readCacheSignatureRequired").mockReturnValue(Effect.succeed(true));
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      vi.stubEnv("TURBO_CACHE", "local:rw,remote:rw");
      vi.stubEnv("TURBO_REMOTE_CACHE_SIGNATURE_KEY", "synthetic-private-signing-value-for-native-control");
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
      const args = ["run", "lint", "--cache=remote:rw"];
      yield* runCacheRuntimeTasks("/fixture", args);
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ args, env: {}, extendEnv: true }));
    })
  );

  it.effect("refuses an unsigned signing canary even when a key is available", () =>
    Effect.gen(function* () {
      vi.stubEnv("BEEP_TURBO_SIGNING_CANARY", "true");
      vi.stubEnv("TURBO_REMOTE_CACHE_SIGNATURE_KEY", "synthetic-private-signing-value-for-native-control");
      const select = vi.spyOn(Census, "collectCacheTaskSelection");
      const spawn = vi.spyOn(StepExec, "runToExit");
      const failure = yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
      expect(failure.message).toContain("Signing canary requires native artifact verification");
      expect(select).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses missing writer and canary keys before native execution", () =>
    Effect.gen(function* () {
      vi.spyOn(Fingerprint, "readCacheSignatureRequired").mockReturnValue(Effect.succeed(true));
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([]));
      const spawn = vi.spyOn(StepExec, "runToExit");
      vi.stubEnv("TURBO_REMOTE_CACHE_SIGNATURE_KEY", undefined);
      vi.stubEnv("TURBO_CACHE", "local:rw,remote:rw");
      for (const canary of ["false", "true"]) {
        vi.stubEnv("BEEP_TURBO_SIGNING_CANARY", canary);
        const failure = yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
        expect(failure.message).toContain("requires a resolved artifact signing key");
        expect(failure.cause).toBeUndefined();
      }
      expect(spawn).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects root-config overrides before selection but leaves forwarded values alone", () =>
    Effect.gen(function* () {
      const select = vi.spyOn(Census, "collectCacheTaskSelection");
      for (const arg of ["--root-turbo-json", "--root-turbo-json=other.json", "--cwd", "--cwd=elsewhere"]) {
        const failure = yield* runCacheRuntimeTasks("/fixture", ["run", "lint", arg]).pipe(Effect.flip);
        expect(failure.message).toContain("overrides are not accepted");
      }
      vi.stubEnv("TURBO_ROOT_TURBO_JSON", "synthetic-private-root-path");
      const environmentOverride = yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
      expect(environmentOverride.message).toContain("overrides are not accepted");
      expect(environmentOverride.message).not.toContain("synthetic-private-root-path");
      vi.stubEnv("TURBO_ROOT_TURBO_JSON", undefined);
      expect(select).not.toHaveBeenCalled();
      select.mockReturnValue(Effect.succeed([]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
      const args = ["run", "lint", "--", "--root-turbo-json=task-input"];
      yield* runCacheRuntimeTasks("/fixture", args);
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ args }));
    })
  );

  it.effect("injects the fixed profile for disabled caching and retains it alongside an observed cache key", () =>
    Effect.gen(function* () {
      for (const cache of [false, true]) {
        const node = CacheCensusNode.make({
          ...runtimeNode,
          id: "@beep/identity#lint",
          workspace: "@beep/identity",
          configuration: CacheTaskConfiguration.make({
            ...runtimeNode.configuration,
            cache,
            env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"],
            passThroughEnv: ["BIOME_CONFIG_PATH"],
          }),
        });
        vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([node]));
        vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
        const profile = vi.spyOn(Profile, "verifyCacheIdentityLintProfile").mockReturnValue(Effect.void);
        vi.spyOn(Fingerprint, "collectCacheToolchain").mockReturnValue(Effect.succeed(runtimeSnapshot));
        vi.spyOn(FsGuards, "hashFileSha256").mockImplementation(
          dual(2, (_filePath: string, _onError: (cause: unknown, filePath: string) => unknown) =>
            Effect.succeed(runtimeDigest)
          )
        );
        const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
        expect(yield* runCacheRuntimeTasks("/fixture", ["run", "lint"])).toBe(0);
        expect(profile).toHaveBeenCalledWith("/fixture");
        expect(spawn).toHaveBeenLastCalledWith(
          expect.objectContaining({
            env: cache
              ? {
                  BIOME_CONFIG_PATH: "/fixture/biome.identity.jsonc",
                  BEEP_CACHE_TOOLCHAIN_DIGEST: yield* hashCacheToolchain(runtimeSnapshot),
                }
              : { BIOME_CONFIG_PATH: "/fixture/biome.identity.jsonc" },
          })
        );
      }
    })
  );

  it.effect("rejects caller profile overrides including empty values", () =>
    Effect.gen(function* () {
      const node = CacheCensusNode.make({
        ...runtimeNode,
        id: "@beep/identity#lint",
        workspace: "@beep/identity",
        configuration: CacheTaskConfiguration.make({
          ...runtimeNode.configuration,
          cache: false,
          passThroughEnv: ["BIOME_CONFIG_PATH"],
        }),
      });
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([node]));
      const profile = vi.spyOn(Profile, "verifyCacheIdentityLintProfile");
      const spawn = vi.spyOn(StepExec, "runToExit");
      for (const value of ["", "other.json", "/fixture/biome.identity.jsonc"]) {
        vi.stubEnv("BIOME_CONFIG_PATH", value);
        const failure = yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
        expect(failure.message).toContain("caller overrides");
      }
      expect(profile).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects stale governed profiles before native execution even with caching disabled", () =>
    Effect.gen(function* () {
      const node = CacheCensusNode.make({
        ...runtimeNode,
        id: "@beep/identity#lint",
        workspace: "@beep/identity",
        configuration: CacheTaskConfiguration.make({
          ...runtimeNode.configuration,
          cache: false,
          passThroughEnv: ["BIOME_CONFIG_PATH"],
        }),
      });
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([node]));
      const profile = vi
        .spyOn(Profile, "verifyCacheIdentityLintProfile")
        .mockReturnValue(
          CacheCommandError.new("Identity lint profile is stale; regenerate it with cache profile --write.")
        );
      const resolve = vi.spyOn(Census, "resolveCacheTurboBinary");
      const observe = vi.spyOn(Fingerprint, "collectCacheToolchain");
      const spawn = vi.spyOn(StepExec, "runToExit");
      yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
      expect(profile).toHaveBeenCalledWith("/fixture");
      expect(resolve).not.toHaveBeenCalled();
      expect(observe).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    })
  );

  it.effect("injects the observed canonical key into the final native spawn", () =>
    Effect.gen(function* () {
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([runtimeNode]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      const observe = vi.spyOn(Fingerprint, "collectCacheToolchain").mockReturnValue(Effect.succeed(runtimeSnapshot));
      vi.spyOn(FsGuards, "hashFileSha256").mockImplementation(
        dual(2, (_filePath: string, _onError: (cause: unknown, filePath: string) => unknown) =>
          Effect.succeed(runtimeDigest)
        )
      );
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(7));
      const expected = yield* hashCacheToolchain(runtimeSnapshot);
      const args = ["run", "lint", "--filter=@fixture/entry"];
      expect(yield* runCacheRuntimeTasks("/fixture", args)).toBe(7);
      expect(observe).toHaveBeenCalledOnce();
      expect(spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "/fixture/turbo",
          args,
          env: { BEEP_CACHE_TOOLCHAIN_DIGEST: expected },
          extendEnv: true,
        })
      );
    })
  );

  it.effect("rejects client drift before spawning an enabled cache task", () =>
    Effect.gen(function* () {
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([runtimeNode]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      vi.spyOn(Fingerprint, "collectCacheToolchain").mockReturnValue(Effect.succeed(runtimeSnapshot));
      vi.spyOn(FsGuards, "hashFileSha256").mockImplementation(
        dual(2, (_filePath: string, _onError: (cause: unknown, filePath: string) => unknown) =>
          Effect.succeed(Sha256Hex.make("2222222222222222222222222222222222222222222222222222222222222222"))
        )
      );
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
      yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
      expect(spawn).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects a Turbo client override before reading the task selection", () =>
    Effect.gen(function* () {
      const select = vi.spyOn(Census, "collectCacheTaskSelection");
      const spawn = vi.spyOn(StepExec, "runToExit");
      vi.stubEnv("TURBO_BINARY_PATH", "/fixture/other-turbo");
      const failure = yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
      assertInstanceOf(failure, CacheCommandError);
      expect(failure.message).toBe("Runtime execution requires the installed native Turbo client, without overrides.");
      expect(select).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    })
  );

  it.effect("treats an empty Turbo client override as absent", () =>
    Effect.gen(function* () {
      vi.stubEnv("TURBO_BINARY_PATH", "");
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([runtimeNode]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      vi.spyOn(Fingerprint, "collectCacheToolchain").mockReturnValue(Effect.succeed(runtimeSnapshot));
      vi.spyOn(FsGuards, "hashFileSha256").mockImplementation(
        dual(2, (_filePath: string, _onError: (cause: unknown, filePath: string) => unknown) =>
          Effect.succeed(runtimeDigest)
        )
      );
      const spawn = vi.spyOn(StepExec, "runToExit").mockReturnValue(Effect.succeed(0));
      expect(yield* runCacheRuntimeTasks("/fixture", ["run", "lint"])).toBe(0);
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ command: "/fixture/turbo", cwd: "/fixture" }));
    })
  );

  it.effect("reports an unreadable execution client instead of spawning", () =>
    Effect.gen(function* () {
      vi.spyOn(Census, "collectCacheTaskSelection").mockReturnValue(Effect.succeed([runtimeNode]));
      vi.spyOn(Census, "resolveCacheTurboBinary").mockReturnValue(Effect.succeed("/fixture/turbo"));
      vi.spyOn(Fingerprint, "collectCacheToolchain").mockReturnValue(Effect.succeed(runtimeSnapshot));
      const unreadable = new Error("EACCES: permission denied, open '/fixture/turbo'");
      const hash = vi
        .spyOn(FsGuards, "hashFileSha256")
        .mockImplementation(
          dual(2, <E>(filePath: string, onError: (cause: unknown, filePath: string) => E) =>
            Effect.fail(onError(unreadable, filePath))
          )
        );
      const spawn = vi.spyOn(StepExec, "runToExit");
      const failure = yield* runCacheRuntimeTasks("/fixture", ["run", "lint"]).pipe(Effect.flip);
      assertInstanceOf(failure, CacheCommandError);
      expect(failure.message).toBe("Cannot verify the execution client.");
      expect(failure.cause).toBe(unreadable);
      expect(hash).toHaveBeenCalledWith("/fixture/turbo", expect.any(Function));
      expect(spawn).not.toHaveBeenCalled();
    })
  );
});

describe("runtime step routing", () => {
  it.each([
    { command: "/repo/node_modules/.bin/turbo", args: ["run", "lint"], expected: "bun", prefix: [] },
    {
      command: "op",
      args: ["run", "--", "/repo/node_modules/.bin/turbo", "run", "lint"],
      expected: "op",
      prefix: ["run", "--", "bun"],
    },
  ])("routes native Turbo through $command without dropping its run verb", ({ command, args, expected, prefix }) => {
    const routed = cacheRuntimeStep(QualityTaskStep.make({ label: "native fixture", command, args, cwd: "/repo" }));
    expect(routed.command).toBe(expected);
    expect(routed.args).toEqual([
      ...prefix,
      "--no-env-file",
      expect.stringMatching(/bin\.(?:ts|js)$/u),
      "cache",
      "execute",
      "--",
      "run",
      "lint",
    ]);
  });

  it("preserves forwarded arguments and step metadata", () => {
    const step = QualityTaskStep.make({
      label: "fixture",
      command: "bunx",
      cwd: "/repo",
      args: ["turbo", "run", "lint", "--", "--dry=false"],
      env: { SAFE_FIXTURE: "value" },
    });
    const routed = cacheRuntimeStep(step);
    expect(routed.command).toBe("bun");
    expect(routed.args).toEqual([
      "--no-env-file",
      expect.stringMatching(/bin\.(?:ts|js)$/u),
      "cache",
      "execute",
      "--",
      "run",
      "lint",
      "--",
      "--dry=false",
    ]);
    expect(routed.cwd).toBe(step.cwd);
    expect(routed.env).toEqual(step.env);
    expect(routed.label).toBe(step.label);
  });
  it("keeps the secret-session prefix around the Cache child", () => {
    const step = QualityTaskStep.make({
      label: "fixture",
      command: "op",
      cwd: "/repo",
      args: ["run", "--env-file=.fixture", "--", "bunx", "turbo", "run", "lint"],
    });
    const routed = cacheRuntimeStep(step);
    expect(routed.command).toBe("op");
    expect(routed.args).toEqual([
      "run",
      "--env-file=.fixture",
      "--",
      "bun",
      "--no-env-file",
      expect.stringMatching(/bin\.(?:ts|js)$/u),
      "cache",
      "execute",
      "--",
      "run",
      "lint",
    ]);
  });
  it("leaves inspection and non-Turbo commands unchanged", () => {
    for (const args of [
      ["turbo", "run", "lint", "--dry=json"],
      ["turbo", "run", "lint", "--graph"],
      ["turbo", "query", "ls"],
      ["vitest", "run"],
    ]) {
      const step = QualityTaskStep.make({ label: "fixture", command: "bunx", cwd: "/repo", args });
      expect(cacheRuntimeStep(step)).toBe(step);
    }
  });
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })("native signing configuration", (it) => {
  it.effect("canonicalizes an explicitly selected client without requiring an installed Turbo package", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const native = path.join(root, "verified-client");
      const alias = path.join(root, "client-alias");
      yield* fs.writeFileString(native, "caller-verified fixture");
      yield* fs.symlink(native, alias);
      expect(yield* Census.resolveCacheTurboBinary(root, O.some(alias))).toBe(yield* fs.realPath(native));
      const missing = yield* Census.resolveCacheTurboBinary(root).pipe(Effect.flip);
      expect(missing.message).toContain("Native Turbo is not installed");
    })
  );
  it.effect("rejects missing, malformed UTF-8, oversized and symlinked root policies without raw causes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const file = path.join(root, "turbo.json");
      const missing = yield* Fingerprint.readCacheSignatureRequired(root).pipe(Effect.flip);
      expect(missing.cause).toBeUndefined();
      yield* fs.writeFile(file, new Uint8Array([255]));
      const malformed = yield* Fingerprint.readCacheSignatureRequired(root).pipe(Effect.flip);
      expect(malformed.cause).toBeUndefined();
      yield* fs.writeFileString(file, Str.repeat(1024 * 1024 + 1)(" "));
      const oversized = yield* Fingerprint.readCacheSignatureRequired(root).pipe(Effect.flip);
      expect(oversized.cause).toBeUndefined();
      yield* fs.remove(file);
      const target = path.join(root, "owned-policy.json");
      yield* fs.writeFileString(target, '{"remoteCache":{"signature":true}}');
      yield* fs.symlink(target, file);
      const aliased = yield* Fingerprint.readCacheSignatureRequired(root).pipe(Effect.flip);
      expect(aliased.cause).toBeUndefined();
    })
  );

  it.effect("resolves root/global enablement and JSONC without reading any artifact key", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const file = path.join(root, "turbo.jsonc");
      for (const row of [
        { source: '{"tasks":{}}', expected: false },
        { source: '{"remoteCache":{"signature":true}}', expected: true },
        { source: '{"remoteCache":{"enabled":false,"signature":true}}', expected: false },
        {
          source: '{"futureFlags":{"globalConfiguration":true},"remoteCache":{"signature":true},"global":{}}',
          expected: false,
        },
        {
          source: '{"futureFlags":{"globalConfiguration":true},"global":{"remoteCache":{"signature":true}}}',
          expected: true,
        },
        {
          source: '{"futureFlags":{"globalConfiguration":false},"global":{"remoteCache":{"signature":true}}}',
          expected: false,
        },
        { source: '{/* fixture */"remoteCache":{"signature":true}}', expected: true },
      ]) {
        yield* fs.writeFileString(file, row.source);
        expect(yield* Fingerprint.readCacheSignatureRequired(root)).toBe(row.expected);
      }
      yield* fs.writeFileString(file, '{"remoteCache":{"signature":"synthetic-private-configuration"}}');
      const invalid = yield* Fingerprint.readCacheSignatureRequired(root).pipe(Effect.flip);
      expect(invalid.message).not.toContain("synthetic-private-configuration");
      expect(invalid.cause).toBeUndefined();
      yield* fs.writeFileString(path.join(root, "turbo.json"), "{}");
      const ambiguous = yield* Fingerprint.readCacheSignatureRequired(root).pipe(Effect.flip);
      expect(ambiguous.cause).toBeUndefined();
    })
  );
});
