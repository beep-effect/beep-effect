/**
 * PID plus process-start identity probes shared by repo-run coordinators.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/repo-run/ProcessIdentity");

/**
 * Parse the process start time (field 22) out of `/proc/<pid>/stat` content.
 *
 * Splitting after the final `)` keeps executable names containing spaces or
 * parentheses from shifting the field index.
 *
 * **Example** (Parse a stat line)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { parseAdmissionProcStatStartTime } from "@beep/repo-cli/test/RepoRun"
 *
 * const stat = "1234 (bun) S 1 1234 1234 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 8241991 0 0"
 * console.log(O.getOrElse(parseAdmissionProcStatStartTime(stat), () => "none")) // "8241991"
 * ```
 *
 * @param stat - Raw `/proc/<pid>/stat` file content.
 * @returns The start-time field when present.
 * @category utilities
 * @since 0.0.0
 */
export const parseAdmissionProcStatStartTime = (stat: string): O.Option<string> =>
  pipe(
    Str.lastIndexOf(")")(stat),
    O.flatMap((closeParen) =>
      O.fromUndefinedOr(A.filter(Str.split(Str.trim(Str.slice(closeParen + 1)(stat)), /\s+/), Str.isNonEmpty)[19])
    )
  );

/**
 * Probe whether a pid is alive, counting `EPERM` as alive.
 *
 * **Example** (Probe the current process)
 *
 * ```ts
 * import { isProcessPidAlive } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(isProcessPidAlive(process.pid))) // true
 * ```
 *
 * @param pid - Process id to probe with signal zero.
 * @returns Whether a process with this pid currently exists.
 * @category utilities
 * @since 0.0.0
 */
export const isProcessPidAlive = (pid: number): Effect.Effect<boolean> =>
  Effect.sync(() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return P.hasProperty(error, "code") && error.code === "EPERM";
    }
  });

/**
 * Read the Linux process start time used to fence PID reuse.
 *
 * **Details**
 *
 * A missing or unreadable proc entry returns `None`.
 *
 * **Example** (Read the current process identity)
 *
 * ```ts
 * import { processStartTimeForPid } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const available = processStartTimeForPid(process.pid).pipe(Effect.map(O.isSome))
 * console.log(Effect.isEffect(available)) // true
 * ```
 *
 * @param pid - Process whose `/proc/<pid>/stat` start time is requested.
 * @returns The process start time when the proc entry is readable.
 * @category utilities
 * @since 0.0.0
 */
export const processStartTimeForPid = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(`/proc/${pid}/stat`)
    .pipe(Effect.map(parseAdmissionProcStatStartTime), Effect.orElseSucceed(O.none<string>));
});

const processStartIdentityProbe = (options: { readonly pid: number; readonly platform: NodeJS.Platform }) => {
  const { pid, platform } = options;
  const windows = platform === "win32";
  return {
    prefix: windows ? "win" : "ps",
    command: windows
      ? [
          "powershell.exe",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
        ]
      : ["ps", "-o", "lstart=", "-p", `${pid}`],
  };
};

/**
 * Build the platform process-inspector probe used when procfs is unavailable.
 *
 * **Example** (Build a Unix probe)
 *
 * ```ts
 * import { processStartIdentityProbeForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(processStartIdentityProbeForTesting({ pid: 42, platform: "linux" }).prefix) // "ps"
 * ```
 *
 * @param options - Process id and platform whose process inspector should be selected.
 * @returns The identity prefix and command arguments for the selected platform.
 * @category testing
 * @since 0.0.0
 */
export const processStartIdentityProbeForTesting = processStartIdentityProbe;

const processStartIdentityFromSystemCommand = (pid: number): Effect.Effect<O.Option<string>> =>
  Effect.try(() => {
    const probe = processStartIdentityProbe({ pid, platform: process.platform });
    const result = Bun.spawnSync({
      cmd: probe.command,
      env: { ...Bun.env, LANG: "C", LC_ALL: "C" },
      stderr: "ignore",
      stdout: "pipe",
    });
    const output = Str.trim(result.stdout.toString());
    return result.success && Str.isNonEmpty(output) ? O.some(`${probe.prefix}:${output}`) : O.none<string>();
  }).pipe(Effect.orElseSucceed(O.none<string>));

/**
 * Read a portable process-start identity used to fence PID reuse.
 *
 * **Details**
 *
 * Linux procfs is the fast path. Other hosts use the platform process
 * inspector and prefix the representation so observers use the same source.
 *
 * **Example** (Read the current portable identity)
 *
 * ```ts
 * import { processStartIdentityForPid } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const available = processStartIdentityForPid(process.pid).pipe(Effect.map(O.isSome))
 * console.log(Effect.isEffect(available)) // true
 * ```
 *
 * @param pid - Process whose start identity is requested.
 * @returns A procfs or platform-inspector identity when available.
 * @category utilities
 * @since 0.0.0
 */
export const processStartIdentityForPid = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const procStart = yield* processStartTimeForPid(pid);
  return O.isSome(procStart) ? procStart : yield* processStartIdentityFromSystemCommand(pid);
});

/**
 * Result of inspecting a PID plus its recorded process start time.
 *
 * **Example** (Recognize a live owner)
 *
 * ```ts
 * import { ProcessIdentityStatus } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProcessIdentityStatus.is.alive("alive")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessIdentityStatus = LiteralKit(["alive", "dead", "unknown"]).pipe(
  $I.annoteSchema("ProcessIdentityStatus", {
    description: "Whether a recorded process identity is live, dead, or temporarily unverifiable.",
  })
);

/**
 * Type represented by {@link ProcessIdentityStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessIdentityStatus = typeof ProcessIdentityStatus.Type;

const processIdentityStatusWithStart = Effect.fnUntraced(function* <Requirements>(
  owner: {
    readonly pid: number;
    readonly procStart: string;
  },
  currentStart: Effect.Effect<O.Option<string>, never, Requirements>
): Effect.fn.Return<ProcessIdentityStatus, never, Requirements> {
  const alive = yield* isProcessPidAlive(owner.pid);
  if (!alive) {
    return ProcessIdentityStatus.Enum.dead;
  }
  if (Str.isEmpty(owner.procStart)) {
    return ProcessIdentityStatus.Enum.alive;
  }
  return O.match(yield* currentStart, {
    onNone: () => ProcessIdentityStatus.Enum.unknown,
    onSome: (start) => (start === owner.procStart ? ProcessIdentityStatus.Enum.alive : ProcessIdentityStatus.Enum.dead),
  });
});

/**
 * Inspect a process identity using both its PID and recorded start time.
 *
 * **Details**
 *
 * A live PID with an unreadable current start time is `unknown`, distinct
 * from a missing PID or mismatched start time that proves the owner `dead`.
 *
 * **Example** (Inspect the current process)
 *
 * ```ts
 * import { processIdentityStatus } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * const status = processIdentityStatus({ pid: process.pid, procStart: "" })
 * console.log(Effect.isEffect(status)) // true
 * ```
 *
 * @param owner - PID and process start time recorded by an owner.
 * @returns The observed process-identity status.
 * @category utilities
 * @since 0.0.0
 */
export const processIdentityStatus = Effect.fnUntraced(function* (owner: {
  readonly pid: number;
  readonly procStart: string;
}): Effect.fn.Return<ProcessIdentityStatus, never, FileSystem.FileSystem> {
  const currentStart =
    Str.startsWith("ps:")(owner.procStart) || Str.startsWith("win:")(owner.procStart)
      ? processStartIdentityFromSystemCommand(owner.pid)
      : processStartTimeForPid(owner.pid);
  return yield* processIdentityStatusWithStart(owner, currentStart);
});

/**
 * Check a process identity using both its PID and recorded start time.
 *
 * **Details**
 *
 * A start-time mismatch proves PID reuse. An unreadable current identity is
 * conservatively retained. Empty legacy start times keep PID-only behavior.
 *
 * **Example** (Check a recorded process identity)
 *
 * ```ts
 * import { isProcessIdentityAlive } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * const alive = isProcessIdentityAlive({ pid: process.pid, procStart: "" })
 * console.log(Effect.isEffect(alive)) // true
 * ```
 *
 * @param owner - PID and process start time recorded by an owner.
 * @returns Whether the same process identity is still alive.
 * @category utilities
 * @since 0.0.0
 */
export const isProcessIdentityAlive = Effect.fnUntraced(function* (owner: {
  readonly pid: number;
  readonly procStart: string;
}): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  return !ProcessIdentityStatus.is.dead(yield* processIdentityStatus(owner));
});

/**
 * Check process-identity behavior with a supplied current start time.
 *
 * **Example** (Model an unreadable current identity)
 *
 * ```ts
 * import { isProcessIdentityAliveWithStartForTesting } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const alive = Effect.runSync(
 *   isProcessIdentityAliveWithStartForTesting({ pid: process.pid, procStart: "recorded-start" }, O.none())
 * )
 * console.log(alive) // true
 * ```
 *
 * @param owner - PID and recorded process start time to check.
 * @param currentStart - Simulated current process start time.
 * @returns Whether the supplied identity still owns the live PID.
 * @category testing
 * @since 0.0.0
 */
export const isProcessIdentityAliveWithStartForTesting = Effect.fnUntraced(function* (
  owner: {
    readonly pid: number;
    readonly procStart: string;
  },
  currentStart: O.Option<string>
): Effect.fn.Return<boolean> {
  return !ProcessIdentityStatus.is.dead(yield* processIdentityStatusWithStart(owner, Effect.succeed(currentStart)));
});

/**
 * Inspect process-identity status with a supplied current start time.
 *
 * **Example** (Model an unreadable current identity)
 *
 * ```ts
 * import { processIdentityStatusWithStartForTesting } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const status = Effect.runSync(
 *   processIdentityStatusWithStartForTesting({ pid: process.pid, procStart: "recorded-start" }, O.none())
 * )
 * console.log(status) // "unknown"
 * ```
 *
 * @param owner - PID and recorded process start time to inspect.
 * @param currentStart - Simulated current process start time.
 * @returns The simulated process-identity status.
 * @category testing
 * @since 0.0.0
 */
export const processIdentityStatusWithStartForTesting = Effect.fnUntraced(function* (
  owner: {
    readonly pid: number;
    readonly procStart: string;
  },
  currentStart: O.Option<string>
): Effect.fn.Return<ProcessIdentityStatus> {
  return yield* processIdentityStatusWithStart(owner, Effect.succeed(currentStart));
});
