import {
  GraftCacheSyncLive,
  GraftDeepCoverage,
  GraftDeepLock,
  GraftDeepRefresh,
  GraftDeepRefreshLayer,
  GraftDeepRefreshOptions,
  GraftDeepRefreshProgress,
  GraftDeepRefreshStatus,
  GraftDeepRunner,
  GraftDeepRunnerLive,
  GraftDeepStepError,
  GraftDeepTimerOptions,
  graftCommand,
  parseDeepCoverage,
  renderGraftDeepRefreshUnits,
} from "@beep/repo-cli/commands/Graft";
import { CommandJsonOutput } from "@beep/repo-cli/test/Cli";
import { CapturedStep, formatCommandLine } from "@beep/repo-cli/test/Process";
import { PosInt } from "@beep/schema/Int";
import { NonNegativeInt } from "@beep/schema/Number";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { ConfigProvider, Console, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Dur from "effect/Duration";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import type { GraftDeepRunnerStep } from "@beep/repo-cli/commands/Graft";

const artifacts = [
  ".cache/summaries.json",
  "INDEX.md",
  "effects.md",
  "services.md",
  ".graph/wiring.json",
  "manifest.json",
];
const contents = [
  '{"summaries":{"file":"paid summary"}}\n',
  "# Index\n",
  "# Effects\n",
  "# Services\n",
  '{"crux":"paid crux"}\n',
  '{"version":1,"model":"test-model","repoDigest":"test-digest","files":[{"path":"src/file.ts","hash":"0a1b2c3d"}],"nodes":[{"slug":"effects","name":"Effects","type":"system","sources":["src/file.ts"]}]}\n',
];

const OWNER_HEAD = "1111111111111111111111111111111111111111";
const OWNER_HEAD_AFTER = "2222222222222222222222222222222222222222";
const FULL_COVERAGE = "meaning coverage: 38520/39115 symbols (98%).\n";
const LOW_COVERAGE = "meaning coverage: 900/1000 symbols (90%).\n";

const decodeStatusJson = S.decodeUnknownEffect(S.fromJsonString(GraftDeepRefreshStatus));
const encodeStatusJson = S.encodeEffect(S.fromJsonString(GraftDeepRefreshStatus));
const encodeLockJson = S.encodeEffect(S.fromJsonString(GraftDeepLock));

// A clone tree the real cache sync accepts: an owner with the paid meaning tier
// and two sibling clones whose basenames share its digit-stripped prefix.
const fixture = Effect.fn("GraftDeepRefreshTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "graft-deep-refresh-test-" }));
  const owner = path.join(directory, "beep-effect0");
  const siblings = A.map(["beep-effect2", "beep-effect3"], (name) => path.join(directory, name));
  const stateDir = path.join(directory, "state");
  yield* fs.makeDirectory(path.join(owner, ".git"), { recursive: true });
  yield* Effect.forEach(
    siblings,
    Effect.fn("GraftDeepRefreshTest.sibling")(function* (root) {
      yield* fs.makeDirectory(root, { recursive: true });
      yield* fs.writeFileString(path.join(root, ".git"), "gitdir: untouched\n");
    })
  );
  yield* Effect.forEach(
    artifacts,
    Effect.fn("GraftDeepRefreshTest.seed")(function* (relative, index) {
      const file = path.join(owner, "graft", relative);
      yield* fs.makeDirectory(path.dirname(file), { recursive: true });
      yield* fs.writeFileString(file, contents[index] ?? "");
    })
  );
  return { fs, path, directory, owner, siblings, stateDir };
});

const reply = (exitCode: number, output: string): CapturedStep =>
  CapturedStep.make({ exitCode, output, truncated: false });

// Scripted answers are matched on the rendered command line by prefix, so a
// step whose arguments vary (the `-j` of a deep build) still resolves.
const scriptedRunner = (options: {
  readonly alive: ReadonlyArray<number>;
  readonly calls: Array<GraftDeepRunnerStep>;
  readonly intercept?: (step: GraftDeepRunnerStep) => O.Option<Effect.Effect<CapturedStep, GraftDeepStepError>>;
  readonly replies: ReadonlyArray<readonly [string, CapturedStep]>;
  readonly sequences?: ReadonlyArray<readonly [string, ReadonlyArray<CapturedStep>]>;
}): Layer.Layer<GraftDeepRunner> => {
  const seen = MutableHashMap.empty<string, number>();
  const sequenced = (line: string): O.Option<CapturedStep> =>
    O.flatMap(
      A.findFirst(options.sequences ?? HEAD_SEQUENCE, ([prefix]) => Str.startsWith(prefix)(line)),
      ([prefix, answers]) => {
        const index = O.getOrElse(MutableHashMap.get(seen, prefix), () => 0);
        MutableHashMap.set(seen, prefix, index + 1);
        return O.orElse(A.get(answers, index), () => A.last(answers));
      }
    );
  return Layer.succeed(
    GraftDeepRunner,
    GraftDeepRunner.of({
      isPidAlive: Effect.fn("GraftDeepRefreshTest.isPidAlive")(function* (pid) {
        return A.contains(options.alive, pid);
      }),
      run: Effect.fn("GraftDeepRefreshTest.run")(function* (step) {
        options.calls.push(step);
        const intercepted = options.intercept?.(step) ?? O.none();
        if (O.isSome(intercepted)) return yield* intercepted.value;
        const line = formatCommandLine(step.command, step.args);
        return O.getOrElse(
          O.orElse(sequenced(line), () =>
            O.map(
              A.findFirst(options.replies, ([prefix]) => Str.startsWith(prefix)(line)),
              ([, answer]) => answer
            )
          ),
          () => reply(0, "")
        );
      }),
    })
  );
};

// `git rev-parse HEAD` runs twice per pull and must answer differently each
// time; prefix matching alone cannot tell the two calls apart.
const HEAD_SEQUENCE: ReadonlyArray<readonly [string, ReadonlyArray<CapturedStep>]> = [
  ["git rev-parse HEAD", [reply(0, OWNER_HEAD), reply(0, OWNER_HEAD_AFTER)]],
];

// Overrides are consulted first, so a test replaces one answer by name.
const repliesFor = (
  owner: string,
  buildOutput: string,
  overrides: ReadonlyArray<readonly [string, CapturedStep]> = []
): ReadonlyArray<readonly [string, CapturedStep]> => A.appendAll(overrides, happyReplies(owner, buildOutput));

const happyReplies = (owner: string, buildOutput: string): ReadonlyArray<readonly [string, CapturedStep]> => [
  ["git rev-parse --show-toplevel", reply(0, owner)],
  ["git rev-parse --abbrev-ref HEAD", reply(0, "main")],
  ["git status --porcelain", reply(0, "")],
  ["git remote get-url origin", reply(0, "https://github.com/beep-effect/beep-effect.git")],
  ["graft --version", reply(0, "0.16.0")],
  ["git fetch", reply(0, "")],
  ["git merge", reply(0, "")],
  ["git diff --quiet", reply(0, "")],
  ["graft build --deep", reply(0, buildOutput)],
  ["graft build", reply(0, "structural rebuild complete")],
];

const refreshOptions = (input: {
  readonly owner: string;
  readonly stateDir: string;
  readonly minCoverage?: number;
  readonly model?: string;
  readonly seed?: boolean;
  readonly rebuild?: boolean;
}): GraftDeepRefreshOptions =>
  GraftDeepRefreshOptions.make({
    owner: input.owner,
    stateDir: input.stateDir,
    jobs: PosInt.make(16),
    minCoverage: UnitInterval.make(input.minCoverage ?? 0.95),
    seed: input.seed ?? true,
    rebuild: input.rebuild ?? true,
    rebuildConcurrency: PosInt.make(2),
    ...O.getOrElse(
      O.map(O.fromUndefinedOr(input.model), (model) => ({ model })),
      () => ({})
    ),
  });

const refreshWith = (runner: Layer.Layer<GraftDeepRunner>) =>
  provideScopedLayer(GraftDeepRefreshLayer.pipe(Layer.provide(Layer.mergeAll(runner, GraftCacheSyncLive))));

const withHome = (home: string) => provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: home })));

const runCommand = Effect.fn("GraftDeepRefreshTest.runCommand")(function* (args: ReadonlyArray<string>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  const result = yield* Effect.result(
    Command.runWith(graftCommand, { version: "test", renderErrors: false })(args).pipe(
      Effect.provideService(Console.Console, {
        ...current,
        log: (...values: ReadonlyArray<unknown>) => {
          output = A.appendAll(output, values);
        },
      }),
      Effect.provideService(CommandJsonOutput, (text) =>
        Effect.sync(() => {
          output = A.append(output, text);
        })
      )
    )
  );
  return { result, output };
});

const commandLines = (calls: ReadonlyArray<GraftDeepRunnerStep>): ReadonlyArray<string> =>
  A.map(calls, (call) => formatCommandLine(call.command, call.args));

// The real clock, not the test clock: this suite drives filesystem work, a
// bounded retry inside the lock steal, and an interrupt delivered by a timeout.
layer(NodeServices.layer, { excludeTestServices: true })("Graft deep refresh", (it) => {
  it.effect(
    "parses coverage from both summary lines, carriage-return progress, and reports none without a coverage line",
    Effect.fn(function* () {
      const both = parseDeepCoverage(`${FULL_COVERAGE}1 file(s) failed to summarize.\n`);
      expect(O.map(both, (coverage) => [coverage.covered, coverage.total, coverage.failedFiles])).toEqual(
        O.some([38_520, 39_115, 1])
      );
      // A build that summarized every file never prints the failure line.
      expect(O.map(parseDeepCoverage(FULL_COVERAGE), (coverage) => coverage.failedFiles)).toEqual(O.some(0));
      const noisy = `crux 4137/4138\rcrux 4138/4138\r${FULL_COVERAGE}`;
      expect(O.map(parseDeepCoverage(noisy), (coverage) => coverage.covered)).toEqual(O.some(38_520));
      // The last coverage line describes the finished build.
      expect(O.map(parseDeepCoverage(`${LOW_COVERAGE}${FULL_COVERAGE}`), (coverage) => coverage.covered)).toEqual(
        O.some(38_520)
      );
      expect(parseDeepCoverage("graft build --deep: nothing to do\n")).toEqual(O.none());
    })
  );

  it.effect(
    "round-trips a complete status document through the JSON codec",
    Effect.fn(function* () {
      const status = GraftDeepRefreshStatus.make({
        schemaVersion: "beep-graft-deep-refresh/v1",
        owner: "/clones/beep-effect0",
        head: OWNER_HEAD_AFTER,
        model: "grok-4.6(low)",
        jobs: PosInt.make(16),
        startedAt: "2026-09-11T02:30:00.000Z",
        finishedAt: "2026-09-11T09:12:00.000Z",
        phase: "done",
        outcome: "degraded",
        coverage: GraftDeepCoverage.make({
          covered: NonNegativeInt.make(38_520),
          total: NonNegativeInt.make(39_115),
          failedFiles: NonNegativeInt.make(1),
        }),
        rebuilt: [],
        log: "/state/beep-graft/runs/20260911T023000Z.log",
        message: "coverage is 98.5%, below the 99% target",
      });
      expect(yield* decodeStatusJson(yield* encodeStatusJson(status))).toEqual(status);
    })
  );

  it.effect(
    "acquires the refresh lock, releases it on completion, and replaces a lock whose holder is gone",
    Effect.fn(function* () {
      const { fs, path, owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, FULL_COVERAGE) });
      const lockPath = path.join(stateDir, "refresh.lock");
      yield* fs.makeDirectory(stateDir, { recursive: true });
      yield* fs.writeFileString(
        lockPath,
        yield* encodeLockJson(GraftDeepLock.make({ pid: 424_242, startedAt: "2026-09-10T02:30:00.000Z" }))
      );
      const status = yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(runner)
      );
      expect(status.outcome).toBe("ok");
      // The stale lock was replaced, then removed when the run finished.
      expect(yield* fs.exists(lockPath)).toBe(false);
    })
  );

  it.effect(
    "refuses to start while a live process holds the lock and leaves that lock untouched",
    Effect.fn(function* () {
      const { fs, path, owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [process.pid],
        calls,
        replies: happyReplies(owner, FULL_COVERAGE),
      });
      const lockPath = path.join(stateDir, "refresh.lock");
      yield* fs.makeDirectory(stateDir, { recursive: true });
      const held = yield* encodeLockJson(
        GraftDeepLock.make({ pid: process.pid, startedAt: "2026-09-11T02:30:00.000Z" })
      );
      yield* fs.writeFileString(lockPath, held);
      const failure = yield* Effect.flip(
        GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir })))
      ).pipe(refreshWith(runner));
      expect(failure._tag).toBe("GraftDeepLockError");
      expect(yield* fs.readFileString(lockPath)).toBe(held);
      // Nothing but the operator notification ran: the fence is checked before
      // any Git command, and the live run's status file is left alone.
      expect(A.map(calls, (call) => call.command)).toEqual(["notify-send"]);
      expect(A.last(A.flatMap(calls, (call) => A.fromIterable(call.args)))).toEqual(
        O.some(`Refresh lock ${lockPath} is held by live process ${process.pid}.`)
      );
      expect(yield* fs.exists(path.join(stateDir, "status.json"))).toBe(false);
    })
  );

  it.effect(
    "loses a stale-lock steal race without deleting the winner's lock and names the live holder",
    Effect.fn(function* () {
      const { fs, path, owner, stateDir } = yield* fixture();
      const lockPath = path.join(stateDir, "refresh.lock");
      const dead = 424_242;
      yield* fs.makeDirectory(stateDir, { recursive: true });
      yield* fs.writeFileString(
        lockPath,
        yield* encodeLockJson(GraftDeepLock.make({ pid: dead, startedAt: "2026-09-10T02:30:00.000Z" }))
      );
      const winner = yield* encodeLockJson(
        GraftDeepLock.make({ pid: process.pid, startedAt: "2026-09-11T02:30:00.000Z" })
      );
      // Stand in for the racer that renamed the stale lock aside first and then
      // claimed it: this run's rename finds nothing to move.
      const racingFs = FileSystem.FileSystem.of({
        ...fs,
        rename: Effect.fn("GraftDeepRefreshTest.racingRename")(function* (from, to) {
          if (from !== lockPath) return yield* fs.rename(from, to);
          yield* fs.writeFileString(lockPath, winner);
          return yield* fs.rename(path.join(stateDir, "never-existed"), to);
        }),
      });
      const calls: Array<GraftDeepRunnerStep> = [];
      const failure = yield* Effect.flip(
        GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir })))
      ).pipe(
        refreshWith(scriptedRunner({ alive: [process.pid], calls, replies: happyReplies(owner, FULL_COVERAGE) })),
        Effect.provideService(FileSystem.FileSystem, racingFs)
      );
      // The live winner is named, never the dead pid this run started from.
      expect(failure).toEqual(expect.objectContaining({ _tag: "GraftDeepLockError", holderPid: process.pid }));
      expect(yield* fs.readFileString(lockPath)).toBe(winner);
      expect(yield* fs.exists(path.join(stateDir, "status.json"))).toBe(false);
    }),
    30_000
  );

  it.effect(
    "records a sibling rebuild that never finished and degrades instead of losing the run",
    Effect.fn(function* () {
      const { owner, siblings, stateDir } = yield* fixture();
      const stalled = siblings[1] ?? "";
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [],
        calls,
        // A rebuild that hits its own timeout reaches the error channel; the
        // run must degrade rather than interrupt the clones still rebuilding.
        intercept: (step) =>
          step.phase === "rebuild" && step.cwd === stalled
            ? O.some(
                Effect.fail(
                  GraftDeepStepError.make({
                    step: "rebuild",
                    exitCode: 1,
                    log: "",
                    message: `graft build timed out in ${stalled}.`,
                  })
                )
              )
            : O.none(),
        replies: happyReplies(owner, FULL_COVERAGE),
      });
      const status = yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(runner)
      );
      expect(status.outcome).toBe("degraded");
      expect(status.message).toEqual(expect.stringContaining("1 sibling rebuild(s) exited non-zero"));
      expect(A.map(status.rebuilt, (entry) => [entry.root, entry.exitCode])).toEqual([
        [siblings[0], 0],
        [stalled, 124],
      ]);
    }),
    30_000
  );

  it.effect(
    "records an interrupted run as failed, notifies, and releases the lock",
    Effect.fn(function* () {
      const { fs, path, owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [],
        calls,
        // systemd stops the unit with SIGTERM, which runMain turns into a fiber
        // interrupt; a deep build parked mid-run is what that interrupts.
        intercept: (step) =>
          Str.startsWith("graft build --deep")(formatCommandLine(step.command, step.args))
            ? O.some(Effect.never)
            : O.none(),
        replies: happyReplies(owner, FULL_COVERAGE),
      });
      const interrupted = yield* Effect.timeoutOption(
        GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(refreshWith(runner)),
        Dur.seconds(2)
      );
      expect(interrupted).toEqual(O.none());
      const recorded = yield* decodeStatusJson(yield* fs.readFileString(path.join(stateDir, "status.json")));
      expect(recorded.outcome).toBe("failed");
      expect(recorded.message).toEqual(expect.stringContaining("interrupted during build"));
      expect(recorded.finishedAt).toBeDefined();
      expect(A.some(commandLines(calls), Str.startsWith("notify-send"))).toBe(true);
      // The finalizer ran inside the locked region, and the lock came off after.
      expect(yield* fs.exists(path.join(stateDir, "refresh.lock"))).toBe(false);
    }),
    30_000
  );

  it.effect(
    "refuses a dirty tree, a non-main branch, and a failing patch-kit check before touching Git history",
    Effect.fn(function* () {
      const { owner, stateDir } = yield* fixture();
      const refuse = Effect.fn("GraftDeepRefreshTest.refuse")(function* (
        replies: ReadonlyArray<readonly [string, CapturedStep]>
      ) {
        const calls: Array<GraftDeepRunnerStep> = [];
        const runner = scriptedRunner({ alive: [], calls, replies });
        const failure = yield* Effect.flip(
          GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir })))
        ).pipe(refreshWith(runner));
        return { calls, failure };
      });
      const dirty = yield* refuse(
        repliesFor(owner, FULL_COVERAGE, [["git status --porcelain", reply(0, " M AGENTS.md")]])
      );
      expect(dirty.failure._tag).toBe("GraftDeepPreflightError");
      expect(A.some(commandLines(dirty.calls), Str.startsWith("git fetch"))).toBe(false);
      const branched = yield* refuse(
        repliesFor(owner, FULL_COVERAGE, [["git rev-parse --abbrev-ref HEAD", reply(0, "feat/graft-deep-refresh")]])
      );
      expect(branched.failure._tag).toBe("GraftDeepPreflightError");
      const patched = yield* refuse(repliesFor(owner, FULL_COVERAGE, [["/", reply(1, "missing: ai/crux.js")]]));
      expect(patched.failure._tag).toBe("GraftDeepPreflightError");
      expect(A.some(commandLines(patched.calls), Str.includes("apply-dist-patches.sh"))).toBe(true);
      // The notifier fires once per failed run.
      expect(A.filter(commandLines(patched.calls), Str.startsWith("notify-send"))).toHaveLength(1);
    })
  );

  it.effect(
    "records every phase in status.json, seeds both siblings, rebuilds them, and reports ok",
    Effect.fn(function* () {
      const { fs, path, owner, siblings, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, FULL_COVERAGE) });
      let phases: ReadonlyArray<string> = [];
      const statusFile = path.join(stateDir, "status.json");
      // Reading the file back inside the sink proves the status was on disk
      // before the phase was announced.
      const recordPhase = Effect.fnUntraced(function* () {
        const onDisk = yield* decodeStatusJson(yield* fs.readFileString(statusFile));
        phases = A.append(phases, onDisk.phase);
      });
      const status = yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        Effect.provideService(GraftDeepRefreshProgress, () => Effect.orDie(recordPhase())),
        refreshWith(runner)
      );
      expect(phases).toEqual(["preflight", "pull", "install", "build", "seed", "rebuild", "done"]);
      expect(status.outcome).toBe("ok");
      expect(status.head).toBe(OWNER_HEAD_AFTER);
      expect(status.model).toBe("(env default)");
      expect(O.map(O.fromUndefinedOr(status.coverage), (coverage) => coverage.covered)).toEqual(O.some(38_520));
      expect(O.map(O.fromUndefinedOr(status.seed), (seed) => seed.copied)).toEqual(O.some(12));
      expect(A.map(status.rebuilt, (entry) => entry.root)).toEqual(siblings);
      expect(A.every(status.rebuilt, (entry) => entry.exitCode === 0)).toBe(true);
      expect(status.message).toBeUndefined();
      // Both clones really received the paid artifacts.
      expect(yield* fs.readFileString(path.join(siblings[0] ?? "", "graft", "manifest.json"))).toBe(contents[5]);
      expect(yield* fs.readFileString(path.join(siblings[1] ?? "", "graft", ".cache", "summaries.json"))).toBe(
        contents[0]
      );
      // The deep build carries the crux-retry default and one structural
      // rebuild ran per seeded clone.
      const build = A.findFirst(calls, (call) =>
        Str.startsWith("graft build --deep")(formatCommandLine(call.command, call.args))
      );
      expect(O.map(build, (call) => call.env?.GRAFT_CRUX_EMPTY_RETRIES)).toEqual(O.some("2"));
      expect(O.map(build, (call) => call.env?.GRAFT_MODEL)).toEqual(O.some(undefined));
      expect(A.filter(commandLines(calls), (line) => line === "graft build")).toHaveLength(2);
      // The lockfile diff spans the revisions the pull actually moved between.
      expect(commandLines(calls)).toContain(`git diff --quiet ${OWNER_HEAD} ${OWNER_HEAD_AFTER} -- bun.lock`);
      expect(A.some(commandLines(calls), Str.startsWith("notify-send"))).toBe(false);
      // The run log kept the captured output of the deep build.
      expect(Str.includes("meaning coverage")(yield* fs.readFileString(status.log))).toBe(true);
    }),
    30_000
  );

  it.effect(
    "ignores git stderr noise on the value-bearing probes",
    Effect.fn(function* () {
      const { owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      // A --reference clone routinely warns about a broken origin/HEAD ref.
      // Merged into stdout that warning reads as a dirty tree and as a corrupt
      // revision, so every parsed probe must ask for stdout alone.
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, FULL_COVERAGE) });
      const status = yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(runner)
      );
      expect(status.outcome).toBe("ok");
      const parsed = A.filter(calls, (call) =>
        A.contains(
          [
            "git rev-parse --show-toplevel",
            "git rev-parse --abbrev-ref HEAD",
            "git status --porcelain",
            "git remote get-url origin",
            "git rev-parse HEAD",
          ],
          formatCommandLine(call.command, call.args)
        )
      );
      expect(A.length(parsed)).toBe(6);
      expect(A.every(parsed, (call) => call.source === "stdout")).toBe(true);
      // Log-only steps keep stderr, which is where a failing build explains itself.
      const build = A.findFirst(calls, (call) =>
        Str.startsWith("graft build --deep")(formatCommandLine(call.command, call.args))
      );
      expect(O.map(build, (call) => call.source)).toEqual(O.some(undefined));
    }),
    30_000
  );

  it.effect(
    "reports degraded when coverage is below the target and still seeds the siblings",
    Effect.fn(function* () {
      const { fs, path, owner, siblings, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, LOW_COVERAGE) });
      const status = yield* GraftDeepRefresh.use((refresh) =>
        refresh.run(refreshOptions({ owner, stateDir, minCoverage: 0.95 }))
      ).pipe(refreshWith(runner));
      expect(status.outcome).toBe("degraded");
      expect(status.message).toEqual(expect.stringContaining("below the 95% target"));
      expect(O.map(O.fromUndefinedOr(status.seed), (seed) => seed.refused)).toEqual(O.some(0));
      expect(yield* fs.exists(path.join(siblings[0] ?? "", "graft", "INDEX.md"))).toBe(true);
      // A degraded night is not a failure, so no operator notification fires.
      expect(A.some(commandLines(calls), Str.startsWith("notify-send"))).toBe(false);
    }),
    30_000
  );

  it.effect(
    "fails a non-zero deep build, records the failure in status.json, and notifies the operator",
    Effect.fn(function* () {
      const { fs, path, owner, siblings, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [],
        calls,
        replies: repliesFor(owner, FULL_COVERAGE, [
          ["graft build --deep", reply(1, "fatal: provider refused the request")],
        ]),
      });
      const failure = yield* Effect.flip(
        GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir })))
      ).pipe(refreshWith(runner));
      expect(failure._tag).toBe("GraftDeepStepError");
      const recorded = yield* decodeStatusJson(yield* fs.readFileString(path.join(stateDir, "status.json")));
      expect(recorded.outcome).toBe("failed");
      expect(recorded.phase).toBe("build");
      expect(recorded.message).toEqual(expect.stringContaining("exited with 1"));
      const notifications = A.filter(calls, (call) => call.command === "notify-send");
      expect(A.map(notifications, (call) => A.take(call.args, 2))).toEqual([
        ["--urgency=critical", "beep graft deep refresh failed"],
      ]);
      // Nothing was seeded and no clone was rebuilt.
      expect(yield* fs.exists(path.join(siblings[0] ?? "", "graft"))).toBe(false);
      expect(A.filter(commandLines(calls), (line) => line === "graft build")).toHaveLength(0);
      expect(yield* fs.exists(path.join(stateDir, "refresh.lock"))).toBe(false);
    }),
    30_000
  );

  it.effect(
    "renders the systemd units verbatim and refuses to install without an environment file",
    Effect.fn(function* () {
      const { fs, path, owner, stateDir } = yield* fixture();
      const options = GraftDeepTimerOptions.make({
        owner,
        bunPath: "/usr/bin/bun",
        onCalendar: "*-*-* 02:30:00",
        envFile: path.join(stateDir, "env"),
        uninstall: false,
      });
      const units = renderGraftDeepRefreshUnits(options);
      expect(A.map(units, (unit) => unit.fileName)).toEqual([
        "beep-graft-deep-refresh.service",
        "beep-graft-deep-refresh.timer",
      ]);
      expect(units[0]?.text).toBe(
        [
          "[Unit]",
          "Description=beep graft deep refresh (nightly meaning-tier rebuild + sibling seed)",
          "",
          "[Service]",
          "Type=oneshot",
          `WorkingDirectory=${owner}`,
          "Environment=PATH=%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin",
          "Environment=CI=true",
          `EnvironmentFile=${path.join(stateDir, "env")}`,
          `ExecStartPre=/usr/bin/git -C ${owner} pull --ff-only --quiet origin main`,
          "ExecStartPre=/usr/bin/bun install --frozen-lockfile",
          `ExecStart=/usr/bin/bun run beep graft deep refresh --owner ${owner} --jobs 16`,
          "TimeoutStartSec=8h",
          "TimeoutStopSec=90",
          "KillMode=mixed",
          "Nice=10",
          "Slice=background.slice",
          "",
        ].join("\n")
      );
      expect(units[1]?.text).toBe(
        [
          "[Unit]",
          "Description=Timer for beep graft deep refresh (nightly meaning-tier rebuild + sibling seed)",
          "",
          "[Timer]",
          "OnCalendar=*-*-* 02:30:00",
          "Persistent=true",
          "RandomizedDelaySec=600",
          "",
          "[Install]",
          "WantedBy=timers.target",
          "",
        ].join("\n")
      );
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, FULL_COVERAGE) });
      const failure = yield* Effect.flip(GraftDeepRefresh.use((refresh) => refresh.installTimer(options))).pipe(
        refreshWith(runner)
      );
      expect(failure).toEqual(
        expect.objectContaining({ _tag: "GraftDeepPreflightError", path: path.join(stateDir, "env") })
      );
      // A missing environment file is refused before systemd is touched.
      expect(A.some(commandLines(calls), Str.startsWith("systemctl"))).toBe(false);
      // Once the file exists the installer refuses an untrusted mise config.
      yield* fs.makeDirectory(stateDir, { recursive: true });
      yield* fs.writeFileString(path.join(stateDir, "env"), "GRAFT_PROVIDER=openai\n");
      const untrustedCalls: Array<GraftDeepRunnerStep> = [];
      const untrusted = yield* Effect.flip(GraftDeepRefresh.use((refresh) => refresh.installTimer(options))).pipe(
        refreshWith(
          scriptedRunner({
            alive: [],
            calls: untrustedCalls,
            replies: repliesFor(owner, FULL_COVERAGE, [
              ["mise trust --show", reply(0, `${owner}/mise.toml: untrusted`)],
            ]),
          })
        )
      );
      expect(untrusted._tag).toBe("GraftDeepPreflightError");
      expect(untrusted.message).toEqual(expect.stringContaining("untrusted config"));
      expect(A.some(commandLines(untrustedCalls), Str.startsWith("systemctl"))).toBe(false);
      // A unit that fetches over SSH would fail every night: the user manager
      // has no agent to answer for the key.
      const sshCalls: Array<GraftDeepRunnerStep> = [];
      const sshRemote = yield* Effect.flip(GraftDeepRefresh.use((refresh) => refresh.installTimer(options))).pipe(
        refreshWith(
          scriptedRunner({
            alive: [],
            calls: sshCalls,
            replies: repliesFor(owner, FULL_COVERAGE, [
              ["git remote get-url origin", reply(0, "git@github.com:beep-effect/beep-effect.git")],
            ]),
          })
        )
      );
      expect(sshRemote._tag).toBe("GraftDeepPreflightError");
      expect(sshRemote.message).toEqual(expect.stringContaining("no SSH agent"));
      expect(A.some(commandLines(sshCalls), Str.startsWith("systemctl"))).toBe(false);
    })
  );

  it.effect(
    "captures real subprocess output, tags a command that cannot spawn, and probes process liveness",
    Effect.fn(function* () {
      const { directory } = yield* fixture();
      const version = yield* GraftDeepRunner.use((runner) =>
        runner.run({ args: ["--version"], command: process.execPath, cwd: directory, phase: "build" })
      ).pipe(provideScopedLayer(GraftDeepRunnerLive.pipe(Layer.provide(NodeServices.layer))));
      expect(version.exitCode).toBe(0);
      expect(Str.isNonEmpty(version.output)).toBe(true);
      const missing = yield* Effect.flip(
        GraftDeepRunner.use((runner) =>
          runner.run({
            args: [],
            command: "beep-graft-deep-refresh-missing-binary",
            cwd: directory,
            log: "/state/run.log",
            phase: "build",
          })
        )
      ).pipe(provideScopedLayer(GraftDeepRunnerLive.pipe(Layer.provide(NodeServices.layer))));
      expect(missing._tag).toBe("GraftDeepStepError");
      expect(missing.step).toBe("build");
      expect(missing.log).toBe("/state/run.log");
      const liveness = yield* GraftDeepRunner.use(
        Effect.fn("GraftDeepRefreshTest.liveness")(function* (runner) {
          // PID 1 always exists; a non-root prober sees it through EPERM.
          return [
            yield* runner.isPidAlive(process.pid),
            yield* runner.isPidAlive(1),
            yield* runner.isPidAlive(0x3ff_ffff),
          ];
        })
      ).pipe(provideScopedLayer(GraftDeepRunnerLive.pipe(Layer.provide(NodeServices.layer))));
      expect(liveness).toEqual([true, true, false]);
    }),
    30_000
  );

  it.effect(
    "reads back a missing, a written, and an unreadable status document",
    Effect.fn(function* () {
      const { fs, path, owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, FULL_COVERAGE) });
      expect(yield* GraftDeepRefresh.use((refresh) => refresh.readStatus(stateDir)).pipe(refreshWith(runner))).toEqual(
        O.none()
      );
      yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(runner)
      );
      const read = yield* GraftDeepRefresh.use((refresh) => refresh.readStatus(stateDir)).pipe(refreshWith(runner));
      expect(O.map(read, (status) => status.outcome)).toEqual(O.some("ok"));
      yield* fs.writeFileString(path.join(stateDir, "status.json"), "{ not a status }\n");
      const corrupt = yield* Effect.flip(GraftDeepRefresh.use((refresh) => refresh.readStatus(stateDir))).pipe(
        refreshWith(runner)
      );
      expect(corrupt._tag).toBe("GraftCacheIoError");
      expect(corrupt.path).toBe(path.join(stateDir, "status.json"));
    }),
    30_000
  );

  it.effect(
    "passes the requested model and reinstalls dependencies only when bun.lock moved",
    Effect.fn(function* () {
      const { owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [],
        calls,
        // `git diff --quiet` exits 1 when the lockfile changed across the pull.
        replies: repliesFor(owner, FULL_COVERAGE, [["git diff --quiet", reply(1, "")]]),
      });
      const status = yield* GraftDeepRefresh.use((refresh) =>
        refresh.run(refreshOptions({ owner, stateDir, model: "grok-4.6(low)" }))
      ).pipe(refreshWith(runner));
      expect(status.model).toBe("grok-4.6(low)");
      expect(A.filter(commandLines(calls), Str.startsWith("bun install --frozen-lockfile"))).toHaveLength(1);
      const build = A.findFirst(calls, (call) =>
        Str.startsWith("graft build --deep")(formatCommandLine(call.command, call.args))
      );
      expect(O.map(build, (call) => call.env?.GRAFT_MODEL)).toEqual(O.some("grok-4.6(low)"));
      // An operator-set crux retry budget is forwarded rather than overwritten.
      const configuredCalls: Array<GraftDeepRunnerStep> = [];
      yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(scriptedRunner({ alive: [], calls: configuredCalls, replies: happyReplies(owner, FULL_COVERAGE) })),
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ GRAFT_CRUX_EMPTY_RETRIES: "5" })))
      );
      const configuredBuild = A.findFirst(configuredCalls, (call) =>
        Str.startsWith("graft build --deep")(formatCommandLine(call.command, call.args))
      );
      expect(O.map(configuredBuild, (call) => call.env?.GRAFT_CRUX_EMPTY_RETRIES)).toEqual(O.some("5"));
    }),
    30_000
  );

  it.effect(
    "refuses a missing owner, a nested work tree, a broken graft install, and an unreadable lock",
    Effect.fn(function* () {
      const { fs, path, directory, owner, stateDir } = yield* fixture();
      const refuse = Effect.fn("GraftDeepRefreshTest.refuseWith")(function* (
        replies: ReadonlyArray<readonly [string, CapturedStep]>,
        root: string = owner
      ) {
        const calls: Array<GraftDeepRunnerStep> = [];
        return yield* Effect.flip(
          GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner: root, stateDir })))
        ).pipe(refreshWith(scriptedRunner({ alive: [], calls, replies })));
      });
      const absent = yield* refuse(happyReplies(owner, FULL_COVERAGE), path.join(directory, "beep-effect-absent"));
      expect(absent._tag).toBe("GraftDeepPreflightError");
      const nested = yield* refuse(
        repliesFor(owner, FULL_COVERAGE, [["git rev-parse --show-toplevel", reply(0, directory)]])
      );
      expect(nested._tag).toBe("GraftDeepPreflightError");
      const sshRemote = yield* refuse(
        repliesFor(owner, FULL_COVERAGE, [
          ["git remote get-url origin", reply(0, "git@github.com:beep-effect/beep-effect.git")],
        ])
      );
      expect(sshRemote._tag).toBe("GraftDeepPreflightError");
      expect(sshRemote.message).toEqual(expect.stringContaining("remote set-url origin https://"));
      const brokenGraft = yield* refuse(
        repliesFor(owner, FULL_COVERAGE, [["graft --version", reply(127, "command not found")]])
      );
      expect(brokenGraft._tag).toBe("GraftDeepPreflightError");
      yield* fs.makeDirectory(stateDir, { recursive: true });
      yield* fs.writeFileString(path.join(stateDir, "refresh.lock"), "half a lock\n");
      const unreadable = yield* refuse(happyReplies(owner, FULL_COVERAGE));
      expect(unreadable).toEqual(
        expect.objectContaining({ _tag: "GraftDeepPreflightError", path: path.join(stateDir, "refresh.lock") })
      );
    }),
    30_000
  );

  it.effect(
    "reports degraded with unknown coverage when the build printed no coverage line",
    Effect.fn(function* () {
      const { owner, stateDir } = yield* fixture();
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [],
        calls,
        replies: repliesFor(owner, FULL_COVERAGE, [["graft build --deep", reply(0, "nothing to do\n")]]),
      });
      const status = yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(runner)
      );
      expect(status.outcome).toBe("degraded");
      expect(status.coverage).toBeUndefined();
      expect(status.message).toEqual(expect.stringContaining("the build printed no coverage line"));
      // A build whose output overran the capture bound says so, because the
      // remedy is different from a build that genuinely printed nothing.
      const truncatedCalls: Array<GraftDeepRunnerStep> = [];
      const truncated = yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(
          scriptedRunner({
            alive: [],
            calls: truncatedCalls,
            replies: repliesFor(owner, FULL_COVERAGE, [
              [
                "graft build --deep",
                CapturedStep.make({ exitCode: 0, output: "summarizing 5216/5216", truncated: true }),
              ],
            ]),
          })
        )
      );
      expect(truncated.message).toEqual(expect.stringContaining("truncated at the capture bound"));
    }),
    30_000
  );

  it.effect(
    "writes both units under the operator home, enables the timer, and removes them on uninstall",
    Effect.fn(function* () {
      const { fs, path, directory, owner, stateDir } = yield* fixture();
      const home = path.join(directory, "home");
      const unitDir = path.join(home, ".config", "systemd", "user");
      yield* fs.makeDirectory(stateDir, { recursive: true });
      yield* fs.writeFileString(path.join(stateDir, "env"), "GRAFT_PROVIDER=openai\n");
      const options = GraftDeepTimerOptions.make({
        owner,
        bunPath: "/usr/bin/bun",
        onCalendar: "*-*-* 02:30:00",
        envFile: path.join(stateDir, "env"),
        uninstall: false,
      });
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({
        alive: [],
        calls,
        replies: repliesFor(owner, FULL_COVERAGE, [["mise trust --show", reply(0, `${owner}: trusted`)]]),
      });
      const written = yield* GraftDeepRefresh.use((refresh) => refresh.installTimer(options)).pipe(
        refreshWith(runner),
        withHome(home)
      );
      expect(written).toEqual([
        path.join(unitDir, "beep-graft-deep-refresh.service"),
        path.join(unitDir, "beep-graft-deep-refresh.timer"),
      ]);
      const units = renderGraftDeepRefreshUnits(options);
      expect(yield* fs.readFileString(written[0] ?? "")).toBe(units[0]?.text);
      expect(yield* fs.readFileString(written[1] ?? "")).toBe(units[1]?.text);
      expect(A.filter(commandLines(calls), Str.startsWith("systemctl"))).toEqual([
        "systemctl --user daemon-reload",
        "systemctl --user enable --now beep-graft-deep-refresh.timer",
      ]);
      const removedCalls: Array<GraftDeepRunnerStep> = [];
      const removed = yield* GraftDeepRefresh.use((refresh) =>
        refresh.installTimer(GraftDeepTimerOptions.make({ ...options, uninstall: true }))
      ).pipe(refreshWith(scriptedRunner({ alive: [], calls: removedCalls, replies: [] })), withHome(home));
      expect(removed).toEqual(written);
      expect(yield* fs.exists(written[0] ?? "")).toBe(false);
      expect(yield* fs.exists(written[1] ?? "")).toBe(false);
      expect(A.filter(commandLines(removedCalls), Str.startsWith("systemctl"))).toEqual([
        "systemctl --user disable --now beep-graft-deep-refresh.timer",
        "systemctl --user daemon-reload",
      ]);
      // A systemd reload that fails is a step failure, not a silent install.
      const refused = yield* Effect.flip(GraftDeepRefresh.use((refresh) => refresh.installTimer(options))).pipe(
        refreshWith(
          scriptedRunner({
            alive: [],
            calls: [],
            replies: repliesFor(owner, FULL_COVERAGE, [
              ["mise trust --show", reply(0, `${owner}: trusted`)],
              ["systemctl --user daemon-reload", reply(1, "Failed to connect to bus")],
            ]),
          })
        ),
        withHome(home)
      );
      expect(refused._tag).toBe("GraftDeepStepError");
      expect(refused.message).toEqual(expect.stringContaining("Failed to connect to bus"));
    }),
    30_000
  );

  it.effect(
    "renders, encodes, and refuses refresh status through the command surface",
    Effect.fn(function* () {
      const { fs, path, owner, siblings, stateDir } = yield* fixture();
      const empty = yield* runCommand(["deep", "status", "--state-dir", stateDir]);
      expect(Result.isSuccess(empty.result)).toBe(true);
      expect(empty.output).toEqual([`No refresh recorded under ${stateDir}.`]);
      const calls: Array<GraftDeepRunnerStep> = [];
      const runner = scriptedRunner({ alive: [], calls, replies: happyReplies(owner, FULL_COVERAGE) });
      yield* GraftDeepRefresh.use((refresh) => refresh.run(refreshOptions({ owner, stateDir }))).pipe(
        refreshWith(runner)
      );
      const rendered = yield* runCommand(["deep", "status", "--state-dir", stateDir]);
      expect(Result.isSuccess(rendered.result)).toBe(true);
      expect(rendered.output[0]).toEqual(expect.stringContaining("Graft deep refresh: done (ok)"));
      expect(rendered.output[0]).toEqual(expect.stringContaining("Coverage: 38520/39115 symbols (98.5%)"));
      expect(rendered.output[0]).toEqual(expect.stringContaining("Seeded: 12 copied"));
      expect(rendered.output[0]).toEqual(expect.stringContaining(`Rebuilt: ${A.length(siblings)} clone(s), 0 failing`));
      const encoded = yield* runCommand(["deep", "status", "--state-dir", stateDir, "--json"]);
      expect(Result.isSuccess(encoded.result)).toBe(true);
      const decoded = yield* decodeStatusJson(encoded.output[0]);
      expect(decoded.head).toBe(OWNER_HEAD_AFTER);
      // A degraded note is rendered for the operator when one is recorded.
      yield* fs.writeFileString(
        path.join(stateDir, "status.json"),
        yield* encodeStatusJson(GraftDeepRefreshStatus.make({ ...decoded, message: "one sibling rebuild failed" }))
      );
      const noted = yield* runCommand(["deep", "status", "--state-dir", stateDir]);
      expect(noted.output[0]).toEqual(expect.stringContaining("Note: one sibling rebuild failed"));
      // Invalid option values are refused before the service ever starts.
      const invalid = yield* runCommand(["deep", "refresh", "--owner", owner, "--state-dir", stateDir, "--jobs", "0"]);
      expect(O.map(Result.getFailure(invalid.result), (failure) => failure)).toEqual(
        O.some(
          expect.objectContaining({ _tag: "GraftDeepPreflightError", path: owner, message: "Invalid refresh options." })
        )
      );
      // A status with no head, coverage, or seed receipt still renders.
      yield* fs.writeFileString(
        path.join(stateDir, "status.json"),
        yield* encodeStatusJson(
          GraftDeepRefreshStatus.make({
            schemaVersion: "beep-graft-deep-refresh/v1",
            owner,
            model: "(env default)",
            jobs: PosInt.make(16),
            startedAt: "2026-09-11T02:30:00.000Z",
            phase: "build",
            rebuilt: [],
            log: path.join(stateDir, "runs", "20260911T023000Z.log"),
          })
        )
      );
      const inFlight = yield* runCommand(["deep", "status", "--state-dir", stateDir]);
      expect(inFlight.output[0]).toEqual(expect.stringContaining("Graft deep refresh: build"));
      expect(inFlight.output[0]).toEqual(expect.stringContaining("Coverage: not reported"));
      expect(inFlight.output[0]).toEqual(expect.stringContaining("Seeded: nothing applied"));
      // install-timer refuses a missing environment file before spawning systemd.
      const timer = yield* runCommand([
        "deep",
        "install-timer",
        "--owner",
        owner,
        "--env-file",
        path.join(stateDir, "absent-env"),
      ]);
      expect(Result.isFailure(timer.result)).toBe(true);
      const group = yield* runCommand(["deep"]);
      expect(group.output[0]).toEqual(expect.stringContaining("Graft deep commands: refresh"));
      const root = yield* runCommand([]);
      expect(root.output[0]).toEqual(expect.stringContaining("deep refresh|status|install-timer"));
    }),
    30_000
  );
});
