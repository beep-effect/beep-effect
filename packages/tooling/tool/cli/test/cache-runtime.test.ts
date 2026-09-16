import {
  assertCacheRuntimeKeyUnspecified,
  CacheCensusNode,
  CacheExecutablePin,
  CacheToolchainSnapshot,
  cacheRuntimeStep,
  cacheTaskSelectionArgs,
  hashCacheToolchain,
  runCacheRuntimeTasks,
} from "@beep/repo-cli/commands/Cache";
import * as Census from "@beep/repo-cli/commands/Cache/Cache.census";
import * as Fingerprint from "@beep/repo-cli/commands/Cache/Cache.fingerprint";
import { CacheRuntimeFileGuards as FsGuards, CacheRuntimeProcess as StepExec } from "@beep/repo-cli/test/Cache";
import { QualityTaskStep } from "@beep/repo-cli/test/Quality";
import { CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { NodeCrypto } from "@effect/platform-node";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
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
  afterEach(() => vi.restoreAllMocks());

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
