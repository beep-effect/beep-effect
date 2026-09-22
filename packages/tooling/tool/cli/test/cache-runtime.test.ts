import {
  assertCacheRuntimeKeyUnspecified,
  CacheCensusNode,
  CacheCommandError,
  CacheExecutablePin,
  CacheToolchainSnapshot,
  cacheRuntimeStep,
  cacheTaskSelectionArgs,
  hashCacheToolchain,
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
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Duration, Effect, FileSystem, Layer, Path } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { ChildProcessSpawner } from "effect/unstable/process";

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
            const failure = O.getOrThrow(Result.getFailure(result));
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
  inputCount: NonNegativeInt.make(0),
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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

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
});

describe("runtime step routing", () => {
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
