/**
 * CLI entry points for seeding clone-local Graft meaning artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Config, Console, Effect } from "effect";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { printCommandJson } from "../../internal/cli/Json.ts";
import { GraftCacheIoError, GraftCacheTargetError, GraftDeepPreflightError } from "./Graft.errors.ts";
import {
  GraftCacheSyncAction,
  GraftCacheSyncPlan,
  GraftCacheSyncReport,
  GraftDeepRefreshOptions,
  GraftDeepRefreshStatus,
  GraftDeepTimerOptions,
} from "./Graft.schemas.ts";
import { GraftCacheSync, GraftCacheSyncLive } from "./Graft.service.ts";
import {
  GraftDeepRefresh,
  GraftDeepRefreshLive,
  GraftDeepRefreshProgress,
  resolveGraftDeepBunPath,
} from "./GraftDeep.service.ts";

const flags = {
  from: Flag.String("from").pipe(Flag.withDescription("Source clone containing graft/.cache/summaries.json")),
  to: Flag.String("to").pipe(Flag.atLeast(0), Flag.withDescription("Target clone root; repeat for multiple targets")),
  siblings: Flag.Boolean("siblings").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Discover sibling clones matching the source basename without trailing digits")
  ),
  dryRun: Flag.Boolean("dry-run").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Print the plan without writing files")
  ),
  json: Flag.Boolean("json").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Print a schema-encoded JSON plan or report")
  ),
};

const renderPlan = (plan: GraftCacheSyncPlan): string =>
  A.join(
    [
      `Graft cache source: ${plan.source}`,
      ...A.map(
        plan.entries,
        (entry) =>
          `${entry.action} ${entry.artifact} ${entry.targetPath}${O.getOrElse(
            O.map(O.fromUndefinedOr(entry.reason), (reason) => `: ${reason}`),
            () => ""
          )}`
      ),
    ],
    "\n"
  );

const renderReport = (report: GraftCacheSyncReport): string =>
  `${renderPlan(report.plan)}\nCopied: ${report.copied}; removed: ${report.removed}; skipped: ${report.skipped}; refused: ${report.refused}; bytes: ${report.bytes}`;

// JSON goes through the shared chunked stdout writer: a plain Console.log of a
// multi-target plan exceeds the 64 KiB pipe buffer and is cut off at exit.
const emit = Effect.fn("GraftCommand.emit")(function* <A, I>(
  json: boolean,
  value: A,
  schema: S.Codec<A, I>,
  lines: string
) {
  if (!json) return yield* Console.log(lines);
  const encodeError = (cause: unknown) =>
    GraftCacheIoError.make({ path: "stdout", message: "Failed to encode Graft cache sync output.", cause });
  const encoded = yield* S.encodeEffect(schema)(value).pipe(Effect.mapError(encodeError));
  yield* printCommandJson(encoded).pipe(Effect.mapError(encodeError));
});

const syncCommand = Command.make(
  "sync",
  flags,
  Effect.fn("GraftCommand.sync")(function* (options) {
    if (options.siblings === A.isReadonlyArrayNonEmpty(options.to)) {
      return yield* GraftCacheTargetError.make({
        path: options.from,
        message: "Select exactly one of --to <cloneDir> (repeatable) or --siblings.",
      });
    }
    const sync = yield* GraftCacheSync;
    const targets = options.siblings ? yield* sync.discoverSiblings(options.from) : options.to;
    const plan = yield* sync.plan(options.from, targets);
    const refused = A.some(plan.entries, (entry) => GraftCacheSyncAction.is.refuse(entry.action));
    // A refused destination fails closed: the plan is printed for the operator
    // and nothing is applied, so a mixed run never half-mutates the good clones.
    if (options.dryRun || refused) {
      yield* emit(options.json, plan, GraftCacheSyncPlan, renderPlan(plan));
    } else {
      const report = yield* sync.apply(plan);
      yield* emit(options.json, report, GraftCacheSyncReport, renderReport(report));
    }
    if (refused) {
      return yield* GraftCacheTargetError.make({
        path: plan.source,
        message: "Graft cache sync refused one or more destinations; nothing was written. See the plan.",
      });
    }
  })
).pipe(
  Command.withDescription("Seed the Graft meaning tier into other local clones"),
  Command.provide(GraftCacheSyncLive)
);

const cacheCommand = Command.make("cache", {}, () =>
  Console.log("Graft cache commands: sync --from <cloneDir> (--to <cloneDir>... | --siblings) [--dry-run] [--json]")
).pipe(Command.withDescription("Manage clone-local Graft meaning artifacts"), Command.withSubcommands([syncCommand]));

const decodeRefreshOptions = S.decodeEffect(GraftDeepRefreshOptions);

const deepFlags = {
  owner: Flag.String("owner").pipe(Flag.withDescription("Owner clone the refresh pins to main and rebuilds in")),
  model: Flag.String("model").pipe(
    Flag.optional,
    Flag.withDescription("GRAFT_MODEL for the deep build; omitted leaves the environment file in charge")
  ),
  jobs: Flag.Int("jobs").pipe(Flag.withDefault(16), Flag.withDescription("Crux-pass concurrency passed to graft -j")),
  minCoverage: Flag.Finite("min-coverage").pipe(
    Flag.withDefault(0.95),
    Flag.withDescription("Symbol coverage below which the run reports degraded instead of ok")
  ),
  seed: Flag.Boolean("seed").pipe(
    Flag.withDefault(true),
    Flag.withDescription("Seed the rebuilt meaning tier into sibling clones; --no-seed skips it")
  ),
  rebuild: Flag.Boolean("rebuild").pipe(
    Flag.withDefault(true),
    Flag.withDescription("Run a structural graft build in every seeded clone; --no-rebuild skips it")
  ),
  rebuildConcurrency: Flag.Int("rebuild-concurrency").pipe(
    Flag.withDefault(2),
    Flag.withDescription("How many sibling rebuilds run at once")
  ),
  stateDir: Flag.String("state-dir").pipe(
    Flag.optional,
    Flag.withDescription("Status, lock, and run logs directory (default ~/.local/state/beep-graft)")
  ),
  json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the schema-encoded status")),
};

const statusFlags = {
  stateDir: deepFlags.stateDir,
  json: deepFlags.json,
};

const timerFlags = {
  owner: deepFlags.owner,
  bunPath: Flag.String("bun-path").pipe(
    Flag.optional,
    Flag.withDescription(
      "Bun executable the unit runs (default: the mise shim, then ~/.bun/bin/bun, then the Bun running this command)"
    )
  ),
  onCalendar: Flag.String("on-calendar").pipe(
    Flag.withDefault("*-*-* 02:30:00"),
    Flag.withDescription("systemd OnCalendar expression for the nightly refresh")
  ),
  envFile: Flag.String("env-file").pipe(
    Flag.optional,
    Flag.withDescription("EnvironmentFile with the Graft provider keys (default ~/.config/beep-graft/env)")
  ),
  uninstall: Flag.Boolean("uninstall").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Disable and remove the refresh timer and service units")
  ),
};

// Operators type `~/...` and relative paths; systemd and the lock file need
// absolute ones, and no shell is involved to expand either.
const resolveOperatorPath = (home: string, resolve: (input: string) => string, input: string): string =>
  resolve(Str.startsWith("~/")(input) ? `${home}/${Str.slice(2)(input)}` : input);

const defaultStateDir = (home: string, path: Path.Path, configured: O.Option<string>): string =>
  resolveOperatorPath(
    home,
    path.resolve,
    O.getOrElse(configured, () => path.join(home, ".local", "state", "beep-graft"))
  );

const renderStatus = (status: GraftDeepRefreshStatus): string =>
  A.join(
    [
      `Graft deep refresh: ${status.phase}${O.getOrElse(
        O.map(O.fromUndefinedOr(status.outcome), (outcome) => ` (${outcome})`),
        () => ""
      )}`,
      `Owner: ${status.owner}${O.getOrElse(
        O.map(O.fromUndefinedOr(status.head), (head) => ` at ${head}`),
        () => ""
      )}`,
      `Model: ${status.model}; jobs: ${status.jobs}; started: ${status.startedAt}${O.getOrElse(
        O.map(O.fromUndefinedOr(status.finishedAt), (finished) => `; finished: ${finished}`),
        () => ""
      )}`,
      O.getOrElse(
        O.map(
          O.fromUndefinedOr(status.coverage),
          (coverage) =>
            `Coverage: ${coverage.covered}/${coverage.total} symbols (${coverage.total === 0 ? 0 : Num.round((coverage.covered / coverage.total) * 100, 1)}%); failed files: ${coverage.failedFiles}`
        ),
        () => "Coverage: not reported"
      ),
      O.getOrElse(
        O.map(
          O.fromUndefinedOr(status.seed),
          (seed) =>
            `Seeded: ${seed.copied} copied, ${seed.removed} removed, ${seed.skipped} skipped, ${seed.bytes} bytes`
        ),
        () => "Seeded: nothing applied"
      ),
      `Rebuilt: ${A.length(status.rebuilt)} clone(s), ${A.length(A.filter(status.rebuilt, (entry) => entry.exitCode !== 0))} failing`,
      `Log: ${status.log}`,
      ...A.map(
        A.filter([O.getOrElse(O.fromUndefinedOr(status.message), () => "")], Str.isNonEmpty),
        (message) => `Note: ${message}`
      ),
    ],
    "\n"
  );

/**
 * Runs one nightly meaning-tier refresh and renders or encodes its status.
 *
 * **Details**
 *
 * Exported so the handler can be driven under a scripted subprocess runner:
 * the command wiring only supplies flags and the live layer. `--json`
 * suppresses the per-phase lines so the encoded document is the only output.
 *
 * **Example** (Build a refresh program without running it)
 *
 * ```ts import.meta.vitest name="Build a refresh program without running it"
 * import { runDeepRefresh } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * const program = runDeepRefresh({
 *   owner: "/clones/beep-effect0",
 *   model: O.none(),
 *   jobs: 16,
 *   minCoverage: 0.95,
 *   seed: true,
 *   rebuild: true,
 *   rebuildConcurrency: 2,
 *   stateDir: O.some("/state/beep-graft"),
 *   json: false,
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Resolved `graft deep refresh` flags.
 * @returns The rendered or encoded status of the finished run.
 * @category cli-commands
 * @since 0.0.0
 */
export const runDeepRefresh = Effect.fn("GraftCommand.runDeepRefresh")(function* (options: {
  readonly owner: string;
  readonly model: O.Option<string>;
  readonly jobs: number;
  readonly minCoverage: number;
  readonly seed: boolean;
  readonly rebuild: boolean;
  readonly rebuildConcurrency: number;
  readonly stateDir: O.Option<string>;
  readonly json: boolean;
}) {
  const path = yield* Path.Path;
  const home = yield* Effect.orDie(Config.String("HOME"));
  const decoded = yield* decodeRefreshOptions({
    owner: resolveOperatorPath(home, path.resolve, options.owner),
    jobs: options.jobs,
    minCoverage: options.minCoverage,
    seed: options.seed,
    rebuild: options.rebuild,
    rebuildConcurrency: options.rebuildConcurrency,
    stateDir: defaultStateDir(home, path, options.stateDir),
    ...O.getOrElse(
      O.map(options.model, (model) => ({ model })),
      () => ({})
    ),
  }).pipe(
    Effect.mapError((cause) =>
      GraftDeepPreflightError.make({ path: options.owner, message: "Invalid refresh options.", cause })
    )
  );
  const refresh = yield* GraftDeepRefresh;
  const status = yield* refresh
    .run(decoded)
    .pipe(
      Effect.provideService(GraftDeepRefreshProgress, (phase) =>
        options.json ? Effect.void : Console.log(`graft deep refresh: ${phase.phase}`)
      )
    );
  yield* emit(options.json, status, GraftDeepRefreshStatus, renderStatus(status));
});

/**
 * Renders the recorded refresh status, or says that none was recorded.
 *
 * **Details**
 *
 * An in-flight run is readable: its status carries a phase and no outcome.
 *
 * **Example** (Build a status program without running it)
 *
 * ```ts import.meta.vitest name="Build a status program without running it"
 * import { runDeepStatus } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * const program = runDeepStatus({ stateDir: O.none(), json: true })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Resolved `graft deep status` flags.
 * @returns The rendered or encoded status, when one is recorded.
 * @category cli-commands
 * @since 0.0.0
 */
export const runDeepStatus = Effect.fn("GraftCommand.runDeepStatus")(function* (options: {
  readonly stateDir: O.Option<string>;
  readonly json: boolean;
}) {
  const path = yield* Path.Path;
  const home = yield* Effect.orDie(Config.String("HOME"));
  const stateDir = defaultStateDir(home, path, options.stateDir);
  const refresh = yield* GraftDeepRefresh;
  const status = yield* refresh.readStatus(stateDir);
  if (O.isNone(status)) {
    return yield* Console.log(`No refresh recorded under ${stateDir}.`);
  }
  yield* emit(options.json, status.value, GraftDeepRefreshStatus, renderStatus(status.value));
});

/**
 * Installs or removes the nightly refresh systemd user timer.
 *
 * **Details**
 *
 * The installer stats the environment file and refuses a missing one; an
 * uninstall reports only the unit files it actually removed. Without
 * `--bun-path` the unit runs the mise Bun shim when the home directory has
 * one, then a standalone `$HOME/.bun` install, and only then the Bun running
 * this command, so a `mise.toml` bump is picked up the next night.
 *
 * **Example** (Build an install program without running it)
 *
 * ```ts import.meta.vitest name="Build an install program without running it"
 * import { runDeepInstallTimer } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * const program = runDeepInstallTimer({
 *   owner: "/clones/beep-effect0",
 *   bunPath: O.none(),
 *   onCalendar: "*-*-* 02:30:00",
 *   envFile: O.none(),
 *   uninstall: false,
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Resolved `graft deep install-timer` flags.
 * @returns Nothing; the written or removed unit paths are printed.
 * @category cli-commands
 * @since 0.0.0
 */
export const runDeepInstallTimer = Effect.fn("GraftCommand.runDeepInstallTimer")(function* (options: {
  readonly owner: string;
  readonly bunPath: O.Option<string>;
  readonly onCalendar: string;
  readonly envFile: O.Option<string>;
  readonly uninstall: boolean;
}) {
  const path = yield* Path.Path;
  const home = yield* Effect.orDie(Config.String("HOME"));
  const refresh = yield* GraftDeepRefresh;
  // An explicit path is the operator's pin and is only made absolute; the
  // default follows the mise shim so a Bun bump never strands the unit.
  const bunPath = yield* O.match(options.bunPath, {
    onNone: () => resolveGraftDeepBunPath(home),
    onSome: (given) => Effect.succeed(resolveOperatorPath(home, path.resolve, given)),
  });
  const units = yield* refresh.installTimer(
    GraftDeepTimerOptions.make({
      owner: resolveOperatorPath(home, path.resolve, options.owner),
      bunPath,
      onCalendar: options.onCalendar,
      envFile: resolveOperatorPath(
        home,
        path.resolve,
        O.getOrElse(options.envFile, () => path.join(home, ".config", "beep-graft", "env"))
      ),
      uninstall: options.uninstall,
    })
  );
  const headline = options.uninstall ? "graft deep install-timer: removed" : "graft deep install-timer: wrote";
  yield* Console.log(
    A.isReadonlyArrayNonEmpty(units)
      ? A.join(A.prepend(units, headline), "\n")
      : "graft deep install-timer: no unit files were installed"
  );
});

const deepRefreshCommand = Command.make("refresh", deepFlags, runDeepRefresh).pipe(
  Command.withDescription("Rebuild the meaning tier in the owner clone, then seed and rebuild the siblings"),
  Command.provide(GraftDeepRefreshLive)
);

const deepStatusCommand = Command.make("status", statusFlags, runDeepStatus).pipe(
  Command.withDescription("Render the most recent refresh status, including an in-flight run"),
  Command.provide(GraftDeepRefreshLive)
);

const deepInstallTimerCommand = Command.make("install-timer", timerFlags, runDeepInstallTimer).pipe(
  Command.withDescription("Install or remove the nightly refresh systemd user timer"),
  Command.provide(GraftDeepRefreshLive)
);

const deepCommand = Command.make("deep", {}, () =>
  Console.log("Graft deep commands: refresh --owner <cloneDir>, status, install-timer --owner <cloneDir>")
).pipe(
  Command.withDescription("Operator-only meaning-tier refresh; refresh spends model quota through graft build --deep"),
  Command.withSubcommands([deepRefreshCommand, deepStatusCommand, deepInstallTimerCommand])
);

/**
 * Registers `beep graft cache sync` for local meaning-tier seeding.
 *
 * **Details**
 *
 * JSON output precedes failure on refused targets, and a refused plan is never
 * applied. Dry runs never create directories or files.
 *
 * **Example** (Inspect the command identity)
 *
 * ```ts import.meta.vitest name="Inspect the command identity"
 * import { graftCommand } from "@beep/repo-cli/commands/Graft"
 * graftCommand.name // => "graft"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const graftCommand = Command.make("graft", {}, () =>
  Console.log("Graft commands: cache sync; deep refresh|status|install-timer")
).pipe(
  Command.withDescription("Repo-owned operations on clone-local Graft caches"),
  Command.withSubcommands([cacheCommand, deepCommand])
);
