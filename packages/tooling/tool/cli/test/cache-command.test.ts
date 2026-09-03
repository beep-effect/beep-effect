import { buildCacheDashboard, CacheCommandError, CacheWarmLane } from "@beep/repo-cli/commands/Cache";
import { runCacheWarmForTesting, runCacheWarmLaneForTesting } from "@beep/repo-cli/test/Cache";
import { NonNegativeInt } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { describe, expect, it } from "vitest";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const provideNodeServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const initializeWarmRepository = Effect.fn("CacheCommandTest.initializeWarmRepository")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bunVersion = Bun.spawnSync(["bun", "--version"], { cwd: repoRoot, stderr: "pipe", stdout: "pipe" });
  expect(bunVersion.exitCode, bunVersion.stderr.toString()).toBe(0);
  yield* fs.writeFileString(path.join(repoRoot, ".bun-version"), `${Str.trim(bunVersion.stdout.toString())}\n`);
  yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# cache warm fixture\n");

  const git = (...args: ReadonlyArray<string>) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: repoRoot, stderr: "pipe", stdout: "pipe" });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  };
  git("init");
  git("config", "user.email", "cache-warm@example.test");
  git("config", "user.name", "Cache Warm Test");
  git("add", ".");
  git("commit", "-m", "baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
});

const withEnvVar = <A, E, R>(
  name: string,
  value: string | undefined,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Bun.env[name];
      if (value === undefined) delete Bun.env[name];
      else Bun.env[name] = value;
      return previous;
    }),
    () => use,
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) delete Bun.env[name];
        else Bun.env[name] = previous;
      })
  );

const withWarmEnvironment = <A, E, R>(
  values: Readonly<{
    readonly TURBO_API: string | undefined;
    readonly TURBO_TOKEN: string | undefined;
    readonly TURBO_TEAM: string | undefined;
  }>,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  withEnvVar(
    "TURBO_API",
    values.TURBO_API,
    withEnvVar("TURBO_TOKEN", values.TURBO_TOKEN, withEnvVar("TURBO_TEAM", values.TURBO_TEAM, use))
  );

const validWarmEnvironment = {
  TURBO_API: "https://cache.example.test",
  TURBO_TOKEN: "fixture-write-token",
  TURBO_TEAM: "fixture-team",
} as const;

describe("cache command", () => {
  it("reports a non-zero inherited cache-warm lane exit", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* runCacheWarmLaneForTesting(process.cwd())(["bun", "-e", "process.exit(7)"]).pipe(
          Effect.flip
        );
        const lane = yield* runCacheWarmLaneForTesting(["bun", "-e", "process.exit(0)"], process.cwd());

        expect(error.message).toContain("exited 7");
        expect(lane.exitCode).toBe(0);
      })
    ));

  it(
    "counts only the first remote-eligible touch and keeps correctness tripwires",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectory({ prefix: "beep-cache-dashboard-" });
            const runs = path.join(root, "runs");
            yield* fs.makeDirectory(runs);

            const remoteEnvironment = {
              environmentVariables: {
                passthrough: ["TURBO_TOKEN=redacted-hash", "TURBO_TEAM=redacted-hash"],
              },
            };
            const task = (taskId: string, hash: string, source: string, directory: string) => ({
              taskId,
              hash,
              directory,
              cache: { status: source === "MISS" ? "MISS" : "HIT", source },
              execution: { startTime: 0, endTime: 0 },
            });
            const run = (
              command: string,
              startTime: number,
              endTime: number,
              tasks: ReadonlyArray<ReturnType<typeof task>>
            ) => ({
              execution: { command, startTime, endTime },
              scm: { sha: "abc123" },
              globalCacheInputs: remoteEnvironment,
              tasks,
            });

            yield* fs.writeFileString(
              path.join(runs, "01.json"),
              encodeJson(
                run("turbo run lint", 100, 200, [
                  task("@beep/foo#lint", "hash-a", "REMOTE", "packages/foo"),
                  task("@beep/bar#lint", "hash-b", "MISS", "packages/bar"),
                ])
              )
            );
            yield* fs.writeFileString(
              path.join(runs, "02.json"),
              encodeJson(
                run("turbo run lint", 300, 500, [
                  task("@beep/foo#lint", "hash-a", "LOCAL", "packages/foo"),
                  task("@beep/bar#lint", "hash-b", "LOCAL", "packages/bar"),
                ])
              )
            );
            yield* fs.writeFileString(
              path.join(runs, "03.json"),
              encodeJson(
                run("turbo run lint --force", 600, 650, [task("@beep/baz#lint", "hash-c", "MISS", "packages/baz")])
              )
            );
            const logs = path.join(root, "lambda.ndjson");
            yield* fs.writeFileString(logs, '{"method":"GET","result":"HIT"}\n{"method":"PUT"}\n');

            const report = yield* buildCacheDashboard(runs, O.some(logs), ["packages/foo/src/index.ts"]);

            expect(report.runFiles).toBe(3);
            expect(report.eligibleFirstTouches).toBe(2);
            expect(report.remoteHits).toBe(1);
            expect(report.eligibleRemoteHitRate).toBe(0.5);
            expect(report.excludedForcedOrDisabled).toBe(1);
            expect(report.correctnessViolations).toEqual(["@beep/foo#lint"]);
            expect(report.lambda).toEqual({ rows: 2, reads: 1, hits: 1, puts: 1 });
            expect(report.wallTimes.map(({ mode, p50Ms, p95Ms, runs }) => ({ mode, p50Ms, p95Ms, runs }))).toEqual([
              { mode: "remote-eligible", runs: 2, p50Ms: 100, p95Ms: 200 },
              { mode: "forced", runs: 1, p50Ms: 50, p95Ms: 50 },
            ]);
            yield* fs.remove(root, { recursive: true });
          })
        )
      ),
    15_000
  );

  it(
    "fails before spawning when the write credential tuple is incomplete",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-cache-warm-env-" });
            yield* initializeWarmRepository(root);
            let invoked = false;
            const error = yield* withWarmEnvironment(
              { TURBO_API: undefined, TURBO_TOKEN: undefined, TURBO_TEAM: undefined },
              runCacheWarmForTesting(root, O.none(), () => {
                invoked = true;
                return Effect.succeed(
                  CacheWarmLane.make({ command: [], durationMs: NonNegativeInt.make(0), exitCode: 0 })
                );
              }).pipe(Effect.flip)
            );

            expect(error.message).toContain("ephemeral TURBO_API injection");
            expect(invoked).toBe(false);
          })
        )
      ),
    15_000
  );

  it(
    "fails closed on a dirty or stale-main checkout",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-cache-warm-git-" });
            yield* initializeWarmRepository(root);
            yield* fs.writeFileString(path.join(root, "dirty.txt"), "dirty\n");

            const dirtyError = yield* withWarmEnvironment(
              validWarmEnvironment,
              runCacheWarmForTesting(root, O.none(), () =>
                Effect.succeed(CacheWarmLane.make({ command: [], durationMs: NonNegativeInt.make(0), exitCode: 0 }))
              ).pipe(Effect.flip)
            );
            expect(dirtyError.message).toContain("clean checkout");

            yield* fs.remove(path.join(root, "dirty.txt"));
            const commit = Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "ahead"], {
              cwd: root,
              stderr: "pipe",
              stdout: "pipe",
            });
            expect(commit.exitCode, commit.stderr.toString()).toBe(0);
            const staleError = yield* withWarmEnvironment(
              validWarmEnvironment,
              runCacheWarmForTesting(root, O.none(), () =>
                Effect.succeed(CacheWarmLane.make({ command: [], durationMs: NonNegativeInt.make(0), exitCode: 0 }))
              ).pipe(Effect.flip)
            );
            expect(staleError.message).toContain("HEAD to equal origin/main exactly");
          })
        )
      ),
    15_000
  );

  it(
    "propagates an injected warm-lane failure without writing a receipt",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-cache-warm-failure-" });
            const receiptPath = path.join(root, ".beep", "cache-warm.json");
            yield* initializeWarmRepository(root);

            const error = yield* withWarmEnvironment(
              validWarmEnvironment,
              runCacheWarmForTesting(root, O.some(receiptPath), () =>
                Effect.fail(CacheCommandError.new("injected warm failure"))
              ).pipe(Effect.flip)
            );
            expect(error.message).toBe("injected warm failure");
            expect(yield* fs.exists(receiptPath)).toBe(false);
          })
        )
      ),
    15_000
  );

  it(
    "withholds the receipt when a successful warm lane changes the exact-main checkout",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-cache-warm-mutation-" });
            const receiptPath = path.join(root, ".beep", "cache-warm.json");
            yield* initializeWarmRepository(root);

            const error = yield* withWarmEnvironment(
              validWarmEnvironment,
              runCacheWarmForTesting(root, O.some(receiptPath), () =>
                fs.writeFileString(path.join(root, "README.md"), "# changed during warm\n").pipe(
                  Effect.mapError((cause) => CacheCommandError.new("injected warm mutation failed", cause)),
                  Effect.as(
                    CacheWarmLane.make({ command: ["fixture"], durationMs: NonNegativeInt.make(1), exitCode: 0 })
                  )
                )
              ).pipe(Effect.flip)
            );
            expect(error.message).toContain("checkout changed during execution");
            expect(yield* fs.exists(receiptPath)).toBe(false);
          })
        )
      ),
    15_000
  );
});
