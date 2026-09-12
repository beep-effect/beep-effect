/**
 * Nightly rebuild of the paid-for Graft meaning tier from one owner clone.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { Cause, Config, Effect, Exit, flow, Match, pipe } from "effect";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Dur from "effect/Duration";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcessSpawner } from "effect/unstable/process";
import { ensureZeroExit, formatCommandLine, OutputBound, runCaptured } from "../../internal/process/StepExec.ts";
import { GraftCacheIoError, GraftDeepLockError, GraftDeepPreflightError, GraftDeepStepError } from "./Graft.errors.ts";
import {
  GraftCacheSyncAction,
  GraftDeepBunCandidate,
  GraftDeepLock,
  GraftDeepRefreshOutcome,
  GraftDeepRefreshStatus,
  GraftDeepRunnerStep,
  GraftDeepSiblingRebuild,
  parseDeepCoverage,
} from "./Graft.schemas.ts";
import { GraftCacheSync, GraftCacheSyncLive } from "./Graft.service.ts";
import type { CapturedStep } from "../../internal/process/StepExec.ts";
import type { GraftCacheSourceError, GraftCacheTargetError } from "./Graft.errors.ts";
import type {
  GraftCacheSyncReport,
  GraftDeepCoverage,
  GraftDeepRefreshOptions,
  GraftDeepRefreshPhase,
  GraftDeepTimerOptions,
} from "./Graft.schemas.ts";

const $I = $RepoCliId.create("commands/Graft/GraftDeep.service");

const REFRESH_STATUS_VERSION = "beep-graft-deep-refresh/v1";
const REFRESH_UNIT_BASE_NAME = "beep-graft-deep-refresh";
const REFRESH_UNIT_DESCRIPTION = "beep graft deep refresh (nightly meaning-tier rebuild + sibling seed)";
// A systemd user unit starts with a nearly empty PATH. The refresh spawns
// `graft` (an npm global whose shebang resolves `node` through the mise shims)
// and `bun`, so the unit carries the PATH those live on; %h is the home
// directory systemd expands at load time.
const REFRESH_UNIT_PATH = "%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin";

// The deep build prints a line per file for thousands of files; the shared
// repo-run bound would drop the coverage summary that arrives at the very end.
const deepOutputBound = OutputBound.make({
  maxChars: 8 * 1024 * 1024,
  truncatedNotice: `\n[beep-cli] graft deep output truncated after ${8 * 1024 * 1024} characters`,
});

// The shell convention for "killed by a timeout"; a sibling rebuild that never
// reported an exit code is recorded under it rather than losing the run.
const REBUILD_UNFINISHED_EXIT = 124;

type RefreshContext = {
  readonly appendLog: (text: string) => Effect.Effect<void, GraftCacheIoError>;
  readonly mustSucceed: (
    input: GraftDeepRunnerStep
  ) => Effect.Effect<CapturedStep, GraftDeepStepError | GraftCacheIoError>;
  readonly options: GraftDeepRefreshOptions;
  readonly owner: string;
  readonly step: (input: GraftDeepRunnerStep) => Effect.Effect<CapturedStep, GraftDeepStepError | GraftCacheIoError>;
};

const revParseHeadStep = (owner: string) =>
  GraftDeepRunnerStep.make({
    args: ["rev-parse", "HEAD"],
    command: "git",
    cwd: owner,
    phase: "pull",
    source: "stdout",
    timeout: "2 minutes",
  });

const fetchStep = (owner: string) =>
  GraftDeepRunnerStep.make({
    args: ["fetch", "--quiet", "origin"],
    command: "git",
    cwd: owner,
    phase: "pull",
    timeout: "15 minutes",
  });

const mergeStep = (owner: string) =>
  GraftDeepRunnerStep.make({
    args: ["merge", "--ff-only", "origin/main"],
    command: "git",
    cwd: owner,
    phase: "pull",
    timeout: "5 minutes",
  });

const lockDiffStep = (owner: string, before: string, after: string) =>
  GraftDeepRunnerStep.make({
    args: ["diff", "--quiet", before, after, "--", "bun.lock"],
    command: "git",
    cwd: owner,
    phase: "pull",
    timeout: "5 minutes",
  });

const bunInstallStep = (owner: string) =>
  GraftDeepRunnerStep.make({
    args: ["install", "--frozen-lockfile"],
    command: "bun",
    cwd: owner,
    phase: "install",
    timeout: "30 minutes",
  });

const deepBuildStep = (options: GraftDeepRefreshOptions, cruxRetries: O.Option<string>) =>
  GraftDeepRunnerStep.make({
    args: ["build", "--deep", "-j", `${options.jobs}`, "--allow-partial"],
    command: "graft",
    cwd: options.owner,
    env: {
      ...pipe(
        O.fromUndefinedOr(options.model),
        O.map((model) => ({ GRAFT_MODEL: model })),
        O.getOrElse(() => ({}))
      ),
      ...pipe(
        cruxRetries,
        O.map((retries) => ({ GRAFT_CRUX_EMPTY_RETRIES: retries })),
        O.getOrElse(() => ({ GRAFT_CRUX_EMPTY_RETRIES: "2" }))
      ),
    },
    phase: "build",
    timeout: "5 hours",
  });

const siblingBuildStep = (root: string) =>
  GraftDeepRunnerStep.make({
    args: ["build"],
    command: "graft",
    cwd: root,
    phase: "rebuild",
    timeout: "15 minutes",
  });

const coverageRatio = (coverage: O.Option<GraftDeepCoverage>): O.Option<number> =>
  O.map(coverage, (value) => (Eq.equals(value.total, 0) ? 0 : value.covered / value.total));

// Absent coverage has two very different causes: a build that printed no
// coverage line, and a build whose line was cut off by the capture bound. The
// operator needs to know which before rerunning anything.
const coverageNote = (input: {
  readonly minCoverage: number;
  readonly ratio: O.Option<number>;
  readonly truncated: boolean;
}): string =>
  O.match(input.ratio, {
    onNone: () =>
      input.truncated
        ? "the build printed no readable coverage line because its output was truncated at the capture bound"
        : "the build printed no coverage line",
    onSome: (value) =>
      value < input.minCoverage
        ? `coverage is ${Num.round(value * 100, 1)}%, below the ${Num.round(input.minCoverage * 100, 1)}% target`
        : "",
  });

const refusalNote = (refusals: number): string =>
  refusals > 0 ? `${refusals} seed destination(s) were refused and nothing was seeded` : "";

const rebuildNote = (failures: number): string =>
  failures > 0 ? `${failures} sibling rebuild(s) exited non-zero` : "";

/**
 * Verdict and operator note for a run that reached its final phase.
 *
 * @param input - Coverage, the target ratio, sibling rebuild results, seed refusals, and whether the build log was truncated.
 * @returns The outcome literal plus an optional note explaining a degraded verdict.
 */
const decideOutcome = (input: {
  readonly coverage: O.Option<GraftDeepCoverage>;
  readonly minCoverage: number;
  readonly rebuilt: ReadonlyArray<GraftDeepSiblingRebuild>;
  readonly refusals: number;
  readonly truncated: boolean;
}): { readonly message: O.Option<string>; readonly outcome: GraftDeepRefreshOutcome } => {
  const ratio = coverageRatio(input.coverage);
  const belowTarget = O.getOrElse(
    O.map(ratio, (value) => value < input.minCoverage),
    () => true
  );
  const failures = A.length(A.filter(input.rebuilt, (entry) => !Eq.equals(entry.exitCode, 0)));
  const notes = A.filter(
    [
      coverageNote({ minCoverage: input.minCoverage, ratio, truncated: input.truncated }),
      refusalNote(input.refusals),
      rebuildNote(failures),
    ],
    Str.isNonEmpty
  );
  const degraded = belowTarget || input.refusals > 0 || failures > 0;
  return {
    message: A.isReadonlyArrayNonEmpty(notes) ? O.some(A.join(notes, "; ")) : O.none<string>(),
    outcome: degraded ? GraftDeepRefreshOutcome.Enum.degraded : GraftDeepRefreshOutcome.Enum.ok,
  };
};

// Only a seed that was actually applied has clones worth rebuilding.
const rebuildTargets = (
  options: GraftDeepRefreshOptions,
  seeded: O.Option<GraftCacheSyncReport>
): ReadonlyArray<string> =>
  pipe(
    seeded,
    O.filter(() => options.rebuild),
    O.map((report) => A.sort(A.dedupe(A.map(report.plan.entries, (entry) => entry.target.root)), Order.String)),
    O.getOrElse((): ReadonlyArray<string> => [])
  );

const isIntegerExit = S.is(S.Int);
const exitCodeOf = (value: number): number => (isIntegerExit(value) ? value : 1);

/**
 * The only seam through which a refresh reaches the operating system.
 *
 * **Details**
 *
 * Nonzero exit codes are returned in the captured result, matching the shared
 * step executor; only a failure to spawn, a timeout, or a wedged pipe reaches
 * the error channel.
 *
 * @category services
 * @since 0.0.0
 */
export interface GraftDeepRunnerShape {
  readonly isPidAlive: (pid: number) => Effect.Effect<boolean>;
  readonly run: (step: GraftDeepRunnerStep) => Effect.Effect<CapturedStep, GraftDeepStepError>;
}

/**
 * Service that runs the Git, Bun, Graft, and systemd commands a refresh needs.
 *
 * **Details**
 *
 * Keeping every subprocess behind one service is what lets the refresh be
 * tested without a real clone, a real Graft install, or a model budget.
 *
 * **Example** (Describe a scripted step)
 *
 * ```ts import.meta.vitest name="Describe a scripted step"
 * import { GraftDeepRunner } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * const program = GraftDeepRunner.use((runner) => runner.isPidAlive(1))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GraftDeepRunner extends Context.Service<GraftDeepRunner, GraftDeepRunnerShape>()($I`GraftDeepRunner`) {}

const makeGraftDeepRunner = Effect.fnUntraced(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const run: GraftDeepRunnerShape["run"] = Effect.fn("GraftDeepRunner.run")(function* (step) {
    return yield* runCaptured({
      args: step.args,
      bound: deepOutputBound,
      command: step.command,
      cwd: step.cwd,
      extendEnv: true,
      forceKillAfter: "30 seconds",
      // A step that is read for its value takes stdout alone: git writes
      // advisory warnings to stderr, and merging them would make
      // `status --porcelain` look dirty or corrupt a parsed revision.
      source: step.source ?? "merge",
      tee: false,
      trim: true,
      // Both fields are declared `| undefined` by the runner, so an absent
      // bound or environment is passed as the value rather than spread in.
      env: step.env,
      timeout: step.timeout,
    }).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.mapError((cause) =>
        GraftDeepStepError.make({
          cause,
          exitCode: 1,
          log: step.log ?? "",
          message: `${formatCommandLine(step.command, step.args)} could not run to completion in ${step.cwd}.`,
          step: step.phase,
        })
      )
    );
  });
  const isPidAlive: GraftDeepRunnerShape["isPidAlive"] = (pid) =>
    Effect.sync(() => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        // EPERM means the process exists and belongs to somebody else.
        return Eq.equals(
          O.getOrElse(O.fromUndefinedOr((error as { code?: string }).code), () => ""),
          "EPERM"
        );
      }
    });
  return GraftDeepRunner.of({ isPidAlive, run });
});

/**
 * Supplies the refresh runner over the platform child-process spawner.
 *
 * **Details**
 *
 * Building the layer spawns nothing; the spawner is captured so the service's
 * methods carry no remaining requirement.
 *
 * **Example** (Provide the live runner)
 *
 * ```ts import.meta.vitest name="Provide the live runner"
 * import { GraftDeepRunnerLive } from "@beep/repo-cli/commands/Graft"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(GraftDeepRunnerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GraftDeepRunnerLive: Layer.Layer<GraftDeepRunner, never, ChildProcessSpawner.ChildProcessSpawner> =
  Layer.effect(GraftDeepRunner, makeGraftDeepRunner());

/**
 * Sink that receives the status after every phase transition of a run.
 *
 * **Details**
 *
 * The default sink discards the status, so a library caller pays nothing. The
 * CLI provides a printer that renders one line per completed phase while the
 * run is still in flight.
 *
 * **Example** (Count phase transitions without printing)
 *
 * ```ts import.meta.vitest name="Count phase transitions without printing"
 * import { GraftDeepRefreshProgress } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * const program = Effect.map(GraftDeepRefreshProgress, (sink) => typeof sink)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GraftDeepRefreshProgress: Context.Reference<(status: GraftDeepRefreshStatus) => Effect.Effect<void>> =
  Context.Reference($I`GraftDeepRefreshProgress`, {
    defaultValue: (): ((status: GraftDeepRefreshStatus) => Effect.Effect<void>) => () => Effect.void,
  });

/**
 * Failures a refresh run can report to its caller.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftDeepRefreshFailure =
  | GraftDeepLockError
  | GraftDeepPreflightError
  | GraftDeepStepError
  | GraftCacheSourceError
  | GraftCacheTargetError
  | GraftCacheIoError;

/**
 * Runs, reads back, and schedules the nightly meaning-tier refresh.
 *
 * **Details**
 *
 * Every method is safe to call concurrently with a running refresh: `run`
 * fences itself with a lock file and `readStatus` only reads.
 *
 * @category services
 * @since 0.0.0
 */
export interface GraftDeepRefreshShape {
  readonly installTimer: (
    options: GraftDeepTimerOptions
  ) => Effect.Effect<ReadonlyArray<string>, GraftDeepPreflightError | GraftDeepStepError | GraftCacheIoError>;
  readonly readStatus: (stateDir: string) => Effect.Effect<O.Option<GraftDeepRefreshStatus>, GraftCacheIoError>;
  readonly run: (options: GraftDeepRefreshOptions) => Effect.Effect<GraftDeepRefreshStatus, GraftDeepRefreshFailure>;
}

/**
 * Service that refreshes the meaning tier from an owner clone nobody works in.
 *
 * **Details**
 *
 * A run pins the owner clone to `origin/main` itself, rebuilds the meaning
 * tier, seeds the siblings, and rebuilds each seeded clone structurally. Every
 * phase transition is written to `<stateDir>/status.json` atomically, so an
 * interrupted run is still readable.
 *
 * **Example** (Prepare a status read)
 *
 * ```ts import.meta.vitest name="Prepare a status read"
 * import { GraftDeepRefresh } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * const program = GraftDeepRefresh.use((refresh) => refresh.readStatus("/state/beep-graft"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GraftDeepRefresh extends Context.Service<GraftDeepRefresh, GraftDeepRefreshShape>()(
  $I`GraftDeepRefresh`
) {}

/**
 * Renders the systemd service and timer units for the nightly refresh.
 *
 * **Details**
 *
 * The service unit is returned first and the timer second. `EnvironmentFile`
 * carries no leading dash on purpose: a missing environment file must fail the
 * unit loudly instead of starting a build with no API key. The two
 * `ExecStartPre` lines update the owner clone before the CLI boots, so each
 * night runs main's current `beep graft deep refresh` rather than whatever the
 * clone held when the timer was installed. `KillMode=mixed` with
 * `TimeoutStopSec=90` sends `SIGTERM` to the CLI alone first, which `runMain`
 * turns into a fiber interrupt, leaving time to record the interrupted run.
 *
 * **Example** (Render the timer calendar line)
 *
 * ```ts import.meta.vitest name="Render the timer calendar line"
 * import { renderGraftDeepRefreshUnits } from "@beep/repo-cli/commands/Graft"
 * import { GraftDeepTimerOptions } from "@beep/repo-cli/commands/Graft"
 * import * as Str from "effect/String"
 * const units = renderGraftDeepRefreshUnits(
 *   GraftDeepTimerOptions.make({
 *     owner: "/clones/beep-effect0",
 *     bunPath: "/usr/bin/bun",
 *     onCalendar: "*-*-* 02:30:00",
 *     envFile: "/home/op/.config/beep-graft/env",
 *     uninstall: false,
 *   })
 * )
 * console.log(Str.includes("OnCalendar=*-*-* 02:30:00")(units[1]?.text ?? "")) // true
 * ```
 *
 * @param options - Owner clone, Bun path, calendar expression, and environment file.
 * @returns The service unit followed by the timer unit.
 * @category formatting
 * @since 0.0.0
 */
export const renderGraftDeepRefreshUnits = (
  options: GraftDeepTimerOptions
): ReadonlyArray<{ readonly fileName: string; readonly text: string }> => [
  {
    fileName: `${REFRESH_UNIT_BASE_NAME}.service`,
    text: A.join(
      [
        "[Unit]",
        `Description=${REFRESH_UNIT_DESCRIPTION}`,
        "",
        "[Service]",
        "Type=oneshot",
        `WorkingDirectory=${options.owner}`,
        `Environment=PATH=${REFRESH_UNIT_PATH}`,
        "Environment=CI=true",
        `EnvironmentFile=${options.envFile}`,
        // systemd splits Exec* lines on whitespace with no shell involved, so
        // every path argument is quoted. WorkingDirectory and EnvironmentFile
        // take whole lines and must stay unquoted.
        `ExecStartPre=/usr/bin/git -C "${options.owner}" pull --ff-only --quiet origin main`,
        `ExecStartPre="${options.bunPath}" install --frozen-lockfile`,
        `ExecStart="${options.bunPath}" run beep graft deep refresh --owner "${options.owner}" --jobs 16`,
        "TimeoutStartSec=8h",
        "TimeoutStopSec=90",
        "KillMode=mixed",
        "Nice=10",
        "Slice=background.slice",
        "",
      ],
      "\n"
    ),
  },
  {
    fileName: `${REFRESH_UNIT_BASE_NAME}.timer`,
    text: A.join(
      [
        "[Unit]",
        `Description=Timer for ${REFRESH_UNIT_DESCRIPTION}`,
        "",
        "[Timer]",
        `OnCalendar=${options.onCalendar}`,
        "Persistent=true",
        "RandomizedDelaySec=600",
        "",
        "[Install]",
        "WantedBy=timers.target",
        "",
      ],
      "\n"
    ),
  },
];

/**
 * Resolves the Bun the rendered unit runs when no `--bun-path` is given.
 *
 * **Details**
 *
 * Each {@link GraftDeepBunCandidate} is probed under `home` in order and the
 * first that exists wins, so a unit installed on a mise-managed workstation
 * runs whichever Bun the repo's `mise.toml` pins on the night it fires. The
 * installer's own `process.execPath` is the fallback only when no candidate
 * exists: it is one version's binary, and a unit pinned to it keeps running
 * that version after a bump, or fails outright once the version is pruned.
 *
 * **Example** (Prepare a resolution under an operator home)
 *
 * ```ts import.meta.vitest name="Prepare a resolution under an operator home"
 * import { resolveGraftDeepBunPath } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(resolveGraftDeepBunPath("/home/op"))) // true
 * ```
 *
 * @param home - The operator home directory the candidates are probed under.
 * @returns The absolute path of the Bun executable the unit should run.
 * @category formatting
 * @since 0.0.0
 */
export const resolveGraftDeepBunPath = Effect.fn("GraftDeepRefresh.resolveBunPath")(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const found = yield* Effect.findFirst(
    A.map(GraftDeepBunCandidate.Options, (candidate) => path.join(home, candidate)),
    (candidate) =>
      fs.exists(candidate).pipe(
        Effect.mapError((cause) =>
          GraftCacheIoError.make({
            path: candidate,
            message: `Failed probing ${candidate} for the Bun the refresh unit runs.`,
            cause,
          })
        )
      )
  );
  return O.getOrElse(found, () => process.execPath);
});

const statusCodec = S.fromJsonString(GraftDeepRefreshStatus);
const decodeStatusJson = S.decodeUnknownEffect(statusCodec);
const encodeStatusJson = S.encodeEffect(statusCodec);
const lockCodec = S.fromJsonString(GraftDeepLock);
const decodeLockJson = S.decodeUnknownEffect(lockCodec);
const encodeLockJson = S.encodeEffect(lockCodec);

const compactTimestamp: (iso: string) => string = flow(Str.replaceAll(/[-:]/gu, ""), Str.replace(/\.\d+Z$/u, "Z"));

const refreshFailureMessage = Match.type<GraftDeepRefreshFailure>().pipe(
  Match.tag("GraftDeepLockError", (error) => `Refresh lock ${error.path} is held by live process ${error.holderPid}.`),
  Match.tag(
    "GraftDeepPreflightError",
    "GraftCacheSourceError",
    "GraftCacheTargetError",
    "GraftCacheIoError",
    (error) => error.message
  ),
  Match.tag("GraftDeepStepError", (error) => error.message),
  Match.exhaustive
);

type StatusPatch = Partial<{
  readonly coverage: GraftDeepCoverage;
  readonly finishedAt: string;
  readonly head: string;
  readonly message: string;
  readonly outcome: GraftDeepRefreshOutcome;
  readonly phase: GraftDeepRefreshPhase;
  readonly rebuilt: ReadonlyArray<GraftDeepSiblingRebuild>;
  readonly seed: GraftCacheSyncReport;
}>;

const makeGraftDeepRefresh = Effect.fn("GraftDeepRefresh.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runner = yield* GraftDeepRunner;
  const sync = yield* GraftCacheSync;

  const ioError = (file: string) => (cause: unknown) =>
    GraftCacheIoError.make({ path: file, message: `Graft deep refresh failed at ${file}.`, cause });

  const statusPath = (stateDir: string) => path.join(stateDir, "status.json");

  const readStatus: GraftDeepRefreshShape["readStatus"] = Effect.fn("GraftDeepRefresh.readStatus")(
    function* (stateDir) {
      const file = statusPath(path.resolve(stateDir));
      if (!(yield* fs.exists(file).pipe(Effect.mapError(ioError(file))))) {
        return O.none<GraftDeepRefreshStatus>();
      }
      const text = yield* fs.readFileString(file).pipe(Effect.mapError(ioError(file)));
      return O.some(
        yield* decodeStatusJson(text).pipe(
          Effect.mapError((cause) =>
            GraftCacheIoError.make({
              path: file,
              message: `Refresh status at ${file} is not a valid ${REFRESH_STATUS_VERSION} document.`,
              cause,
            })
          )
        )
      );
    }
  );

  // Temp-and-rename so a reader never observes a half-written status, matching
  // how the cache sync replaces artifacts.
  const writeStatus = Effect.fnUntraced(function* (stateDir: string, status: GraftDeepRefreshStatus) {
    const file = statusPath(stateDir);
    const encoded = yield* encodeStatusJson(status).pipe(Effect.mapError(ioError(file)));
    const nonce = yield* Random.nextInt;
    const temporary = path.join(stateDir, `.status-${nonce}.tmp`);
    // Write beside the destination and rename, so `status` never observes a
    // half-written document while a refresh is running.
    yield* Effect.acquireUseRelease(
      fs.writeFileString(temporary, `${encoded}\n`).pipe(Effect.mapError(ioError(temporary))),
      () => fs.rename(temporary, file).pipe(Effect.mapError(ioError(file))),
      () => Effect.ignore(fs.remove(temporary, { force: true }))
    );
  });

  const acquireLock = Effect.fnUntraced(function* (stateDir: string, startedAt: string) {
    const lockPath = path.join(stateDir, "refresh.lock");
    const body = yield* encodeLockJson(GraftDeepLock.make({ pid: process.pid, startedAt })).pipe(
      Effect.mapError(ioError(lockPath))
    );
    const claim = fs.writeFileString(lockPath, `${body}\n`, { flag: "wx" });
    // Whoever holds the lock right now, not whoever held it when this run
    // started looking: a lost steal race must never report the dead pid as
    // live. The retry covers the microseconds between a winner renaming the
    // stale lock aside and writing its own.
    const holder = Effect.fnUntraced(function* () {
      const existing = yield* fs.readFileString(lockPath).pipe(Effect.flatMap(decodeLockJson));
      return existing.pid;
    });
    const holderNow = holder().pipe(
      Effect.retry({ schedule: Schedule.spaced(Dur.millis(20)), times: 10 }),
      Effect.mapError((cause) =>
        GraftDeepPreflightError.make({
          path: lockPath,
          message: `Refresh lock ${lockPath} is unreadable; remove it once no refresh is running.`,
          cause,
        })
      )
    );
    if (Result.isSuccess(yield* Effect.result(claim))) return lockPath;
    const holderPid = yield* holderNow;
    if (yield* runner.isPidAlive(holderPid)) {
      return yield* GraftDeepLockError.make({ path: lockPath, holderPid });
    }
    // The holder is gone, so the lock is a crash leftover rather than a fence.
    // Steal it by renaming it aside: renaming a missing source fails, so when
    // several runs see the same dead pid exactly one of them wins, and a loser
    // can never delete the winner's live lock.
    const nonce = yield* Random.nextInt;
    const aside = `${lockPath}.stale-${holderPid}-${nonce}`;
    const stolen = yield* Effect.result(fs.rename(lockPath, aside));
    if (Result.isFailure(stolen)) {
      return yield* GraftDeepLockError.make({ path: lockPath, holderPid: yield* holderNow, cause: stolen.failure });
    }
    const reclaimed = yield* Effect.result(claim);
    yield* Effect.ignore(fs.remove(aside, { force: true }));
    if (Result.isFailure(reclaimed)) {
      return yield* GraftDeepLockError.make({ path: lockPath, holderPid: yield* holderNow, cause: reclaimed.failure });
    }
    return lockPath;
  });

  const checkoutPreflight = Effect.fnUntraced(function* <E>(
    owner: string,
    appendLog: (text: string) => Effect.Effect<void, E>
  ) {
    const probe = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
      const captured = yield* runner
        .run(
          GraftDeepRunnerStep.make({
            args,
            command: "git",
            cwd: owner,
            phase: "preflight",
            source: "stdout",
            timeout: "2 minutes",
          })
        )
        .pipe(Effect.mapError((cause) => GraftDeepPreflightError.make({ path: owner, message: cause.message, cause })));
      yield* appendLog(`$ ${formatCommandLine("git", args)}\n${captured.output}\n`);
      if (!Eq.equals(exitCodeOf(captured.exitCode), 0)) {
        return yield* GraftDeepPreflightError.make({
          path: owner,
          message: `${formatCommandLine("git", args)} exited with ${captured.exitCode} in ${owner}.`,
        });
      }
      return captured.output;
    });
    const canonical = yield* fs
      .realPath(owner)
      .pipe(
        Effect.mapError((cause) =>
          GraftDeepPreflightError.make({ path: owner, message: `Owner clone ${owner} does not exist.`, cause })
        )
      );
    const toplevel = yield* probe(["rev-parse", "--show-toplevel"]);
    if (!Eq.equals(toplevel, canonical)) {
      return yield* GraftDeepPreflightError.make({
        path: owner,
        message: `Owner ${owner} is not a Git work tree root; its toplevel is ${toplevel}.`,
      });
    }
    const branch = yield* probe(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!Eq.equals(branch, "main")) {
      return yield* GraftDeepPreflightError.make({
        path: owner,
        message: `Owner ${owner} is on ${branch}; the refresh only runs from main.`,
      });
    }
    const porcelain = yield* probe(["status", "--porcelain"]);
    if (Str.isNonEmpty(porcelain)) {
      return yield* GraftDeepPreflightError.make({
        path: owner,
        message: `Owner ${owner} has local changes; the refresh only runs from a clean checkout.`,
      });
    }
    // The systemd user manager carries no SSH_AUTH_SOCK, so a nightly fetch
    // over an SSH remote fails with no agent to ask. The repo is public, so an
    // HTTPS remote fetches without credentials.
    const remote = yield* probe(["remote", "get-url", "origin"]);
    if (!Str.startsWith("https://")(remote)) {
      return yield* GraftDeepPreflightError.make({
        path: owner,
        message: `Owner ${owner} fetches origin over ${remote}; the systemd user manager has no SSH agent. Run "git -C ${owner} remote set-url origin https://github.com/<org>/<repo>.git" and retry.`,
      });
    }
    return canonical;
  });

  const assertGraftOnPath = Effect.fnUntraced(function* (ctx: RefreshContext) {
    const captured = yield* runner
      .run(
        GraftDeepRunnerStep.make({
          args: ["--version"],
          command: "graft",
          cwd: ctx.owner,
          phase: "preflight",
          timeout: "2 minutes",
        })
      )
      .pipe(
        Effect.mapError((cause) =>
          GraftDeepPreflightError.make({
            path: ctx.owner,
            message: `graft does not resolve on PATH for the refresh: ${cause.message}`,
            cause,
          })
        )
      );
    if (!Eq.equals(exitCodeOf(captured.exitCode), 0)) {
      return yield* GraftDeepPreflightError.make({
        path: ctx.owner,
        message: `graft --version exited with ${captured.exitCode}; the meaning tier cannot be rebuilt.`,
      });
    }
    yield* ctx.appendLog(`$ graft --version\n${captured.output}\n`);
  });

  const assertPatchKit = Effect.fnUntraced(function* (ctx: RefreshContext) {
    const patchKit = path.join(ctx.owner, "scripts", "graft", "apply-dist-patches.sh");
    const captured = yield* runner
      .run(
        GraftDeepRunnerStep.make({
          args: ["--check"],
          command: patchKit,
          cwd: ctx.owner,
          phase: "preflight",
          timeout: "5 minutes",
        })
      )
      .pipe(
        Effect.mapError((cause) => GraftDeepPreflightError.make({ path: patchKit, message: cause.message, cause }))
      );
    yield* ctx.appendLog(`$ ${formatCommandLine(patchKit, ["--check"])}\n${captured.output}\n`);
    if (!Eq.equals(exitCodeOf(captured.exitCode), 0)) {
      return yield* GraftDeepPreflightError.make({
        path: patchKit,
        message: `${patchKit} --check exited with ${captured.exitCode}; the installed Graft is missing repo patches.`,
      });
    }
  });

  const preflightPhase = Effect.fnUntraced(function* (ctx: RefreshContext) {
    yield* checkoutPreflight(ctx.owner, ctx.appendLog);
    yield* assertGraftOnPath(ctx);
    yield* assertPatchKit(ctx);
  });

  const pullPhase = Effect.fnUntraced(function* (ctx: RefreshContext) {
    const before = yield* ctx.mustSucceed(revParseHeadStep(ctx.owner));
    yield* ctx.mustSucceed(fetchStep(ctx.owner));
    yield* ctx.mustSucceed(mergeStep(ctx.owner));
    const after = yield* ctx.mustSucceed(revParseHeadStep(ctx.owner));
    const lockDiff = yield* ctx.step(lockDiffStep(ctx.owner, before.output, after.output));
    return { head: after.output, lockChanged: !Eq.equals(exitCodeOf(lockDiff.exitCode), 0) };
  });

  const installPhase = Effect.fnUntraced(function* (ctx: RefreshContext, lockChanged: boolean) {
    if (!lockChanged) return;
    yield* ctx.mustSucceed(bunInstallStep(ctx.owner));
  });

  const buildPhase = Effect.fnUntraced(function* (ctx: RefreshContext) {
    const cruxRetries = yield* Effect.orDie(Config.String("GRAFT_CRUX_EMPTY_RETRIES").pipe(Config.option));
    return yield* ctx.mustSucceed(deepBuildStep(ctx.options, cruxRetries));
  });

  const seedPhase = Effect.fnUntraced(function* (ctx: RefreshContext) {
    if (!ctx.options.seed) return { refusals: 0, seeded: O.none<GraftCacheSyncReport>() };
    const plan = yield* sync.plan(ctx.owner, yield* sync.discoverSiblings(ctx.owner));
    const refusals = A.length(A.filter(plan.entries, (entry) => GraftCacheSyncAction.is.refuse(entry.action)));
    // A refused destination fails closed in the sync service too; recording the
    // refusal and moving on keeps the nightly job from paging.
    const seeded = Eq.equals(refusals, 0) ? O.some(yield* sync.apply(plan)) : O.none<GraftCacheSyncReport>();
    return { refusals, seeded };
  });

  // A clone that times out or cannot spawn is recorded, not raised: failing
  // here would interrupt the sibling rebuilds still running and throw away
  // every result the night already earned.
  const rebuildClone = Effect.fnUntraced(function* (ctx: RefreshContext, root: string) {
    const [elapsed, attempted] = yield* Effect.timed(Effect.result(ctx.step(siblingBuildStep(root))));
    return GraftDeepSiblingRebuild.make({
      root,
      exitCode: Result.isSuccess(attempted) ? exitCodeOf(attempted.success.exitCode) : REBUILD_UNFINISHED_EXIT,
      seconds: NonNegativeInt.make(Num.round(Dur.toSeconds(elapsed), 0)),
    });
  });

  const rebuildPhase = Effect.fnUntraced(function* (ctx: RefreshContext, seeded: O.Option<GraftCacheSyncReport>) {
    return yield* Effect.forEach(rebuildTargets(ctx.options, seeded), (root) => rebuildClone(ctx, root), {
      concurrency: ctx.options.rebuildConcurrency,
    });
  });

  const run: GraftDeepRefreshShape["run"] = Effect.fn("GraftDeepRefresh.run")(function* (options) {
    const owner = path.resolve(options.owner);
    const stateDir = path.resolve(options.stateDir);
    const startedAt = DateTime.formatIso(yield* DateTime.now);
    const runsDir = path.join(stateDir, "runs");
    const logPath = path.join(runsDir, `${compactTimestamp(startedAt)}.log`);

    yield* fs.makeDirectory(runsDir, { recursive: true }).pipe(Effect.mapError(ioError(runsDir)));

    const appendLog = Effect.fnUntraced(function* (text: string) {
      yield* fs.writeFileString(logPath, text, { flag: "a" }).pipe(Effect.mapError(ioError(logPath)));
    });

    let status = GraftDeepRefreshStatus.make({
      schemaVersion: REFRESH_STATUS_VERSION,
      owner,
      model: O.getOrElse(O.fromUndefinedOr(options.model), () => "(env default)"),
      jobs: options.jobs,
      startedAt,
      phase: "preflight",
      rebuilt: [],
      log: logPath,
    });
    const commit = Effect.fnUntraced(function* (patch: StatusPatch) {
      status = GraftDeepRefreshStatus.make({ ...status, ...patch });
      yield* writeStatus(stateDir, status);
      yield* (yield* GraftDeepRefreshProgress)(status);
      return status;
    });

    const step = Effect.fnUntraced(function* (input: GraftDeepRunnerStep) {
      const captured = yield* runner.run(GraftDeepRunnerStep.make({ ...input, log: logPath }));
      yield* appendLog(`$ ${formatCommandLine(input.command, input.args)}\n${captured.output}\n`);
      return captured;
    });
    const mustSucceed = Effect.fnUntraced(function* (input: GraftDeepRunnerStep) {
      return yield* ensureZeroExit(yield* step(input), (exitCode) =>
        GraftDeepStepError.make({
          step: input.phase,
          exitCode: exitCodeOf(exitCode),
          log: logPath,
          message: `${formatCommandLine(input.command, input.args)} exited with ${exitCode} in ${input.cwd}.`,
        })
      );
    });

    const ctx: RefreshContext = { appendLog, mustSucceed, options, owner, step };
    const refresh = Effect.fnUntraced(function* () {
      yield* commit({ phase: "preflight" });
      yield* preflightPhase(ctx);

      yield* commit({ phase: "pull" });
      const pulled = yield* pullPhase(ctx);

      yield* commit({ head: pulled.head, phase: "install" });
      yield* installPhase(ctx, pulled.lockChanged);

      yield* commit({ phase: "build" });
      const build = yield* buildPhase(ctx);
      const coverage = parseDeepCoverage(build.output);

      yield* commit({
        phase: "seed",
        ...O.getOrElse(
          O.map(coverage, (value) => ({ coverage: value })),
          () => ({})
        ),
      });
      const seed = yield* seedPhase(ctx);

      yield* commit({
        phase: "rebuild",
        ...O.getOrElse(
          O.map(seed.seeded, (report) => ({ seed: report })),
          () => ({})
        ),
      });
      const rebuilt = yield* rebuildPhase(ctx, seed.seeded);

      const decided = decideOutcome({
        coverage,
        minCoverage: options.minCoverage,
        rebuilt,
        refusals: seed.refusals,
        truncated: build.truncated,
      });
      return yield* commit({
        finishedAt: DateTime.formatIso(yield* DateTime.now),
        outcome: decided.outcome,
        phase: "done",
        rebuilt,
        ...O.getOrElse(
          O.map(decided.message, (message) => ({ message })),
          () => ({})
        ),
      });
    });

    // The run is already lost; a failing status write or a missing notifier
    // must not replace the real cause.
    const notifyFailure = Effect.fnUntraced(function* (message: string) {
      yield* Effect.ignore(
        runner.run(
          GraftDeepRunnerStep.make({
            args: ["--urgency=critical", "beep graft deep refresh failed", message],
            command: "notify-send",
            cwd: stateDir,
            phase: status.phase,
            timeout: "30 seconds",
          })
        )
      );
    });
    const recordFailure = Effect.fnUntraced(function* (message: string) {
      yield* Effect.ignore(
        commit({
          finishedAt: DateTime.formatIso(yield* DateTime.now),
          message,
          outcome: GraftDeepRefreshOutcome.Enum.failed,
        })
      );
      yield* notifyFailure(message);
    });

    // `Effect.result` never sees an interruption, and systemd stops this unit
    // with SIGTERM, which `runMain` turns into a fiber interrupt. Observing the
    // exit instead is what keeps a stopped run from leaving status.json stuck
    // mid-phase with no outcome. Finalizers run uninterruptibly, so the write
    // and the notification complete, and both happen before the lock is
    // released because the release is the outer acquire's finalizer.
    const guarded = refresh().pipe(
      Effect.onExit(
        Effect.fnUntraced(function* (exit) {
          if (Exit.isSuccess(exit)) return;
          yield* recordFailure(
            Cause.hasInterrupts(exit.cause)
              ? `Refresh interrupted during ${status.phase}; the owner clone may hold a partial meaning tier.`
              : O.getOrElse(O.map(Cause.findErrorOption(exit.cause), refreshFailureMessage), () =>
                  Cause.pretty(exit.cause)
                )
          );
        })
      )
    );

    // A refused lock belongs to another run that owns status.json; recording
    // this refusal there would erase the live run's progress, so an acquisition
    // failure notifies without writing.
    return yield* Effect.acquireUseRelease(
      acquireLock(stateDir, startedAt).pipe(Effect.tapError(flow(refreshFailureMessage, notifyFailure))),
      () => guarded,
      (lockPath) => Effect.ignore(fs.remove(lockPath, { force: true }))
    );
  });

  const runSystemctl = Effect.fnUntraced(function* (args: ReadonlyArray<string>, cwd: string) {
    const captured = yield* runner.run(
      GraftDeepRunnerStep.make({
        args: ["--user", ...args],
        command: "systemctl",
        cwd,
        phase: "preflight",
        timeout: "2 minutes",
      })
    );
    return yield* ensureZeroExit(captured, (exitCode) =>
      GraftDeepStepError.make({
        step: "preflight",
        exitCode: exitCodeOf(exitCode),
        log: "",
        message: `systemctl --user ${A.join(args, " ")} exited with ${exitCode}: ${captured.output}`,
      })
    );
  });

  const installTimer: GraftDeepRefreshShape["installTimer"] = Effect.fn("GraftDeepRefresh.installTimer")(
    function* (options) {
      const home = yield* Config.String("HOME").pipe(
        Effect.mapError((cause) =>
          GraftDeepPreflightError.make({
            path: options.owner,
            message: "HOME is not set; cannot locate the systemd user unit directory.",
            cause,
          })
        )
      );
      const unitDir = path.join(home, ".config", "systemd", "user");
      const units = renderGraftDeepRefreshUnits(options);
      const unitPaths = A.map(units, (unit) => path.join(unitDir, unit.fileName));
      if (options.uninstall) {
        // Nothing installed is nothing to undo, so an absent unit is skipped
        // rather than disabled; a unit that is present and refuses to be
        // disabled or deleted is reported, because the next daemon-reload
        // would load it again and the operator would believe it was gone.
        const present = yield* Effect.filter(unitPaths, (unit) => fs.exists(unit).pipe(Effect.mapError(ioError(unit))));
        if (A.isReadonlyArrayNonEmpty(present)) {
          yield* runSystemctl(["disable", "--now", `${REFRESH_UNIT_BASE_NAME}.timer`], home);
        }
        yield* Effect.forEach(present, (unit) => fs.remove(unit).pipe(Effect.mapError(ioError(unit))));
        yield* runSystemctl(["daemon-reload"], home);
        return present;
      }
      // Stat only: the environment file holds the proxy token and is never read
      // by this process.
      yield* fs.stat(options.envFile).pipe(
        Effect.mapError((cause) =>
          GraftDeepPreflightError.make({
            path: options.envFile,
            message: `Environment file ${options.envFile} does not exist; the unit would start without an API key.`,
            cause,
          })
        )
      );
      yield* checkoutPreflight(options.owner, () => Effect.void);
      // mise owns the node shim the rendered unit resolves `graft` through, so
      // a mise that cannot answer is refused rather than assumed fine: the
      // alternative is a timer that fails silently every night.
      const trust = yield* runner
        .run(
          GraftDeepRunnerStep.make({
            args: ["trust", "--show"],
            command: "mise",
            cwd: options.owner,
            phase: "preflight",
            source: "stdout",
            timeout: "2 minutes",
          })
        )
        .pipe(
          Effect.mapError((cause) =>
            GraftDeepPreflightError.make({
              path: options.owner,
              message: `mise trust --show could not run in ${options.owner}; install mise and run "mise trust" there, because the rendered unit resolves node through the mise shims.`,
              cause,
            })
          )
        );
      if (!Eq.equals(exitCodeOf(trust.exitCode), 0)) {
        return yield* GraftDeepPreflightError.make({
          path: options.owner,
          message: `mise trust --show exited with ${trust.exitCode} in ${options.owner}; install mise and run "mise trust" there, because the rendered unit resolves node through the mise shims.`,
        });
      }
      if (A.some(Str.split("\n")(trust.output), Str.includes(": untrusted"))) {
        return yield* GraftDeepPreflightError.make({
          path: options.owner,
          message: `mise reports an untrusted config under ${options.owner}; run "mise trust" there before installing the timer.`,
        });
      }
      yield* fs.makeDirectory(unitDir, { recursive: true }).pipe(
        Effect.mapError((cause) =>
          GraftDeepPreflightError.make({
            path: unitDir,
            message: `Failed creating the systemd user unit directory ${unitDir}.`,
            cause,
          })
        )
      );
      yield* Effect.forEach(
        A.zip(units, unitPaths),
        Effect.fnUntraced(function* ([unit, unitPath]) {
          yield* fs.writeFileString(unitPath, unit.text).pipe(
            Effect.mapError((cause) =>
              GraftDeepPreflightError.make({
                path: unitPath,
                message: `Failed writing ${unit.fileName}.`,
                cause,
              })
            )
          );
        })
      );
      yield* runSystemctl(["daemon-reload"], home);
      yield* runSystemctl(["enable", "--now", `${REFRESH_UNIT_BASE_NAME}.timer`], home);
      return unitPaths;
    }
  );

  return GraftDeepRefresh.of({ installTimer, readStatus, run });
});

/**
 * Builds the refresh service over whatever runner and sync service are in context.
 *
 * **Details**
 *
 * Exposed separately from {@link GraftDeepRefreshLive} so a caller can supply
 * a scripted runner and drive a whole run without Git, Bun, or Graft installed.
 *
 * **Example** (Compose the refresh service with a chosen runner)
 *
 * ```ts import.meta.vitest name="Compose the refresh service with a chosen runner"
 * import { GraftDeepRefreshLayer, GraftDeepRunnerLive } from "@beep/repo-cli/commands/Graft"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(Layer.provide(GraftDeepRefreshLayer, GraftDeepRunnerLive))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GraftDeepRefreshLayer: Layer.Layer<
  GraftDeepRefresh,
  never,
  FileSystem.FileSystem | Path.Path | GraftDeepRunner | GraftCacheSync
> = Layer.effect(GraftDeepRefresh, makeGraftDeepRefresh());

/**
 * Supplies the refresh service over the live runner and the cache sync service.
 *
 * **Details**
 *
 * The layer captures the filesystem and path services, so only the platform
 * child-process spawner remains a requirement of the composed layer.
 *
 * **Example** (Provide the refresh implementation)
 *
 * ```ts import.meta.vitest name="Provide the refresh implementation"
 * import { GraftDeepRefreshLive } from "@beep/repo-cli/commands/Graft"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(GraftDeepRefreshLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GraftDeepRefreshLive: Layer.Layer<
  GraftDeepRefresh,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> = GraftDeepRefreshLayer.pipe(Layer.provide(Layer.mergeAll(GraftDeepRunnerLive, GraftCacheSyncLive)));
