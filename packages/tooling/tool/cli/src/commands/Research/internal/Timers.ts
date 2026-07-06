/**
 * Systemd user-timer installation for the research pipeline.
 *
 * Renders service+timer unit pairs into `~/.config/systemd/user/` and
 * enables them, following the Graphiti proxy service-install pattern. The
 * daily unit runs `beep research daily`; a weekly unit refreshes repo cards.
 * Secrets (FIRECRAWL_API_KEY, NOTION_API_KEY, COGNEE_*) load from an optional
 * `~/.config/beep-research/env` EnvironmentFile.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Console, Effect, FileSystem, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import { ResearchCommandError } from "../Research.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";

/** Unit base names installed by research install-timers. @internal */
export const RESEARCH_UNITS = ["beep-research-daily", "beep-research-repo-card"] as const;

const ENV_FILE_RELATIVE = ".config/beep-research/env";

interface UnitPair {
  readonly baseName: string;
  readonly description: string;
  readonly execArgs: string;
  readonly onCalendar: string;
}

const renderService = (unit: UnitPair, bunPath: string, repoRoot: string, home: string): string =>
  [
    "[Unit]",
    `Description=${unit.description}`,
    "",
    "[Service]",
    "Type=oneshot",
    `WorkingDirectory=${repoRoot}`,
    `EnvironmentFile=-${home}/${ENV_FILE_RELATIVE}`,
    `ExecStart=${bunPath} run beep ${unit.execArgs}`,
    "TimeoutStartSec=1800",
    "",
  ].join("\n");

const renderTimer = (unit: UnitPair): string =>
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
  ].join("\n");

const runSystemctl = Effect.fn("ResearchTimers.runSystemctl")(function* (
  args: ReadonlyArray<string>
): Effect.fn.Return<void, ResearchCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("systemctl", ["--user", ...args], { stderr: "pipe", stdout: "pipe" });
      const output = yield* handle.all.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc, chunk) => acc + chunk
        )
      );
      const exitCode = yield* handle.exitCode;
      return { exitCode, output: Str.trim(output) };
    })
  ).pipe(ResearchCommandError.mapError(`Failed running systemctl --user ${A.join(args, " ")}.`));
  if (result.exitCode !== 0) {
    return yield* ResearchCommandError.make({
      message: `systemctl --user ${A.join(args, " ")} exited with ${result.exitCode}: ${result.output}`,
    });
  }
});

/**
 * Install (or uninstall) the research systemd user timers.
 *
 * @internal
 */
export const installResearchTimers = Effect.fn("ResearchTimers.installResearchTimers")(function* (
  repoRoot: string,
  bunPath: string,
  uninstall: boolean,
  notionPage: O.Option<string>
): Effect.fn.Return<
  void,
  ResearchCommandError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* Config.string("HOME").pipe(
    ResearchCommandError.mapError("HOME is not set; cannot locate systemd user directory.")
  );
  const unitDir = path.join(home, ".config", "systemd", "user");

  if (uninstall) {
    for (const baseName of RESEARCH_UNITS) {
      yield* runSystemctl(["disable", "--now", `${baseName}.timer`]).pipe(Effect.ignore);
      yield* fs.remove(path.join(unitDir, `${baseName}.timer`)).pipe(Effect.ignore);
      yield* fs.remove(path.join(unitDir, `${baseName}.service`)).pipe(Effect.ignore);
    }
    yield* runSystemctl(["daemon-reload"]);
    yield* Console.log("research install-timers: removed research timers.");
    return;
  }

  const dailyArgs = O.match(notionPage, {
    onNone: () => "research daily --commit",
    onSome: (page) => `research daily --commit --page ${page}`,
  });
  const units: ReadonlyArray<UnitPair> = [
    {
      baseName: "beep-research-daily",
      description: "beep research daily pipeline (sift, notion-pull, cognify, digest)",
      execArgs: dailyArgs,
      onCalendar: "*-*-* 21:00:00",
    },
    {
      baseName: "beep-research-repo-card",
      description: "beep research weekly repo-card refresh",
      execArgs: "research repo-card",
      onCalendar: "Sun *-*-* 20:30:00",
    },
  ];

  yield* fs
    .makeDirectory(unitDir, { recursive: true })
    .pipe(ResearchCommandError.mapError(`Failed creating systemd user directory "${unitDir}".`));
  for (const unit of units) {
    yield* fs
      .writeFileString(path.join(unitDir, `${unit.baseName}.service`), renderService(unit, bunPath, repoRoot, home))
      .pipe(ResearchCommandError.mapError(`Failed writing ${unit.baseName}.service.`));
    yield* fs
      .writeFileString(path.join(unitDir, `${unit.baseName}.timer`), renderTimer(unit))
      .pipe(ResearchCommandError.mapError(`Failed writing ${unit.baseName}.timer.`));
  }
  yield* runSystemctl(["daemon-reload"]);
  for (const unit of units) {
    yield* runSystemctl(["enable", "--now", `${unit.baseName}.timer`]);
  }
  yield* Console.log(
    `research install-timers: enabled ${A.join(
      A.map(units, (unit) => `${unit.baseName}.timer (${unit.onCalendar})`),
      ", "
    )}.`
  );
  yield* Console.log(`research install-timers: secrets load from ${home}/${ENV_FILE_RELATIVE} when present.`);
});
