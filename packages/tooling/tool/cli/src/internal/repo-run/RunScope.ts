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
import { DateTime, Effect, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { configStringOption } from "../cli/EnvConfig.ts";
import { runRepoCommandCapture } from "./RepoRun.executor.ts";
import { RunScopeRecord, RunScopeSupport, RunScopeTelemetry } from "./RunScope.schemas.ts";
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

const runScopeUnitName = (ticketId: string): string => {
  const sanitized = pipe(ticketId, Str.replace(/[^a-zA-Z0-9:_.-]/gu, "-"), Str.slice(0, 200));
  return `agent-run-${Str.isEmpty(sanitized) ? "unknown" : sanitized}.scope`;
};

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
 * @category runtime
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
  const probe = yield* runScopeCommand("busctl", [
    "--user",
    "--timeout=2",
    "call",
    SYSTEMD_DESTINATION,
    SYSTEMD_MANAGER_PATH,
    SYSTEMD_MANAGER_INTERFACE,
    "GetUnitByPID",
    "u",
    `${process.pid}`,
  ]);
  return O.exists(probe, (capture) => capture.exitCode === 0) ? "active" : "unsupported";
});

/**
 * Adopt this CLI process into a transient systemd scope for one admitted run.
 *
 * A missing installed `agent-runs.slice` is acceptable. The user manager then
 * creates a transient slice with default accounting settings. Start failures
 * are retained as a warning and never fail the admitted command.
 *
 * **Example** (Reference scope entry)
 *
 * ```ts
 * import { enterRunScope } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof enterRunScope) // "function"
 * ```
 *
 * @param ticketId - Admission ticket nonce used to generate a safe unit name.
 * @returns The best-effort scope attachment record.
 * @category runtime
 * @since 0.0.0
 */
export const enterRunScope = Effect.fn("RunScope.enterRunScope")(function* (
  ticketId: string
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
    "3",
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
        ? makeRunScopeRecord(unitName, "active")
        : makeRunScopeRecord(
            unitName,
            "failed",
            O.some(`busctl StartTransientUnit exited with code ${capture.exitCode}.`)
          ),
  });
});

const parseTelemetryValue = (value: O.Option<string>): O.Option<number> =>
  pipe(
    value,
    O.map(Str.trim),
    O.filter((text) => Str.isNonEmpty(text) && text !== "[not set]"),
    O.flatMap(N.parse)
  );

/**
 * Read peak memory and current task accounting from one systemd scope.
 *
 * Missing properties, `[not set]`, command failures, and spawn failures all
 * become absent metrics.
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
 * @category runtime
 * @since 0.0.0
 */
export const readRunScopeTelemetry = Effect.fn("RunScope.readRunScopeTelemetry")(function* (
  unitName: string
): Effect.fn.Return<RunScopeTelemetry, never, ChildProcessSpawner.ChildProcessSpawner> {
  const shown = yield* runScopeCommand("systemctl", [
    "--user",
    "show",
    unitName,
    "-p",
    "MemoryPeak,TasksCurrent",
    "--value",
  ]);
  if (O.isNone(shown) || shown.value.exitCode !== 0) {
    return RunScopeTelemetry.make({});
  }
  const values = Str.split(shown.value.output, "\n");
  return RunScopeTelemetry.make(
    O.getSomesStruct({
      memoryPeakBytes: parseTelemetryValue(A.get(values, 0)),
      tasksPeak: parseTelemetryValue(A.get(values, 1)),
    })
  );
});

/**
 * Stop a recorded run scope while applying dead-lease reaping.
 *
 * This helper is reserved for the scheduler reaper. Stop and spawn failures
 * are ignored so stale lease cleanup can continue.
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
 * @internal
 * @category runtime
 * @since 0.0.0
 */
export const stopRunScopeForReap = Effect.fn("RunScope.stopRunScopeForReap")(function* (
  unitName: string
): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner> {
  yield* runScopeCommand("systemctl", ["--user", "stop", unitName]);
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
 * @category runtime
 * @since 0.0.0
 */
export const runScopeCleanupHint = (unitName: string): string =>
  `${unitName} dissolves when this CLI exits; scheduler reap --apply stops it if its lease owner dies.`;
