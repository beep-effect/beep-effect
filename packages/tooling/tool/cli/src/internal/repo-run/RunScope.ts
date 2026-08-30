/**
 * Best-effort systemd user scopes for admitted repository work.
 *
 * The scheduler adopts its own pid into a transient scope. Child processes
 * inherit the scope's cgroup, so ownership survives process reparenting and
 * detached sessions. Every operation falls back without failing admission.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { platform, tmpdir } from "node:os";
import * as O from "@beep/utils/Option";
import { DateTime, Effect, flow, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as Str from "effect/String";
import { configStringOption } from "../cli/EnvConfig.ts";
import { runRepoCommandCapture } from "./RepoRun.executor.ts";
import { RunScopeRecord, RunScopeStopOutcome, RunScopeSupport, RunScopeTelemetry } from "./RunScope.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const SYSTEMD_DESTINATION = "org.freedesktop.systemd1";
const SYSTEMD_MANAGER_PATH = "/org/freedesktop/systemd1";
const SYSTEMD_MANAGER_INTERFACE = "org.freedesktop.systemd1.Manager";

const commandEnvironment = Effect.fnUntraced(function* (): Effect.fn.Return<
  Record<string, string | undefined> | undefined
> {
  const configuredPath = yield* configStringOption("PATH");
  return O.match(configuredPath, {
    onNone: () => undefined,
    onSome: (PATH) => ({ PATH }),
  });
});

const runScopeCommand = Effect.fnUntraced(function* (
  command: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<
  O.Option<{ readonly exitCode: number; readonly output: string; readonly truncated: boolean }>,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* runRepoCommandCapture(command, args, tmpdir(), yield* commandEnvironment()).pipe(Effect.option);
});

/**
 * Derive the deterministic scope unit name for one admission ticket nonce.
 *
 * The reaper recomputes this name for leases that died before their scope
 * record was persisted, so leaked scopes stay stoppable.
 *
 * **Example** (Derive a unit name)
 *
 * ```ts
 * import { runScopeUnitName } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(runScopeUnitName("ticket with spaces")) // "agent-run-ticket-with-spaces.scope"
 * ```
 *
 * @param ticketId - Admission ticket nonce.
 * @returns A systemd-safe transient scope unit name.
 * @category admission
 * @since 0.0.0
 */
export const runScopeUnitName = (ticketId: string): string => {
  const sanitized = pipe(ticketId, Str.replace(/[^a-zA-Z0-9:_.-]/gu, "-"), Str.slice(0, 200));
  return `agent-run-${Str.isEmpty(sanitized) ? "unknown" : sanitized}.scope`;
};

const getUnitByPidArguments = (...busctlFlags: ReadonlyArray<string>): ReadonlyArray<string> => [
  "--user",
  ...busctlFlags,
  "call",
  SYSTEMD_DESTINATION,
  SYSTEMD_MANAGER_PATH,
  SYSTEMD_MANAGER_INTERFACE,
  "GetUnitByPID",
  "u",
  `${process.pid}`,
];

const escapeUnitNameForDbusPath = (unitName: string): string =>
  pipe(
    Str.split(unitName, ""),
    A.map((char) => (/[A-Za-z0-9]/u.test(char) ? char : `_${char.charCodeAt(0).toString(16).padStart(2, "0")}`)),
    A.join("")
  );

const verifyRunScopeAdoption = Effect.fnUntraced(function* (
  unitName: string
): Effect.fn.Return<RunScopeRecord, never, ChildProcessSpawner.ChildProcessSpawner> {
  const verified = yield* runScopeCommand("busctl", getUnitByPidArguments());
  const adopted = O.exists(
    verified,
    (capture) => capture.exitCode === 0 && Str.includes(`/unit/${escapeUnitNameForDbusPath(unitName)}`)(capture.output)
  );
  return yield* adopted
    ? makeRunScopeRecord(unitName, "active")
    : makeRunScopeRecord(
        unitName,
        "failed",
        O.some("systemd accepted the start job but did not adopt this process into the scope.")
      );
});

const makeRunScopeRecord = Effect.fnUntraced(function* (
  unitName: string,
  support: RunScopeSupport,
  warning: O.Option<string> = O.none()
): Effect.fn.Return<RunScopeRecord> {
  const attachedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  return RunScopeRecord.make({
    unitName,
    support,
    attachedPid: process.pid,
    attachedAt,
    ...O.getSomesStruct({ warning }),
  });
});

/**
 * Probe whether this process can talk to a systemd user manager.
 *
 * Spawn and non-zero exit failures become `unsupported`; callers never fail.
 * Set `BEEP_RUN_SCOPES=0` or `BEEP_RUN_SCOPES=false` to disable the feature.
 *
 * **Example** (Reference the support probe)
 *
 * ```ts
 * import { detectRunScopeSupport } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof detectRunScopeSupport) // "function"
 * ```
 *
 * @returns The current run-scope support state.
 * @category admission
 * @since 0.0.0
 */
export const detectRunScopeSupport = Effect.fn("RunScope.detectRunScopeSupport")(function* (): Effect.fn.Return<
  RunScopeSupport,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const configured = yield* configStringOption("BEEP_RUN_SCOPES");
  if (O.exists(configured, (value) => A.contains(["0", "false"], value))) {
    return "disabled";
  }
  if (platform() !== "linux") {
    return "unsupported";
  }
  const probe = yield* runScopeCommand("busctl", getUnitByPidArguments("--timeout=2"));
  return O.exists(probe, (capture) => capture.exitCode === 0) ? "active" : "unsupported";
});

/**
 * Adopt this CLI process into a transient systemd scope for one admitted run.
 *
 * A missing installed `agent-runs.slice` is acceptable. The user manager then
 * creates a transient slice with default accounting settings. Because a
 * successful `StartTransientUnit` reply only proves the job was accepted,
 * adoption is verified with `GetUnitByPID` before reporting `active`. Start
 * failures are retained as a warning and never fail the admitted command.
 *
 * **Example** (Reference scope entry)
 *
 * ```ts
 * import { enterRunScope } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof enterRunScope) // "function"
 * ```
 *
 * The unit description records diagnostic provenance for the admission root.
 * Destructive reaping does not infer authority from loaded units or this
 * description: a verified dead lease with a nonce matching the unit name, and
 * no live lease representing that unit, is the sole stop authority.
 *
 * @param ticketId - Admission ticket nonce used to generate a safe unit name.
 * @param ownerRoot - Admission root directory whose lease owns the scope.
 * @returns The best-effort scope attachment record.
 * @category admission
 * @since 0.0.0
 */
export const enterRunScope = Effect.fn("RunScope.enterRunScope")(function* (
  ticketId: string,
  ownerRoot: string
): Effect.fn.Return<RunScopeRecord, never, ChildProcessSpawner.ChildProcessSpawner> {
  const unitName = runScopeUnitName(ticketId);
  const support = yield* detectRunScopeSupport();
  if (!RunScopeSupport.is.active(support)) {
    return yield* makeRunScopeRecord(unitName, support);
  }
  const started = yield* runScopeCommand("busctl", [
    "--user",
    "call",
    SYSTEMD_DESTINATION,
    SYSTEMD_MANAGER_PATH,
    SYSTEMD_MANAGER_INTERFACE,
    "StartTransientUnit",
    "ssa(sv)a(sa(sv))",
    unitName,
    "fail",
    "4",
    "Description",
    "s",
    runScopeDescription(ticketId, ownerRoot),
    "Slice",
    "s",
    "agent-runs.slice",
    "PIDs",
    "au",
    "1",
    `${process.pid}`,
    "CollectMode",
    "s",
    "inactive-or-failed",
    "0",
  ]);
  return yield* O.match(started, {
    onNone: () => makeRunScopeRecord(unitName, "failed", O.some("Could not start the transient systemd run scope.")),
    onSome: (capture) =>
      capture.exitCode === 0
        ? verifyRunScopeAdoption(unitName)
        : makeRunScopeRecord(
            unitName,
            "failed",
            O.some(`busctl StartTransientUnit exited with code ${capture.exitCode}.`)
          ),
  });
});

const RUN_SCOPE_DESCRIPTION_PREFIX = "beep-yeet-lease";

const runScopeDescription = (ticketId: string, ownerRoot: string): string =>
  `${RUN_SCOPE_DESCRIPTION_PREFIX} nonce=${ticketId} root=${ownerRoot}`;

const ownerRootFromDescription: (description: string) => O.Option<string> = flow(
  Str.match(/^beep-yeet-lease nonce=.* root=(.+)$/u),
  O.flatMap((matched) => O.fromUndefinedOr(matched[1])),
  O.map(Str.trim),
  O.filter(Str.isNonEmpty)
);

/**
 * Read the admission root recorded as the owner of one run scope.
 *
 * Scopes started by {@link enterRunScope} carry
 * `Description=beep-yeet-lease nonce=<nonce> root=<admission root>`. Scopes
 * without that description, command failures, and spawn failures all read as
 * an unknown owner. This is a diagnostic reader; the reaper uses verified
 * dead-lease evidence rather than owner-description census data.
 *
 * **Example** (Reference the owner reader)
 *
 * ```ts
 * import { readRunScopeOwnerRoot } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof readRunScopeOwnerRoot) // "function"
 * ```
 *
 * @param unitName - Loaded `agent-run-*.scope` unit name.
 * @returns The owning admission root when the scope records one.
 * @category admission
 * @since 0.0.0
 */
export const readRunScopeOwnerRoot = Effect.fn("RunScope.readRunScopeOwnerRoot")(function* (
  unitName: string
): Effect.fn.Return<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const shown = yield* runScopeCommand("systemctl", ["--user", "show", unitName, "-p", "Description"]);
  if (O.isNone(shown) || shown.value.exitCode !== 0) {
    return O.none();
  }
  return pipe(
    Str.split(shown.value.output, "\n"),
    A.findFirst(Str.startsWith("Description=")),
    O.map(Str.slice(Str.length("Description="))),
    O.flatMap(ownerRootFromDescription)
  );
});

const parseTelemetryValue: (value: O.Option<string>) => O.Option<number> = flow(
  O.map(Str.trim),
  O.filter((text) => Str.isNonEmpty(text) && text !== "[not set]"),
  O.flatMap(N.parse)
);

const telemetryProperty = (lines: ReadonlyArray<string>, property: string): O.Option<number> =>
  parseTelemetryValue(
    pipe(A.findFirst(lines, Str.startsWith(`${property}=`)), O.map(Str.slice(Str.length(property) + 1)))
  );

/**
 * Read peak memory and current task accounting from one systemd scope.
 *
 * Properties are matched by name because `systemctl show` omits unset
 * properties and prints in its own order. Missing properties, `[not set]`,
 * command failures, and spawn failures all become absent metrics.
 *
 * **Example** (Reference the telemetry reader)
 *
 * ```ts
 * import { readRunScopeTelemetry } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof readRunScopeTelemetry) // "function"
 * ```
 *
 * @param unitName - Recorded systemd scope unit name.
 * @returns Accounting values that systemd reported.
 * @category admission
 * @since 0.0.0
 */
export const readRunScopeTelemetry = Effect.fn("RunScope.readRunScopeTelemetry")(function* (
  unitName: string
): Effect.fn.Return<RunScopeTelemetry, never, ChildProcessSpawner.ChildProcessSpawner> {
  const shown = yield* runScopeCommand("systemctl", ["--user", "show", unitName, "-p", "MemoryPeak,TasksCurrent"]);
  if (O.isNone(shown) || shown.value.exitCode !== 0) {
    return RunScopeTelemetry.make({});
  }
  const lines = Str.split(shown.value.output, "\n");
  return RunScopeTelemetry.make(
    O.getSomesStruct({
      memoryPeakBytes: telemetryProperty(lines, "MemoryPeak"),
      tasksCurrent: telemetryProperty(lines, "TasksCurrent"),
    })
  );
});

/**
 * Stop a recorded run scope while applying dead-lease reaping.
 *
 * This helper is reserved for the scheduler reaper. It reports failures so
 * the owning dead lease can remain available as retry authority.
 *
 * **Example** (Reference the dead-lease stop helper)
 *
 * ```ts
 * import { stopRunScopeForReap } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof stopRunScopeForReap) // "function"
 * ```
 *
 * @param unitName - Scope recorded by a dead admission lease.
 * @returns A bounded outcome distinguishing a successful stop, an already-collected scope, spawn failure, and non-zero exit.
 * @internal
 * @category admission
 * @since 0.0.0
 */
export const stopRunScopeForReap = Effect.fn("RunScope.stopRunScopeForReap")(function* (
  unitName: string
): Effect.fn.Return<RunScopeStopOutcome, never, ChildProcessSpawner.ChildProcessSpawner> {
  const stopped = yield* runScopeCommand("systemctl", ["--user", "stop", unitName]);
  return yield* O.match(stopped, {
    onNone: () => Effect.succeed(RunScopeStopOutcome.Enum["spawn-failed"]),
    onSome: (capture) =>
      Eq.equals(capture.exitCode, 0)
        ? Effect.succeed(RunScopeStopOutcome.Enum.stopped)
        : runScopeCommand("systemctl", ["--user", "show", unitName, "--property=LoadState", "--value"]).pipe(
            Effect.map((loadState) =>
              O.exists(
                loadState,
                (probe) => Eq.equals(probe.exitCode, 0) && Str.Equivalence(Str.trim(probe.output), "not-found")
              )
                ? RunScopeStopOutcome.Enum.absent
                : RunScopeStopOutcome.Enum["exit-failed"]
            )
          ),
  });
});

/**
 * Explain why normal scope cleanup does not stop the current unit.
 *
 * **Example** (Render the cleanup hint)
 *
 * ```ts
 * import { runScopeCleanupHint } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(runScopeCleanupHint("agent-run-d0a7b0dc.scope").includes("scheduler reap --apply")) // true
 * ```
 *
 * @param unitName - Scope owned by the current admitted CLI.
 * @returns A cleanup note for operators and diagnostics.
 * @category admission
 * @since 0.0.0
 */
export const runScopeCleanupHint = (unitName: string): string =>
  `${unitName} dissolves when this CLI exits; scheduler reap --apply stops it if its lease owner dies.`;
