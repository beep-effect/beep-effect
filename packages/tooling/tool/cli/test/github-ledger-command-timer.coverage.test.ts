import {
  GITHUB_LEDGER_TIMER_UNIT,
  GithubCommandError,
  GithubLedgerTimerOptions,
  githubLedgerCommand,
  installGithubLedgerTimer,
  renderGithubLedgerHour,
  renderGithubLedgerTimerUnits,
  uninstallGithubLedgerTimer,
} from "@beep/repo-cli/commands/Github";
import {
  BucketKey,
  CommandSpend,
  GithubBudgetLedger,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  GithubLedgerRow,
  GithubRateLimitSampler,
  HostLabel,
  LedgerHourKey,
  LedgerHourRollup,
  LedgerSummary,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreMemory,
  ReserveSignal,
  ReserveState,
  SampleOutcome,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertInclude, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";
import { scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";
import type { GithubCalibrationOptions, SampleTrigger } from "@beep/repo-cli/test/SharedInternals";

const host = HostLabel.make("hub");
const alice = GithubIdentityLabel.make("user:alice");
const at = DateTime.makeUnsafe("2026-11-10T05:15:00Z");
const hour = DateTime.makeUnsafe("2026-11-10T05:00:00Z");

const runLedger = Command.runWith(githubLedgerCommand, { version: "0.0.0" });

// The repo's command-test platform: native file system, path, crypto and process services.
const platformLayer = NodeCommandTestLayer;

const ledgerLayer = () => layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreMemory));

const unitDirOf = (path: Path.Path, home: string) => path.join(home, ".config", "systemd", "user");

const systemctlOk = {
  "systemctl --user daemon-reload": { stdout: "" },
  [`systemctl --user enable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer`]: { stdout: "" },
  [`systemctl --user disable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer`]: { stdout: "" },
} as const;

// Run with Console.log captured line by line, HOME bound through the config provider and every
// child process answered by `spawner`; a spawn never reaches the host.
const captured = Effect.fnUntraced(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: {
    readonly env: Readonly<Record<string, string>>;
    readonly spawner?: ChildProcessSpawner.ChildProcessSpawner["Service"];
  }
) {
  const current = yield* Console.Console;
  const lines: Array<string> = [];
  const exit = yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        lines.push(A.join(A.map(values, String), " "));
      },
    }),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, options.spawner ?? scriptedSpawner({}).spawner),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: options.env })),
    Effect.exit
  );
  return { exit, lines } as const;
});

const reserveSignal = (state: ReserveState) =>
  ReserveSignal.make({ key: BucketKey.make({ identity: alice, resource: "core" }), state });

const hourKey = (options: {
  readonly fleetUsed: O.Option<number>;
  readonly lowerBound: boolean;
  readonly unattributed: O.Option<number>;
  readonly overAttributed: boolean;
  readonly byCommand: ReadonlyArray<CommandSpend>;
}) =>
  LedgerHourKey.make({
    key: BucketKey.make({ identity: alice, resource: "graphql" }),
    fleetUsed: options.fleetUsed,
    fleetUsedIsLowerBound: options.lowerBound,
    anchor: "sample",
    attributedNominal: 3,
    estimatedPoints: 7,
    ghSpawns: 1,
    ghEstimated: 2,
    unattributed: options.unattributed,
    overAttributed: options.overAttributed,
    byCommand: options.byCommand,
  });

const spend = (command: string, estimatedPoints: number) =>
  CommandSpend.make({
    command: GithubLedgerCommandLabel.make(command),
    requests: 1,
    nominal: 1,
    estimatedPoints,
    ghSpawns: 0,
  });

const rollup = (keys: ReadonlyArray<LedgerHourKey>, complete = true) =>
  LedgerHourRollup.make({
    schemaVersion: "github-ledger-rollup/v1",
    hour,
    host,
    complete,
    cells: [],
    keys,
    operationCosts: [],
    windows: [],
  });

const calibrationRow = GithubLedgerRow.cases.Calibration.make({
  at,
  host,
  identity: alice,
  restUsed: 12,
  restRemaining: 4988,
  restResetAt: at,
  graphqlUsed: 9,
  graphqlRemaining: 4991,
  graphqlResetAt: at,
  graphqlCost: 1,
  spanMillis: 40,
});

const ledgerFailure = GithubLedgerError.make({ reason: "write", detail: "disk full" });

// A sampler that records what each command asked of it.
const fakeSampler = () => {
  const triggers: Array<SampleTrigger> = [];
  const calibrations: Array<GithubCalibrationOptions> = [];
  const sampler = GithubRateLimitSampler.of({
    sampleAll: Effect.fnUntraced(function* (trigger: SampleTrigger) {
      triggers.push(trigger);
      return [
        SampleOutcome.cases.Sampled.make({ identity: alice, at, selfCost: "unconfirmed" }),
        SampleOutcome.cases.Failed.make({ entry: "GhCli", identity: O.some(alice), detail: "http 502" }),
        SampleOutcome.cases.Skipped.make({ identity: alice, reason: "not-due" }),
        SampleOutcome.cases.Failed.make({ entry: "OpRef", identity: O.none(), detail: "op read failed" }),
      ];
    }),
    calibrate: Effect.fnUntraced(function* (options: GithubCalibrationOptions) {
      calibrations.push(options);
      return [calibrationRow];
    }),
    sampleIfDue: Effect.fnUntraced(function* () {
      return yield* Effect.die("sampleIfDue is not driven by the ledger command");
    }),
  });
  return { sampler, triggers, calibrations };
};

// The memory ledger with selected members replaced.
const overriddenLedger = (overrides: Partial<GithubBudgetLedger["Service"]>) =>
  GithubBudgetLedger.use((ledger) => Effect.succeed(GithubBudgetLedger.of({ ...ledger, ...overrides })));

describe("github ledger commands with the ledger off", () => {
  it.layer(platformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("prints the group's subcommands when run bare", () =>
      Effect.gen(function* () {
        const { exit, lines } = yield* captured(runLedger([]), { env: {} });
        assertTrue(exit._tag === "Success");
        expect(lines).toStrictEqual([
          "github ledger commands: sample, calibrate, report, show, install-timer, uninstall-timer",
        ]);
      })
    );

    it.effect("says the ledger is off for every data subcommand", () =>
      Effect.gen(function* () {
        for (const argv of [["sample"], ["calibrate"], ["report"], ["show"]]) {
          const { exit, lines } = yield* captured(runLedger(argv), { env: {} });
          assertTrue(exit._tag === "Success");
          expect(lines).toStrictEqual(["github ledger: off (CI or BEEP_GITHUB_LEDGER=off); nothing to do."]);
        }
      })
    );

    it.effect("samples with a sampler bound but no ledger, skipping the prune", () =>
      Effect.gen(function* () {
        const { sampler, triggers } = fakeSampler();
        const { exit, lines } = yield* captured(
          runLedger(["sample"]).pipe(Effect.provideService(GithubRateLimitSampler, sampler)),
          { env: {} }
        );
        assertTrue(exit._tag === "Success");
        expect(triggers).toStrictEqual(["manual"]);
        expect(lines).toStrictEqual([
          "sampled user:alice (unconfirmed)",
          "failed user:alice: http 502",
          "skipped user:alice (not-due)",
          "failed OpRef: op read failed",
          "github ledger: off (CI or BEEP_GITHUB_LEDGER=off); nothing to do.",
        ]);
      })
    );

    it.effect("rejects a --since that is not a whole number of hours before reading the ledger", () =>
      Effect.gen(function* () {
        for (const since of ["0h", "24", "1.5h", "h"]) {
          const { exit, lines } = yield* captured(runLedger(["report", "--since", since]), { env: {} });
          assertTrue(exit._tag === "Failure");
          assertInclude(String(exit.cause), `--since takes a whole number of hours such as 24h, not "${since}".`);
          expect(lines).toStrictEqual([]);
        }
      })
    );
  });
});

describe("github ledger commands with the ledger bound", () => {
  it.layer(platformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("samples as the timer and prunes the ledger, surviving a failed prune", () =>
      Effect.gen(function* () {
        const { sampler, triggers } = fakeSampler();
        let prunes = 0;
        const ledger = yield* overriddenLedger({
          prune: Effect.suspend(() => {
            prunes += 1;
            return Effect.fail(ledgerFailure);
          }),
        });
        const { exit, lines } = yield* captured(
          runLedger(["sample", "--timer"]).pipe(
            Effect.provideService(GithubRateLimitSampler, sampler),
            Effect.provideService(GithubBudgetLedger, ledger)
          ),
          { env: {} }
        );
        assertTrue(exit._tag === "Success");
        expect(triggers).toStrictEqual(["timer"]);
        expect(prunes).toBe(1);
        expect(A.take(lines, 4)).toStrictEqual([
          "sampled user:alice (unconfirmed)",
          "failed user:alice: http 502",
          "skipped user:alice (not-due)",
          "failed OpRef: op read failed",
        ]);
        // The failed prune is a warning on the log, not a command failure.
        expect(lines).toHaveLength(5);
        assertInclude(lines[4], "WARN");
        assertInclude(lines[4], "github ledger: prune failed: disk full");
      }).pipe(withLayer(ledgerLayer()))
    );

    it.effect("calibrates the requested pairs 10 s apart and prints the drift", () =>
      Effect.gen(function* () {
        const { sampler, calibrations } = fakeSampler();
        const { exit, lines } = yield* captured(
          runLedger(["calibrate", "--pairs", "2"]).pipe(Effect.provideService(GithubRateLimitSampler, sampler)),
          { env: {} }
        );
        assertTrue(exit._tag === "Success");
        expect(A.map(calibrations, (options) => [options.pairs, Duration.toMillis(options.spacing)])).toStrictEqual([
          [2, 10_000],
        ]);
        expect(lines).toStrictEqual(["calibrated user:alice: rest used=12 graphql used=9 drift=3 cost=1 span=40ms"]);
      })
    );

    it.effect("reports each hour's buckets over the requested window", () =>
      Effect.gen(function* () {
        const ranges: Array<number> = [];
        const ledger = yield* overriddenLedger({
          hours: (range) =>
            Effect.sync(() => {
              ranges.push(DateTime.toEpochMillis(range.to) - DateTime.toEpochMillis(range.from));
              return [
                rollup([
                  hourKey({
                    fleetUsed: O.some(10),
                    lowerBound: true,
                    unattributed: O.some(1),
                    overAttributed: true,
                    byCommand: [spend("yeet ready", 4), spend("beep", 3)],
                  }),
                ]),
                rollup(
                  [
                    hourKey({
                      fleetUsed: O.none(),
                      lowerBound: false,
                      unattributed: O.none(),
                      overAttributed: false,
                      byCommand: [],
                    }),
                  ],
                  false
                ),
                rollup([]),
              ];
            }),
        });
        const { exit, lines } = yield* captured(
          runLedger(["report", "--since", " 3h "]).pipe(Effect.provideService(GithubBudgetLedger, ledger)),
          { env: {} }
        );
        assertTrue(exit._tag === "Success");
        expect(ranges).toStrictEqual([3 * 3_600_000]);
        expect(lines).toStrictEqual([
          "2026-11-10T05 user:alice graphql: fleetUsed=10+ estimated=7 gh=2 unattributed=1 over-attributed commands=yeet ready:4,beep:3",
          "2026-11-10T05 user:alice graphql (incomplete): fleetUsed=none estimated=7 gh=2 unattributed=none commands=",
          "2026-11-10T05 hub: no buckets",
        ]);
      }).pipe(withLayer(ledgerLayer()))
    );

    it.effect("reports the rollups as JSON that decodes back to the same hours", () =>
      Effect.gen(function* () {
        const rollups = [
          rollup([
            hourKey({
              fleetUsed: O.some(10),
              lowerBound: false,
              unattributed: O.some(0),
              overAttributed: false,
              byCommand: [spend("beep", 1)],
            }),
          ]),
        ];
        const ledger = yield* overriddenLedger({ hours: () => Effect.succeed(rollups) });
        const { exit, lines } = yield* captured(
          runLedger(["report", "--json"]).pipe(Effect.provideService(GithubBudgetLedger, ledger)),
          { env: {} }
        );
        assertTrue(exit._tag === "Success");
        expect(lines).toHaveLength(1);
        const decoded = yield* S.decodeUnknownEffect(RollupsJson)(lines[0]);
        expect(A.map(decoded, renderGithubLedgerHour)).toStrictEqual(A.map(rollups, renderGithubLedgerHour));
      }).pipe(withLayer(ledgerLayer()))
    );

    it.effect("fails typed when a rollup cannot be encoded", () =>
      Effect.gen(function* () {
        // A host label that breaks HostLabel's pattern only surfaces at encode time.
        const malformed = LedgerHourRollup.make(
          {
            schemaVersion: "github-ledger-rollup/v1",
            hour,
            host: "Not A Host" as HostLabel,
            complete: true,
            cells: [],
            keys: [],
            operationCosts: [],
            windows: [],
          },
          { disableChecks: true }
        );
        const ledger = yield* overriddenLedger({ hours: () => Effect.succeed([malformed]) });
        const { exit, lines } = yield* captured(
          runLedger(["report", "--json"]).pipe(Effect.provideService(GithubBudgetLedger, ledger)),
          { env: {} }
        );
        assertTrue(exit._tag === "Failure");
        assertInclude(String(exit.cause), "Cannot encode the report.");
        expect(lines).toStrictEqual([]);
      }).pipe(withLayer(ledgerLayer()))
    );

    it.effect("shows every reserve state and the summary's age", () =>
      Effect.gen(function* () {
        const ledger = yield* overriddenLedger({
          reserves: Effect.succeed([
            reserveSignal(
              ReserveState.cases.Clear.make({
                remaining: 4000,
                limit: 5000,
                floor: 500,
                resetAt: at,
                asOf: at,
                basis: "sample",
              })
            ),
            reserveSignal(
              ReserveState.cases.Below.make({
                remaining: 100,
                limit: 5000,
                floor: 500,
                resetAt: at,
                asOf: at,
                basis: "transport",
              })
            ),
            reserveSignal(ReserveState.cases.Unknown.make({ reason: "stale", asOf: O.none() })),
          ]),
          summary: Effect.succeedSome(
            LedgerSummary.make({
              schemaVersion: "github-ledger-summary/v1",
              generatedAt: at,
              spenders: [],
              unattributedLastHour: [],
              lastRowAt: O.none(),
            })
          ),
        });
        const { exit, lines } = yield* captured(
          runLedger(["show"]).pipe(Effect.provideService(GithubBudgetLedger, ledger)),
          { env: {} }
        );
        assertTrue(exit._tag === "Success");
        expect(lines).toStrictEqual([
          "user:alice core: clear 4000/5000 (sample)",
          "user:alice core: below reserve 100/5000, floor 500 (transport)",
          "user:alice core: unknown (stale)",
          "github ledger: summary generated 2026-11-10T05:15:00.000Z",
        ]);
      }).pipe(withLayer(ledgerLayer()))
    );

    it.effect("shows an empty ledger as having no readings and no summary", () =>
      Effect.gen(function* () {
        const { exit, lines } = yield* captured(runLedger(["show"]), { env: {} });
        assertTrue(exit._tag === "Success");
        expect(lines).toStrictEqual([
          "github ledger: no readings yet.",
          "github ledger: no summary yet (run `beep github ledger sample`).",
        ]);
      }).pipe(withLayer(ledgerLayer()))
    );
  });
});

const RollupsJson = LedgerHourRollup.pipe(S.Array, S.fromJsonString);

const makeHome = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-timer-" });
});

const failingSpawner = ChildProcessSpawner.make(() =>
  Effect.fail(
    PlatformError.systemError({
      _tag: "NotFound",
      module: "ChildProcess",
      method: "spawn",
      description: "systemctl is not installed",
    })
  )
);

describe("github ledger timer", () => {
  it("renders the exact service and timer units", () => {
    const units = renderGithubLedgerTimerUnits(
      GithubLedgerTimerOptions.make({ repoRoot: "/clones/beep", bunPath: "/opt/bun" })
    );
    const expected: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
      [
        "beep-github-ledger-sample.service",
        [
          "[Unit]",
          "Description=beep GitHub budget ledger /rate_limit sample",
          "",
          "[Service]",
          "Type=oneshot",
          "WorkingDirectory=/clones/beep",
          'ExecStart="/opt/bun" run beep github ledger sample --timer',
          "TimeoutStartSec=120",
          "",
        ],
      ],
      [
        "beep-github-ledger-sample.timer",
        [
          "[Unit]",
          "Description=Timer for the beep GitHub budget ledger /rate_limit sample",
          "",
          "[Timer]",
          "OnCalendar=*:0/5",
          "Persistent=true",
          "",
          "[Install]",
          "WantedBy=timers.target",
          "",
        ],
      ],
    ];
    expect(A.map(units, (unit) => [unit.fileName, unit.text])).toStrictEqual(
      A.map(expected, ([fileName, lines]) => [fileName, A.join(lines, "\n")])
    );
  });

  it.layer(platformLayer, { timeout: "30 seconds" })((it) => {
    it.effect("installs through the command: writes both units, reloads and enables the timer", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome();
        const { spawner, spawned } = scriptedSpawner(systemctlOk);
        const { exit, lines } = yield* captured(
          runLedger(["install-timer", "--repo-root", "~/clone", "--bun-path", "~/bin/bun"]),
          { env: { HOME: home }, spawner }
        );
        assertTrue(exit._tag === "Success");
        const unitDir = unitDirOf(path, home);
        const service = path.join(unitDir, `${GITHUB_LEDGER_TIMER_UNIT}.service`);
        const timer = path.join(unitDir, `${GITHUB_LEDGER_TIMER_UNIT}.timer`);
        expect(lines).toStrictEqual([
          `wrote ${service}`,
          `wrote ${timer}`,
          `enabled ${GITHUB_LEDGER_TIMER_UNIT}.timer (*:0/5).`,
        ]);
        const serviceText = yield* fs.readFileString(service);
        assertInclude(serviceText, `WorkingDirectory=${path.join(home, "clone")}\n`);
        assertInclude(serviceText, `ExecStart="${path.join(home, "bin", "bun")}" run beep github ledger sample`);
        expect(spawned).toStrictEqual([
          "systemctl --user daemon-reload",
          `systemctl --user enable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer`,
        ]);
      })
    );

    it.effect("defaults the repository root to the current directory", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome();
        const { spawner } = scriptedSpawner(systemctlOk);
        const { exit } = yield* captured(runLedger(["install-timer", "--bun-path", "/opt/bun"]), {
          env: { HOME: home },
          spawner,
        });
        assertTrue(exit._tag === "Success");
        const serviceText = yield* fs.readFileString(
          path.join(unitDirOf(path, home), `${GITHUB_LEDGER_TIMER_UNIT}.service`)
        );
        assertInclude(serviceText, `WorkingDirectory=${path.resolve(".")}\n`);
      })
    );

    it.effect("refuses to install or uninstall without HOME", () =>
      Effect.gen(function* () {
        for (const argv of [["install-timer", "--bun-path", "/opt/bun"], ["uninstall-timer"]]) {
          const { spawner, spawned } = scriptedSpawner(systemctlOk);
          const { exit } = yield* captured(runLedger(argv), { env: {}, spawner });
          assertTrue(exit._tag === "Failure");
          assertInclude(String(exit.cause), "HOME is not set; cannot locate the systemd user directory.");
          expect(spawned).toStrictEqual([]);
        }
      })
    );

    it.effect("uninstalls through the command: disables, removes both units and reloads", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome();
        const unitDir = unitDirOf(path, home);
        yield* fs.makeDirectory(unitDir, { recursive: true });
        for (const suffix of ["service", "timer"]) {
          yield* fs.writeFileString(path.join(unitDir, `${GITHUB_LEDGER_TIMER_UNIT}.${suffix}`), "[Unit]\n");
        }
        const { spawner, spawned } = scriptedSpawner(systemctlOk);
        const { exit, lines } = yield* captured(runLedger(["uninstall-timer"]), { env: { HOME: home }, spawner });
        assertTrue(exit._tag === "Success");
        expect(lines).toStrictEqual([`removed ${GITHUB_LEDGER_TIMER_UNIT}.timer.`]);
        const remaining = yield* fs.readDirectory(unitDir);
        expect(remaining).toStrictEqual([]);
        expect(spawned).toStrictEqual([
          `systemctl --user disable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer`,
          "systemctl --user daemon-reload",
        ]);
      })
    );

    it.effect("uninstalls a timer that was never installed, ignoring the disable failure", () =>
      Effect.gen(function* () {
        const home = yield* makeHome();
        // Only daemon-reload is scripted: disable exits 1 and the absent units fail to remove.
        const { spawner, spawned } = scriptedSpawner({ "systemctl --user daemon-reload": { stdout: "" } });
        const { exit } = yield* captured(uninstallGithubLedgerTimer(home), { env: {}, spawner });
        assertTrue(exit._tag === "Success");
        expect(spawned).toStrictEqual([
          `systemctl --user disable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer`,
          "systemctl --user daemon-reload",
        ]);
      })
    );

    it.effect("fails typed when the unit directory cannot be created", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome();
        // `.config` is a file, so `.config/systemd/user` cannot be made.
        yield* fs.writeFileString(path.join(home, ".config"), "");
        const { spawner, spawned } = scriptedSpawner(systemctlOk);
        const error = yield* installGithubLedgerTimer(
          home,
          GithubLedgerTimerOptions.make({ repoRoot: home, bunPath: "/opt/bun" })
        ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner), Effect.flip);
        expect(error).toBeInstanceOf(GithubCommandError);
        expect([error.path, error.message]).toStrictEqual([
          unitDirOf(path, home),
          "Cannot create the systemd user unit directory.",
        ]);
        expect(spawned).toStrictEqual([]);
      })
    );

    it.effect("fails typed when a unit file cannot be written", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome();
        const service = path.join(unitDirOf(path, home), `${GITHUB_LEDGER_TIMER_UNIT}.service`);
        // A directory where the service file goes makes the write fail.
        yield* fs.makeDirectory(service, { recursive: true });
        const { spawner, spawned } = scriptedSpawner(systemctlOk);
        const error = yield* installGithubLedgerTimer(
          home,
          GithubLedgerTimerOptions.make({ repoRoot: home, bunPath: "/opt/bun" })
        ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner), Effect.flip);
        expect([error.path, error.message]).toStrictEqual([service, "Cannot write the unit file."]);
        expect(spawned).toStrictEqual([]);
      })
    );

    it.effect("fails typed with systemctl's exit code when enabling the timer exits non-zero", () =>
      Effect.gen(function* () {
        const home = yield* makeHome();
        const { spawner, spawned } = scriptedSpawner({
          "systemctl --user daemon-reload": { stdout: "" },
          [`systemctl --user enable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer`]: { stdout: "", exitCode: 4 },
        });
        const error = yield* installGithubLedgerTimer(
          home,
          GithubLedgerTimerOptions.make({ repoRoot: home, bunPath: "/opt/bun" })
        ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner), Effect.flip);
        expect([error.path, error.message]).toStrictEqual([
          GITHUB_LEDGER_TIMER_UNIT,
          `systemctl --user enable --now ${GITHUB_LEDGER_TIMER_UNIT}.timer exited with 4: `,
        ]);
        expect(spawned).toHaveLength(2);
      })
    );

    it.effect("fails typed when systemctl cannot be started", () =>
      Effect.gen(function* () {
        const home = yield* makeHome();
        const error = yield* uninstallGithubLedgerTimer(home).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, failingSpawner),
          Effect.flip
        );
        expect([error.path, error.message]).toStrictEqual([
          GITHUB_LEDGER_TIMER_UNIT,
          "systemctl --user daemon-reload failed to start.",
        ]);
        assertTrue(error.cause !== undefined);
      })
    );
  });
});
