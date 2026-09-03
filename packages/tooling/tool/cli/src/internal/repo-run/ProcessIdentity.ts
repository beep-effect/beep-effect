/**
 * Source-fenced process identities shared by repository-run coordination.
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
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/repo-run/ProcessIdentity");
const SystemProcessIdentitySource = LiteralKit(["ps", "win"]);

/**
 * Process-inspection source encoded into a durable start identity.
 *
 * **Example** (Inspect the supported sources)
 *
 * ```ts
 * import { ProcessIdentitySource } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProcessIdentitySource.Options) // ["proc", "ps", "win"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessIdentitySource = LiteralKit(["proc", "ps", "win"]).pipe(
  $I.annoteSchema("ProcessIdentitySource", {
    description: "Process-inspection source carried by a durable start identity.",
  })
);

/**
 * Type represented by {@link ProcessIdentitySource}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessIdentitySource = typeof ProcessIdentitySource.Type;

/**
 * Source-prefixed process start identity used to fence PID reuse.
 *
 * **Example** (Validate a procfs identity)
 *
 * ```ts
 * import { ProcessStartIdentity } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProcessStartIdentity)("proc:8241991")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessStartIdentity = S.TemplateLiteral([ProcessIdentitySource, ":", S.NonEmptyString]).pipe(
  $I.annoteSchema("ProcessStartIdentity", {
    description: "Process start identity prefixed by the inspection source that produced it.",
  })
);

/**
 * Type represented by {@link ProcessStartIdentity}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProcessStartIdentity = typeof ProcessStartIdentity.Type;

/**
 * Result of inspecting a PID plus its recorded process start identity.
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

interface ProcessIdentityOwner {
  readonly pid: number;
  readonly procStart: string;
}

const processIdentitySource = (identity: string): ProcessIdentitySource =>
  A.findFirst(ProcessIdentitySource.Options, (source) => Str.startsWith(`${source}:`)(identity)).pipe(
    O.getOrElse(ProcessIdentitySource.thunk.proc)
  );

const normalizeRecordedProcessIdentity = (identity: string): string =>
  Str.startsWith(`${processIdentitySource(identity)}:`)(identity) ? identity : `proc:${identity}`;

/**
 * Parse the process start time (field 22) out of `/proc/<pid>/stat` content.
 *
 * **Details**
 *
 * Parsing begins after the final `)` so executable names containing spaces or
 * parentheses cannot shift the field index.
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
 * @category liveness
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
 * Probe whether a PID is alive, counting `EPERM` as alive.
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
 * @returns Whether a process with this PID currently exists.
 * @category liveness
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
 * **Example** (Read the current process start time)
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
 * @returns The unprefixed procfs start time when readable.
 * @category liveness
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

const procProcessStartIdentity = (pid: number): Effect.Effect<O.Option<string>, never, FileSystem.FileSystem> =>
  processStartTimeForPid(pid).pipe(Effect.map(O.map((identity) => `proc:${identity}`)));

const processStartIdentityFromSystemCommand = (pid: number, source: "ps" | "win"): Effect.Effect<O.Option<string>> =>
  Effect.try(() => {
    const command = SystemProcessIdentitySource.$match(source, {
      ps: () => ["ps", "-o", "lstart=", "-p", `${pid}`],
      win: () => [
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
      ],
    });
    const result = Bun.spawnSync({
      cmd: command,
      env: { ...Bun.env, LANG: "C", LC_ALL: "C" },
      stderr: "ignore",
      stdout: "pipe",
    });
    const output = Str.trim(result.stdout.toString());
    return result.success && Str.isNonEmpty(output) ? O.some(`${source}:${output}`) : O.none<string>();
  }).pipe(Effect.orElseSucceed(O.none<string>));

const probeRecordedProcessIdentity = (
  pid: number,
  recordedIdentity: string
): Effect.Effect<O.Option<string>, never, FileSystem.FileSystem> => {
  const source = processIdentitySource(normalizeRecordedProcessIdentity(recordedIdentity));
  return ProcessIdentitySource.$match(source, {
    proc: () => procProcessStartIdentity(pid),
    ps: () => processStartIdentityFromSystemCommand(pid, "ps"),
    win: () => processStartIdentityFromSystemCommand(pid, "win"),
  });
};

/**
 * Read a source-fenced process start identity.
 *
 * **Details**
 *
 * A recorded identity selects the probe for its own source. Without one,
 * procfs is preferred and the platform inspector is the fallback. A probe
 * never substitutes an observation from a different source.
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
 * @param recordedIdentity - Existing identity whose source must be reused.
 * @returns A source-prefixed start identity when the selected probe succeeds.
 * @category liveness
 * @since 0.0.0
 */
export const processStartIdentityForPid = Effect.fnUntraced(function* (
  pid: number,
  recordedIdentity: O.Option<string> = O.none()
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  if (O.isSome(recordedIdentity)) {
    return yield* probeRecordedProcessIdentity(pid, recordedIdentity.value);
  }
  const procStart = yield* procProcessStartIdentity(pid);
  return O.isSome(procStart)
    ? procStart
    : yield* processStartIdentityFromSystemCommand(pid, process.platform === "win32" ? "win" : "ps");
});

const processIdentityStatusWithStart = Effect.fnUntraced(function* <Requirements>(
  owner: ProcessIdentityOwner,
  currentStart: Effect.Effect<O.Option<string>, never, Requirements>
): Effect.fn.Return<ProcessIdentityStatus, never, Requirements> {
  if (!(yield* isProcessPidAlive(owner.pid))) {
    return ProcessIdentityStatus.Enum.dead;
  }
  if (Str.isEmpty(owner.procStart)) {
    return ProcessIdentityStatus.Enum.alive;
  }
  const recorded = normalizeRecordedProcessIdentity(owner.procStart);
  return O.match(yield* currentStart, {
    onNone: () => ProcessIdentityStatus.Enum.unknown,
    onSome: (current) => {
      const normalizedCurrent = normalizeRecordedProcessIdentity(current);
      const sameSource = Str.Equivalence(processIdentitySource(recorded), processIdentitySource(normalizedCurrent));
      return sameSource
        ? Str.Equivalence(normalizedCurrent, recorded)
          ? ProcessIdentityStatus.Enum.alive
          : ProcessIdentityStatus.Enum.dead
        : ProcessIdentityStatus.Enum.unknown;
    },
  });
});

/**
 * Inspect a process identity using its PID, recorded start, and recorded source.
 *
 * **Details**
 *
 * Only a missing PID or a same-source start mismatch proves death. Failed and
 * cross-source probes are inconclusive and therefore return `unknown`.
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
 * @param owner - PID and process start identity recorded by an owner.
 * @returns The observed process-identity status.
 * @category liveness
 * @since 0.0.0
 */
export const processIdentityStatus = Effect.fnUntraced(function* (
  owner: ProcessIdentityOwner
): Effect.fn.Return<ProcessIdentityStatus, never, FileSystem.FileSystem> {
  const currentStart = Str.isEmpty(owner.procStart)
    ? Effect.succeed(O.none<string>())
    : processStartIdentityForPid(owner.pid, O.some(owner.procStart));
  return yield* processIdentityStatusWithStart(owner, currentStart);
});

/**
 * Check whether a recorded process identity may still own its PID.
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
 * @param owner - PID and process start identity recorded by an owner.
 * @returns Whether the identity is alive or remains inconclusive.
 * @category liveness
 * @since 0.0.0
 */
export const isProcessIdentityAlive = Effect.fnUntraced(function* (
  owner: ProcessIdentityOwner
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  return !ProcessIdentityStatus.is.dead(yield* processIdentityStatus(owner));
});

/**
 * Inspect process-identity status with a supplied current identity.
 *
 * **Example** (Model an unreadable current identity)
 *
 * ```ts
 * import { processIdentityStatusWithStartForTesting } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const status = Effect.runSync(
 *   processIdentityStatusWithStartForTesting(
 *     { pid: process.pid, procStart: "proc:recorded-start" },
 *     O.none()
 *   )
 * )
 * console.log(status) // "unknown"
 * ```
 *
 * @param owner - PID and recorded process start identity to inspect.
 * @param currentStart - Simulated current source-prefixed process identity.
 * @returns The simulated process-identity status.
 * @category testing
 * @since 0.0.0
 */
export const processIdentityStatusWithStartForTesting = Effect.fnUntraced(function* (
  owner: ProcessIdentityOwner,
  currentStart: O.Option<string>
): Effect.fn.Return<ProcessIdentityStatus> {
  return yield* processIdentityStatusWithStart(owner, Effect.succeed(currentStart));
});

/**
 * Check process-identity liveness with a supplied current identity.
 *
 * **Example** (Retain an inconclusive identity)
 *
 * ```ts
 * import { isProcessIdentityAliveWithStartForTesting } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const alive = Effect.runSync(
 *   isProcessIdentityAliveWithStartForTesting(
 *     { pid: process.pid, procStart: "proc:recorded-start" },
 *     O.none()
 *   )
 * )
 * console.log(alive) // true
 * ```
 *
 * @param owner - PID and recorded process start identity to inspect.
 * @param currentStart - Simulated current source-prefixed process identity.
 * @returns Whether the supplied identity remains live or inconclusive.
 * @category testing
 * @since 0.0.0
 */
export const isProcessIdentityAliveWithStartForTesting = Effect.fnUntraced(function* (
  owner: ProcessIdentityOwner,
  currentStart: O.Option<string>
): Effect.fn.Return<boolean> {
  return !ProcessIdentityStatus.is.dead(yield* processIdentityStatusWithStart(owner, Effect.succeed(currentStart)));
});
