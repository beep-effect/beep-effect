/**
 * Systemd user-timer installation for the research pipeline.
 *
 * Renders service+timer unit pairs into `~/.config/systemd/user/` and
 * enables them. The daily unit runs `beep research daily`; a weekly unit
 * refreshes repo cards.
 * Secrets (FIRECRAWL_API_KEY, NOTION_API_KEY, COGNEE_API_URL and the optional
 * COGNEE_API_EMAIL / COGNEE_API_PASSWORD) load from an optional
 * `$HOME/.config/beep-research/env` EnvironmentFile.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Console, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { runCaptured } from "../../../internal/process/StepExec.ts";
import { ResearchCommandError } from "../Research.errors.ts";
import { RESEARCH_ENV_FILE_RELATIVE } from "./ResearchEnv.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ResearchTimerOptions } from "../Research.schemas.ts";

/**
 * Unit base names installed by research install-timers.
 *
 * @internal
 * @category utilities
 */
export const RESEARCH_UNITS = ["beep-research-daily", "beep-research-repo-card"] as const;

type ResearchTimerRequirements = ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path;

interface UnitPair {
  readonly baseName: string;
  readonly description: string;
  readonly execArgs: string;
  readonly onCalendar: string;
}

interface UnitFile {
  readonly fileName: string;
  readonly text: string;
}

const unitPairs = (notionPage: O.Option<string>): ReadonlyArray<UnitPair> => [
  {
    baseName: "beep-research-daily",
    description: "beep research daily pipeline (sift, notion-pull, cognify, digest)",
    execArgs: O.match(notionPage, {
      onNone: () => "research daily --commit",
      onSome: (page) => `research daily --commit --page ${page}`,
    }),
    onCalendar: "*-*-* 21:00:00",
  },
  {
    baseName: "beep-research-repo-card",
    description: "beep research weekly repo-card refresh",
    execArgs: "research repo-card",
    onCalendar: "Sun *-*-* 20:30:00",
  },
];

const renderService = (unit: UnitPair, options: ResearchTimerOptions, home: string): string =>
  A.join(
    [
      "[Unit]",
      `Description=${unit.description}`,
      "",
      "[Service]",
      "Type=oneshot",
      // WorkingDirectory and EnvironmentFile take whole lines and must stay
      // unquoted; systemd splits ExecStart on whitespace with no shell
      // involved, so the Bun path is quoted there and the page id is one
      // token by schema.
      `WorkingDirectory=${options.repoRoot}`,
      `EnvironmentFile=-${home}/${RESEARCH_ENV_FILE_RELATIVE}`,
      `ExecStart="${options.bunPath}" run beep ${unit.execArgs}`,
      "TimeoutStartSec=1800",
      "",
    ],
    "\n"
  );

const renderTimer = (unit: UnitPair): string =>
  A.join(
    [
      "[Unit]",
      `Description=Timer for ${unit.description}`,
      "",
      "[Timer]",
      `OnCalendar=${unit.onCalendar}`,
      "Persistent=true",
      "",
      "[Install]",
      "WantedBy=timers.target",
      "",
    ],
    "\n"
  );

const renderUnitPair =
  (options: ResearchTimerOptions, home: string) =>
  (unit: UnitPair): ReadonlyArray<UnitFile> => [
    { fileName: `${unit.baseName}.service`, text: renderService(unit, options, home) },
    { fileName: `${unit.baseName}.timer`, text: renderTimer(unit) },
  ];

const readHome = Config.String("HOME").pipe(
  ResearchCommandError.mapError("HOME is not set; cannot locate systemd user directory.")
);

const unitDirOf = (path: Path.Path, home: string): string => path.join(home, ".config", "systemd", "user");

const runSystemctl = Effect.fn("ResearchTimers.runSystemctl")(function* (
  args: ReadonlyArray<string>
): Effect.fn.Return<void, ResearchCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: "systemctl",
    args: ["--user", ...args],
    trim: true,
  }).pipe(ResearchCommandError.mapError(`Failed running systemctl --user ${A.join(args, " ")}.`));
  if (result.exitCode !== 0) {
    return yield* ResearchCommandError.make({
      message: `systemctl --user ${A.join(args, " ")} exited with ${result.exitCode}: ${result.output}`,
    });
  }
});

/**
 * Disable and remove the research systemd user timers.
 *
 * Reads only `HOME`: an absent unit is skipped, so no install path can keep
 * the timers from being removed.
 *
 * @internal
 * @category utilities
 */
export const uninstallResearchTimers: Effect.Effect<void, ResearchCommandError, ResearchTimerRequirements> = Effect.gen(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const home = yield* readHome;
    const unitDir = unitDirOf(path, home);
    yield* Effect.forEach(RESEARCH_UNITS, (baseName) =>
      Effect.all([
        runSystemctl(["disable", "--now", `${baseName}.timer`]).pipe(Effect.ignore),
        fs.remove(path.join(unitDir, `${baseName}.timer`)).pipe(Effect.ignore),
        fs.remove(path.join(unitDir, `${baseName}.service`)).pipe(Effect.ignore),
      ])
    );
    yield* runSystemctl(["daemon-reload"]);
    yield* Console.log("research install-timers: removed research timers.");
  }
).pipe(Effect.withSpan("ResearchTimers.uninstallResearchTimers"));

/**
 * Install the research systemd user timers.
 *
 * Every path in `options` is a systemd unit path, so quoting the `ExecStart`
 * Bun argument is all the escaping the rendered units need.
 *
 * @internal
 * @category utilities
 */
export const installResearchTimers = Effect.fn("ResearchTimers.installResearchTimers")(function* (
  options: ResearchTimerOptions
): Effect.fn.Return<void, ResearchCommandError, ResearchTimerRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* readHome;
  const unitDir = unitDirOf(path, home);
  const pairs = unitPairs(O.fromUndefinedOr(options.notionPage));
  const units = A.flatMap(pairs, renderUnitPair(options, home));

  yield* fs
    .makeDirectory(unitDir, { recursive: true })
    .pipe(ResearchCommandError.mapError(`Failed creating systemd user directory "${unitDir}".`));
  yield* Effect.forEach(units, (unit) =>
    fs
      .writeFileString(path.join(unitDir, unit.fileName), unit.text)
      .pipe(ResearchCommandError.mapError(`Failed writing ${unit.fileName}.`))
  );
  yield* runSystemctl(["daemon-reload"]);
  yield* Effect.forEach(pairs, (unit) => runSystemctl(["enable", "--now", `${unit.baseName}.timer`]));
  yield* Console.log(
    `research install-timers: enabled ${A.join(
      A.map(pairs, (unit) => `${unit.baseName}.timer (${unit.onCalendar})`),
      ", "
    )}.`
  );
  yield* Console.log(`research install-timers: secrets load from ${home}/${RESEARCH_ENV_FILE_RELATIVE} when present.`);
});
