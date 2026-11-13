/**
 * `beep github ledger`: sample, calibrate, report and inspect the GitHub
 * budget ledger, and install its sampler timer.
 *
 * **Details**
 *
 * The ledger and sampler are bound by the CLI root; with the ledger off (CI,
 * or `BEEP_GITHUB_LEDGER=off`) every subcommand except the timer ones says so
 * and exits 0.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolveOperatorPath, resolveUnitBunPath } from "@beep/repo-cli-kit/systemd/index";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  LedgerHourResult,
  LedgerRange,
  ReserveState,
  SampleOutcome,
} from "../../internal/github/GithubLedger.schemas.ts";
import { GithubBudgetLedger } from "../../internal/github/GithubLedger.service.ts";
import { GithubCalibrationOptions, GithubRateLimitSampler } from "../../internal/github/GithubRateLimitSampler.ts";
import { GithubCommandError } from "./Github.errors.ts";
import {
  GITHUB_LEDGER_TIMER_CALENDAR,
  GITHUB_LEDGER_TIMER_UNIT,
  GithubLedgerTimerOptions,
  installGithubLedgerTimer,
  uninstallGithubLedgerTimer,
} from "./GithubLedger.timer.ts";
import type { CalibrationRow, ReserveSignal } from "../../internal/github/GithubLedger.schemas.ts";

const LEDGER_OFF = "github ledger: off (CI or BEEP_GITHUB_LEDGER=off); nothing to do.";
const CALIBRATION_SPACING = Duration.seconds(10);
const SINCE_PATTERN = /^(\d+)h$/;

/**
 * One line per sampling outcome.
 *
 * **Example** (Render a skipped outcome)
 *
 * ```ts
 * import { renderGithubSampleOutcome } from "@beep/repo-cli/commands/Github"
 * import { GithubIdentityLabel, SampleOutcome } from "@beep/repo-cli/test/SharedInternals"
 *
 * const outcome = SampleOutcome.cases.Skipped.make({ identity: GithubIdentityLabel.make("user:octocat"), reason: "not-due" })
 * console.log(renderGithubSampleOutcome(outcome)) // "skipped user:octocat (not-due)"
 * ```
 *
 * @param outcome - What one sampling attempt did.
 * @returns The line.
 * @category utilities
 * @since 0.0.0
 */
export const renderGithubSampleOutcome = (outcome: SampleOutcome): string =>
  SampleOutcome.match(outcome, {
    Sampled: ({ identity, selfCost }) => `sampled ${identity} (${selfCost})`,
    Skipped: ({ identity, reason }) => `skipped ${identity} (${reason})`,
    Failed: ({ entry, identity, detail }) => `failed ${O.getOrElse(identity, () => entry)}: ${detail}`,
  });

const renderNumber = (value: number | O.Option<number>): string =>
  P.isNumber(value) ? `${value}` : O.match(value, { onNone: () => "none", onSome: (value) => `${value}` });

/**
 * One line per bucket of an hourly rollup.
 *
 * **Example** (Render an empty hour)
 *
 * ```ts
 * import { renderGithubLedgerHour } from "@beep/repo-cli/commands/Github"
 * import { HostLabel, rollupOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const rollup = rollupOf({ hour: DateTime.makeUnsafe(0), host: HostLabel.make("hub"), complete: true, rows: [], admitGraphqlSamples: () => false })
 * console.log(renderGithubLedgerHour(rollup)) // ["1970-01-01T00 hub: no buckets"]
 * ```
 *
 * @param rollup - One hour of one host's ledger.
 * @returns The lines.
 * @category utilities
 * @since 0.0.0
 */
export const renderGithubLedgerHour = (rollup: LedgerHourResult): ReadonlyArray<string> => {
  const hour = rollup.hour.pipe(DateTime.formatIso, Str.slice(0, 13));
  const flag =
    rollup.schemaVersion !== "github-ledger-rollup/v3"
      ? " (legacy-unrecomputable)"
      : rollup.complete
        ? ""
        : " (incomplete)";
  const line = (key: LedgerHourResult["keys"][number]) =>
    `${hour} ${key.key.identity} ${key.key.resource}${flag}${key.lanesInferred ? " (inferred lanes)" : ""}: fleetUsed=${renderNumber(key.fleetUsed)}${
      key.fleetUsedIsLowerBound ? "+" : ""
    } estimated=${key.estimatedPoints === null ? "unknown" : key.estimatedPoints} gh=${renderNumber(key.ghEstimated)} unattributed=${renderNumber(key.unattributed)}${
      key.overAttributed ? " over-attributed" : ""
    } commands=${A.join(
      A.map(
        key.byCommand,
        (spend) => `${spend.command}:${spend.estimatedPoints === null ? "unknown" : spend.estimatedPoints}`
      ),
      ","
    )}`;
  const keys: ReadonlyArray<LedgerHourResult["keys"][number]> = rollup.keys;
  const lines = A.map(keys, line);
  return A.isReadonlyArrayNonEmpty(lines) ? lines : A.of(`${hour} ${rollup.host}${flag}: no buckets`);
};

const renderReserve = (signal: ReserveSignal): string =>
  `${signal.key.identity} ${signal.key.resource}: ${ReserveState.match(signal.state, {
    Clear: ({ remaining, limit, basis }) => `clear ${remaining}/${limit} (${basis})`,
    Below: ({ remaining, limit, floor, basis }) => `below reserve ${remaining}/${limit}, floor ${floor} (${basis})`,
    Unknown: ({ reason }) => `unknown (${reason})`,
  })}`;

const renderCalibration = (row: CalibrationRow): string =>
  `calibrated ${row.identity}: rest used=${row.restUsed} graphql used=${row.graphqlUsed} drift=${Math.abs(
    row.restUsed - row.graphqlUsed
  )} cost=${row.graphqlCost} span=${row.spanMillis}ms`;

const printLines = (lines: ReadonlyArray<string>) =>
  Effect.forEach(lines, (line) => Console.log(line), { discard: true });

const pruneQuietly = (ledger: GithubBudgetLedger["Service"]) =>
  ledger.prune.pipe(Effect.catch((error) => Effect.logWarning(`github ledger: prune failed: ${error.detail}`)));

const withLedger = <A, E, R>(
  use: (ledger: GithubBudgetLedger["Service"]) => Effect.Effect<A, E, R>
): Effect.Effect<A | void, E, R> =>
  Effect.flatMap(
    Effect.serviceOption(GithubBudgetLedger),
    O.match({ onNone: () => Console.log(LEDGER_OFF), onSome: use })
  );

const sampleCommand = Command.make(
  "sample",
  {
    timer: Flag.Boolean("timer").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Record the samples as taken by the systemd timer")
    ),
  },
  Effect.fn("GithubLedger.sample")(function* ({ timer }) {
    const sampler = yield* Effect.serviceOption(GithubRateLimitSampler);
    if (O.isNone(sampler)) return yield* Console.log(LEDGER_OFF);
    const outcomes = yield* sampler.value.sampleAll(timer ? "timer" : "manual");
    yield* printLines(A.map(outcomes, renderGithubSampleOutcome));
    yield* withLedger(pruneQuietly);
  })
).pipe(Command.withDescription("Sample GET /rate_limit (free) for every configured non-App identity"));

const calibrateCommand = Command.make(
  "calibrate",
  {
    pairs: Flag.Int("pairs").pipe(
      Flag.withDefault(6),
      Flag.withDescription("How many REST/GraphQL pairs to read, 10 s apart; each costs one GraphQL point")
    ),
  },
  Effect.fn("GithubLedger.calibrate")(function* ({ pairs }) {
    const sampler = yield* Effect.serviceOption(GithubRateLimitSampler);
    if (O.isNone(sampler)) return yield* Console.log(LEDGER_OFF);
    const rows = yield* sampler.value.calibrate(GithubCalibrationOptions.make({ pairs, spacing: CALIBRATION_SPACING }));
    yield* printLines(A.map(rows, renderCalibration));
  })
).pipe(Command.withDescription("Compare REST /rate_limit's graphql bucket with GraphQL rateLimit for the gh login"));

const LedgerHourRollupsJson = LedgerHourResult.pipe(S.Array, S.fromJsonString);

const parseSince = (since: string) =>
  pipe(
    Str.match(SINCE_PATTERN)(Str.trim(since)),
    O.flatMap(A.get(1)),
    O.map(Number),
    O.filter((hours) => hours > 0)
  );

const reportCommand = Command.make(
  "report",
  {
    since: Flag.String("since").pipe(
      Flag.withDefault("24h"),
      Flag.withDescription("How far back, in hours (e.g. 24h)")
    ),
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the hourly rollups as JSON")),
  },
  Effect.fn("GithubLedger.report")(function* ({ since, json }) {
    const hours = yield* Effect.fromOption(parseSince(since), () =>
      GithubCommandError.make({
        path: "--since",
        message: `--since takes a whole number of hours such as 24h, not "${since}".`,
      })
    );
    yield* withLedger(
      Effect.fnUntraced(function* (ledger) {
        yield* pruneQuietly(ledger);
        const now = yield* DateTime.now;
        const rollups = yield* ledger.hours(LedgerRange.make({ from: DateTime.subtract(now, { hours }), to: now }));
        if (json) {
          const text = yield* S.encodeEffect(LedgerHourRollupsJson)(rollups).pipe(
            Effect.mapError((cause) =>
              GithubCommandError.make({ path: "report", message: "Cannot encode the report.", cause })
            )
          );
          return yield* Console.log(text);
        }
        yield* printLines(A.flatMap(rollups, renderGithubLedgerHour));
      })
    );
  })
).pipe(Command.withDescription("Hourly fleet usage, estimated points, gh estimates and unattributed spend per bucket"));

const showCommand = Command.make(
  "show",
  {},
  Effect.fn("GithubLedger.show")(function* () {
    yield* withLedger(
      Effect.fnUntraced(function* (ledger) {
        const reserves = yield* ledger.reserves;
        yield* A.isReadonlyArrayNonEmpty(reserves)
          ? printLines(A.map(reserves, renderReserve))
          : Console.log("github ledger: no readings yet.");
        const summary = yield* ledger.summary;
        yield* O.match(summary, {
          onNone: () => Console.log("github ledger: no summary yet (run `beep github ledger sample`)."),
          onSome: (value) => Console.log(`github ledger: summary generated ${DateTime.formatIso(value.generatedAt)}`),
        });
      })
    );
  })
).pipe(Command.withDescription("The reserve state of every known bucket and the summary's age"));

const readHome = Config.String("HOME").pipe(
  Effect.mapError((cause) =>
    GithubCommandError.make({
      path: "HOME",
      message: "HOME is not set; cannot locate the systemd user directory.",
      cause,
    })
  )
);

const installTimerCommand = Command.make(
  "install-timer",
  {
    repoRoot: Flag.String("repo-root").pipe(
      Flag.optional,
      Flag.withDescription("The clone the timer runs from (default: the current directory)")
    ),
    bunPath: Flag.String("bun-path").pipe(Flag.optional, Flag.withDescription("Pin the Bun executable the unit runs")),
  },
  Effect.fn("GithubLedger.installTimer")(function* ({ repoRoot, bunPath }) {
    const home = yield* readHome;
    const path = yield* Path.Path;
    const bun = yield* resolveUnitBunPath({ home, pinned: bunPath });
    const root = O.match(repoRoot, {
      onNone: () => path.resolve("."),
      onSome: (given) => resolveOperatorPath(given, home, path.resolve),
    });
    const written = yield* installGithubLedgerTimer(
      home,
      GithubLedgerTimerOptions.make({ repoRoot: root, bunPath: bun })
    );
    yield* printLines(A.map(written, (file) => `wrote ${file}`));
    yield* Console.log(`enabled ${GITHUB_LEDGER_TIMER_UNIT}.timer (${GITHUB_LEDGER_TIMER_CALENDAR}).`);
  })
).pipe(Command.withDescription("Install and enable the 5-minute /rate_limit sampler systemd user timer"));

const uninstallTimerCommand = Command.make(
  "uninstall-timer",
  {},
  Effect.fn("GithubLedger.uninstallTimer")(function* () {
    const home = yield* readHome;
    yield* uninstallGithubLedgerTimer(home);
    yield* Console.log(`removed ${GITHUB_LEDGER_TIMER_UNIT}.timer.`);
  })
).pipe(Command.withDescription("Disable and remove the /rate_limit sampler timer"));

/**
 * The `github ledger` command group.
 *
 * **Example** (Inspect the group)
 *
 * ```ts
 * import { githubLedgerCommand } from "@beep/repo-cli/commands/Github"
 *
 * console.log(githubLedgerCommand.name) // "ledger"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const githubLedgerCommand = Command.make("ledger", {}, () =>
  Console.log("github ledger commands: sample, calibrate, report, show, install-timer, uninstall-timer")
).pipe(
  Command.withDescription("The GitHub budget ledger: what each identity's GitHub buckets spend, and on what"),
  Command.withSubcommands([
    sampleCommand,
    calibrateCommand,
    reportCommand,
    showCommand,
    installTimerCommand,
    uninstallTimerCommand,
  ])
);
