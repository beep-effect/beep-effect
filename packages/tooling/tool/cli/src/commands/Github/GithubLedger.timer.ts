/**
 * The systemd user timer that samples `/rate_limit` for the GitHub budget
 * ledger every five minutes.
 *
 * **Details**
 *
 * The service runs `"<bun>" run beep github ledger sample --timer` from the
 * repository root. Tokens resolve at run time through `gh auth token` or `op`,
 * as for any beep command; nothing secret goes into the unit's environment or
 * argv.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { systemdUserUnitDir } from "@beep/repo-cli-kit/systemd/index";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { GithubCommandError } from "./Github.errors.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Github/GithubLedger.timer");

/**
 * The base name of the ledger sampler's service and timer units.
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_LEDGER_TIMER_UNIT = "beep-github-ledger-sample";

/**
 * The sampler timer's calendar: every five minutes.
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_LEDGER_TIMER_CALENDAR = "*:0/5";

/**
 * Where the ledger sampler's units run from and which Bun runs them.
 *
 * **Example** (Build the options)
 *
 * ```ts
 * import { GithubLedgerTimerOptions } from "@beep/repo-cli/commands/Github"
 *
 * const options = GithubLedgerTimerOptions.make({ repoRoot: "/clones/beep", bunPath: "/opt/bun/bin/bun" })
 * console.log(options.repoRoot) // "/clones/beep"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubLedgerTimerOptions extends S.Opaque<GithubLedgerTimerOptions, { readonly brand: unique symbol }>()(
  S.Struct({ repoRoot: S.NonEmptyString, bunPath: S.NonEmptyString }).pipe(
    $I.annoteSchema("GithubLedgerTimerOptions", {
      description: "The repository root and Bun executable the ledger sampler units run with.",
    })
  )
) {}

/**
 * One rendered systemd unit file.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubLedgerUnitFile extends S.Opaque<GithubLedgerUnitFile, { readonly brand: unique symbol }>()(
  S.Struct({ fileName: S.NonEmptyString, text: S.String }).pipe(
    $I.annoteSchema("GithubLedgerUnitFile", { description: "One rendered systemd unit file." })
  )
) {}

/**
 * Render the sampler's service and timer units.
 *
 * **Details**
 *
 * `WorkingDirectory` takes the whole line unquoted; systemd splits
 * `ExecStart` on whitespace without a shell, so the Bun path is quoted.
 *
 * **Example** (Render the units)
 *
 * ```ts
 * import { GithubLedgerTimerOptions, renderGithubLedgerTimerUnits } from "@beep/repo-cli/commands/Github"
 *
 * const units = renderGithubLedgerTimerUnits(GithubLedgerTimerOptions.make({ repoRoot: "/clones/beep", bunPath: "/opt/bun" }))
 * console.log(units.map((unit) => unit.fileName)) // ["beep-github-ledger-sample.service", "beep-github-ledger-sample.timer"]
 * ```
 *
 * @param options - The repository root and Bun path.
 * @returns The service and the timer.
 * @category utilities
 * @since 0.0.0
 */
export const renderGithubLedgerTimerUnits = (
  options: GithubLedgerTimerOptions
): ReadonlyArray<GithubLedgerUnitFile> => [
  GithubLedgerUnitFile.make({
    fileName: `${GITHUB_LEDGER_TIMER_UNIT}.service`,
    text: A.join(
      [
        "[Unit]",
        "Description=beep GitHub budget ledger /rate_limit sample",
        "",
        "[Service]",
        "Type=oneshot",
        `WorkingDirectory=${options.repoRoot}`,
        `ExecStart="${options.bunPath}" run beep github ledger sample --timer`,
        "TimeoutStartSec=120",
        "",
      ],
      "\n"
    ),
  }),
  GithubLedgerUnitFile.make({
    fileName: `${GITHUB_LEDGER_TIMER_UNIT}.timer`,
    text: A.join(
      [
        "[Unit]",
        "Description=Timer for the beep GitHub budget ledger /rate_limit sample",
        "",
        "[Timer]",
        `OnCalendar=${GITHUB_LEDGER_TIMER_CALENDAR}`,
        "Persistent=true",
        "",
        "[Install]",
        "WantedBy=timers.target",
        "",
      ],
      "\n"
    ),
  }),
];

type TimerRequirements =
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path;

const runSystemctl = Effect.fn("GithubLedgerTimer.systemctl")(function* (args: ReadonlyArray<string>) {
  const text = `systemctl --user ${A.join(args, " ")}`;
  const result = yield* runCaptured({ command: "systemctl", args: ["--user", ...args], trim: true }).pipe(
    Effect.mapError((cause) =>
      GithubCommandError.make({ path: GITHUB_LEDGER_TIMER_UNIT, message: `${text} failed to start.`, cause })
    )
  );
  if (result.exitCode !== 0) {
    return yield* GithubCommandError.make({
      path: GITHUB_LEDGER_TIMER_UNIT,
      message: `${text} exited with ${result.exitCode}: ${result.output}`,
    });
  }
});

/**
 * Write the sampler's units into the user unit directory and enable the timer.
 *
 * **Example** (Build the install)
 *
 * ```ts
 * import { GithubLedgerTimerOptions, installGithubLedgerTimer } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 *
 * const install = installGithubLedgerTimer("/home/op", GithubLedgerTimerOptions.make({ repoRoot: "/clones/beep", bunPath: "/opt/bun" }))
 * console.log(Effect.isEffect(install)) // true
 * ```
 *
 * @param home - The operator home directory.
 * @param options - The repository root and Bun path.
 * @returns The unit file paths written.
 * @category utilities
 * @since 0.0.0
 */
export const installGithubLedgerTimer = Effect.fn("GithubLedgerTimer.install")(function* (
  home: string,
  options: GithubLedgerTimerOptions
): Effect.fn.Return<ReadonlyArray<string>, GithubCommandError, TimerRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const unitDir = systemdUserUnitDir(path, home);
  yield* fs
    .makeDirectory(unitDir, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        GithubCommandError.make({ path: unitDir, message: "Cannot create the systemd user unit directory.", cause })
      )
    );
  const written = yield* Effect.forEach(renderGithubLedgerTimerUnits(options), (unit) => {
    const file = path.join(unitDir, unit.fileName);
    return fs.writeFileString(file, unit.text).pipe(
      Effect.as(file),
      Effect.mapError((cause) => GithubCommandError.make({ path: file, message: "Cannot write the unit file.", cause }))
    );
  });
  yield* runSystemctl(["daemon-reload"]);
  yield* runSystemctl(["enable", "--now", `${GITHUB_LEDGER_TIMER_UNIT}.timer`]);
  return written;
});

/**
 * Disable the sampler's timer and remove its units; an absent unit is skipped.
 *
 * **Example** (Build the uninstall)
 *
 * ```ts
 * import { uninstallGithubLedgerTimer } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(uninstallGithubLedgerTimer("/home/op"))) // true
 * ```
 *
 * @param home - The operator home directory.
 * @returns An effect that removes the timer.
 * @category utilities
 * @since 0.0.0
 */
export const uninstallGithubLedgerTimer = Effect.fn("GithubLedgerTimer.uninstall")(function* (
  home: string
): Effect.fn.Return<void, GithubCommandError, TimerRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const unitDir = systemdUserUnitDir(path, home);
  yield* runSystemctl(["disable", "--now", `${GITHUB_LEDGER_TIMER_UNIT}.timer`]).pipe(Effect.ignore);
  yield* Effect.forEach(["timer", "service"], (suffix) =>
    fs.remove(path.join(unitDir, `${GITHUB_LEDGER_TIMER_UNIT}.${suffix}`)).pipe(Effect.ignore)
  );
  yield* runSystemctl(["daemon-reload"]);
});
