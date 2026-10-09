/**
 * The writer lock of the state directory: one writing command at a time.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeMailTaggingId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeMailTaggingError } from "./PracticeMailTagging.errors.ts";
import type { PlatformError } from "effect/PlatformError";
import type * as Scope from "effect/Scope";

const $I = $PracticeMailTaggingId.create("PracticeMailTagging.lock");

/**
 * Name of the lock file inside the state directory.
 *
 * **Example** (Name the lock file)
 *
 * ```ts
 * import { stateLockFileName } from "@/PracticeMailTagging.lock"
 *
 * console.log(stateLockFileName) // "writer.lock"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const stateLockFileName = "writer.lock";

const ProcessId = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive process id" })).annotate({
  identifier: $I`ProcessId`,
  title: "ProcessId",
  description: "Operating-system id of a running process; an integer greater than zero.",
});

/**
 * Who holds the state directory: the content of the lock file.
 *
 * **Details**
 *
 * A process id alone does not identify a process: after a crash, a reboot, or
 * in a container it can belong to another process, or to the one reading the
 * lock. The boot id and the holder's start time pin it down. Both are
 * optional so a lock written before they existed still decodes; such a lock
 * is treated as stale.
 *
 * **Example** (Describe a holder)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { StateLockHolder } from "@/PracticeMailTagging.lock"
 *
 * import * as O from "effect/Option"
 *
 * const holder = StateLockHolder.make({
 *   pid: 4242,
 *   command: "watch",
 *   acquiredAt: DateTime.makeUnsafe("2026-07-01T09:00:00Z"),
 *   bootId: O.some("boot-0001"),
 *   startTime: O.some("123456")
 * })
 * console.log(holder.command) // "watch"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StateLockHolder extends S.Class<StateLockHolder>($I`StateLockHolder`)(
  {
    pid: ProcessId.annotateKey({
      description: "Process id of the writing command.",
    }),
    command: S.NonEmptyString.annotateKey({
      description: "Subcommand that took the lock.",
    }),
    acquiredAt: S.DateTimeUtcFromString.annotateKey({
      description: "When the lock was taken.",
    }),
    bootId: S.OptionFromNullOr(S.NonEmptyString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Kernel boot id when the lock was taken; none when it could not be read.",
      }),
    startTime: S.OptionFromNullOr(S.NonEmptyString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Start time of the holder process in clock ticks since boot; none when it could not be read.",
      }),
  },
  $I.annote("StateLockHolder", {
    description: "Content of the state-directory writer lock.",
  })
) {}

const StateLockHolderJson = S.fromJsonString(StateLockHolder);
const encodeHolder = S.encodeEffect(StateLockHolderJson);
const decodeHolder = S.decodeUnknownEffect(StateLockHolderJson);

/**
 * Another writing command holds the state directory.
 *
 * **Details**
 *
 * The process exits with code 4. The message names the lock file and the
 * holder's process id only. Under systemd the unit is restarted later, which
 * is right: the holder is usually an attended `apply` or `undo`.
 *
 * **Example** (Describe a held lock)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { StateDirectoryLocked } from "@/PracticeMailTagging.lock"
 *
 * const error = StateDirectoryLocked.held("/state/writer.lock", O.some(4242))
 * console.log(error.message) // "another writer holds the state directory: /state/writer.lock (pid 4242)"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StateDirectoryLocked extends S.TaggedError<StateDirectoryLocked>($I`StateDirectoryLocked`)(
  "StateDirectoryLocked",
  {
    lockPath: S.NonEmptyString.annotateKey({
      description: "Lock file that is held.",
    }),
    holderPid: S.Option(ProcessId).annotateKey({
      description: "Process id recorded in the lock; none when the file could not be read.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Names the lock file and the holder's process id.",
    }),
  },
  $I.annoteError<StateDirectoryLocked>("StateDirectoryLocked", {
    title: "State directory locked",
    description: "Another writing command holds the mail-tagging state directory.",
  })
) {
  /**
   * Exit code the platform runner ends the process with.
   *
   * @returns Always 4.
   * @category getters
   * @since 0.0.0
   */
  override get [Runtime.errorExitCode](): number {
    return 4;
  }

  /**
   * Builds the failure for a lock another process holds.
   *
   * @param lockPath - Lock file that is held.
   * @param holderPid - Process id recorded in the lock, when readable.
   * @returns The typed failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly held = (lockPath: string, holderPid: O.Option<number>): StateDirectoryLocked =>
    StateDirectoryLocked.make({
      lockPath,
      holderPid,
      message: `another writer holds the state directory: ${lockPath} (pid ${O.getOrElse(
        O.map(holderPid, (pid) => `${pid}`),
        () => "unknown"
      )})`,
    });
}

const bootIdPath = "/proc/sys/kernel/random/boot_id";

/**
 * Reads the start time of a process from the text of its `/proc/<pid>/stat`.
 *
 * **Details**
 *
 * The start time is field 22, counted in clock ticks since boot. The process
 * name in field 2 may contain spaces and parentheses, so fields are counted
 * from the last closing parenthesis.
 *
 * **Example** (Read a start time)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { procStatStartTime } from "@/PracticeMailTagging.lock"
 *
 * const stat = "42 (bun (worker)) S 1 42 42 0 -1 4194560 1 0 0 0 0 0 0 0 20 0 1 0 987654 0 0"
 * console.log(O.getOrElse(procStatStartTime(stat), () => "none")) // "987654"
 * ```
 *
 * @param stat - Text of `/proc/<pid>/stat`.
 * @returns The start time; none when the text is not a stat line.
 * @category parsing
 * @since 0.0.0
 */
export const procStatStartTime = (stat: string): O.Option<string> =>
  O.flatMap(Str.lastIndexOf(")")(stat), (close) =>
    A.get(A.filter(Str.split(Str.trim(Str.slice(close + 1)(stat)), /\s+/u), Str.isNonEmpty), 19)
  );

/**
 * The current process and the identity of any process: the kernel boot id and
 * a process's start time.
 *
 * **Example** (Read this process's identity)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { ProcessProbe } from "@/PracticeMailTagging.lock"
 *
 * const program = ProcessProbe.use((probe) => probe.startTime(probe.pid))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProcessProbe extends Context.Service<
  ProcessProbe,
  {
    readonly pid: number;
    readonly bootId: Effect.Effect<O.Option<string>>;
    readonly startTime: (pid: number) => Effect.Effect<O.Option<string>>;
  }
>()($I`ProcessProbe`) {}

/**
 * The probe over the running process and Linux `/proc`, read through the
 * platform file system.
 *
 * **Details**
 *
 * A file that cannot be read, or holds no usable value, answers none: a
 * process that no longer exists has no start time, and a machine without
 * `/proc` has no identity at all.
 *
 * **Example** (Reference the live probe)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { ProcessProbeLive } from "@/PracticeMailTagging.lock"
 *
 * console.log(Layer.isLayer(ProcessProbeLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProcessProbeLive: Layer.Layer<ProcessProbe, never, FileSystem.FileSystem> = Layer.effect(
  ProcessProbe,
  Effect.map(FileSystem.FileSystem, (fs) =>
    ProcessProbe.of({
      pid: process.pid,
      bootId: fs
        .readFileString(bootIdPath)
        .pipe(Effect.map(flow(Str.trim, O.liftPredicate(Str.isNonEmpty))), Effect.orElseSucceed(O.none)),
      startTime: Effect.fn("ProcessProbe.startTime")((pid: number) =>
        fs.readFileString(`/proc/${pid}/stat`).pipe(Effect.map(procStatStartTime), Effect.orElseSucceed(O.none))
      ),
    })
  )
);

const StaleLockReason = LiteralKit(["own-pid", "identity-missing", "boot-changed", "process-changed"]).pipe(
  $I.annoteSchema("StaleLockReason", {
    description: "Why a lock no longer proves a live writer.",
  })
);

type StaleLockReason = typeof StaleLockReason.Type;

type Observation = {
  readonly holder: StateLockHolder;
  readonly ownPid: number;
  readonly bootId: O.Option<string>;
  readonly startTime: O.Option<string>;
};

const sameValue = O.makeEquivalence(Str.Equivalence);

// Checked in order; the first that holds names the reason. None of them holding means a live writer.
const staleChecks: ReadonlyArray<readonly [StaleLockReason, (observed: Observation) => boolean]> = [
  ["own-pid", (observed) => observed.holder.pid === observed.ownPid],
  [
    "identity-missing",
    (observed) => O.isNone(O.all([observed.holder.bootId, observed.holder.startTime, observed.bootId])),
  ],
  ["boot-changed", (observed) => !sameValue(observed.holder.bootId, observed.bootId)],
  ["process-changed", (observed) => !sameValue(observed.holder.startTime, observed.startTime)],
];

const staleReason = (observed: Observation): O.Option<StaleLockReason> =>
  O.map(
    A.findFirst(staleChecks, ([, holds]) => holds(observed)),
    ([reason]) => reason
  );

/**
 * The writer lock of one state directory.
 *
 * **Example** (Hold the lock for a command)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { StateLock } from "@/PracticeMailTagging.lock"
 *
 * const program = Effect.scoped(StateLock.use((lock) => lock.hold("apply")))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StateLock extends Context.Service<
  StateLock,
  {
    readonly hold: (
      command: string
    ) => Effect.Effect<void, StateDirectoryLocked | PracticeMailTaggingError, Scope.Scope>;
  }
>()($I`StateLock`) {}

const isAlreadyExists = (error: PlatformError): boolean => P.isTagged(error.reason, "AlreadyExists");

/**
 * Builds the writer lock of a state directory.
 *
 * **Details**
 *
 * `hold` creates `writer.lock` with exclusive-create semantics and removes it
 * when the caller's scope closes, after success, failure, or interruption.
 * When the file exists, the lock is held only when its recorded process is
 * another process, the machine has not rebooted since (same boot id), and
 * the process at that id started when the recorded one did (same start
 * time). Anything else, including a lock without those fields, is stale: it
 * is replaced once, with a warning naming the old process id and the reason.
 * A lock that cannot be read fails with {@link StateDirectoryLocked}.
 *
 * **Gotchas**
 *
 * Two processes that find the same stale lock at the same instant can both
 * replace it. The window is the time between reading and removing the file.
 *
 * **Example** (Build the lock over a directory)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeStateLock } from "@/PracticeMailTagging.lock"
 *
 * console.log(Effect.isEffect(makeStateLock("state/practice-mail-tagging"))) // true
 * ```
 *
 * @param stateDirectory - Directory the lock guards.
 * @returns An effect answering the lock service.
 * @category constructors
 * @since 0.0.0
 */
export const makeStateLock = Effect.fn("StateLock.make")(function* (stateDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const probe = yield* ProcessProbe;
  const lockPath = path.join(stateDirectory, stateLockFileName);

  const unwritable = (error: PlatformError) =>
    PracticeMailTaggingError.make({
      kind: "failed",
      source: "StateLock",
      message: `cannot create the state lock at ${lockPath}: ${error.reason._tag}`,
    });

  const readHolder = fs.readFileString(lockPath).pipe(Effect.flatMap(decodeHolder), Effect.option);

  const observe = Effect.fn("StateLock.observe")(function* (holder: StateLockHolder) {
    const bootId = yield* probe.bootId;
    const startTime = yield* probe.startTime(holder.pid);
    return staleReason({ holder, ownPid: probe.pid, bootId, startTime });
  });

  const takeOver = Effect.fn("StateLock.takeOver")(function* (
    command: string,
    stale: StateLockHolder,
    reason: StaleLockReason
  ) {
    yield* Effect.logWarning("taking over a stale state lock").pipe(
      Effect.annotateLogs({ lockPath, stalePid: stale.pid, reason })
    );
    yield* Effect.ignore(fs.remove(lockPath));
    return yield* acquire(command, false);
  });

  const contend = Effect.fn("StateLock.contend")(function* (command: string, mayTakeOver: boolean) {
    const holder = yield* readHolder;
    const reason = O.filter(
      yield* O.match(holder, { onNone: () => Effect.succeedNone, onSome: observe }),
      () => mayTakeOver
    );
    return yield* O.match(O.all([holder, reason]), {
      onNone: () =>
        Effect.fail(
          StateDirectoryLocked.held(
            lockPath,
            O.map(holder, (found) => found.pid)
          )
        ),
      onSome: ([found, why]) => takeOver(command, found, why),
    });
  });

  function acquire(
    command: string,
    mayTakeOver: boolean
  ): Effect.Effect<void, StateDirectoryLocked | PracticeMailTaggingError> {
    return Effect.gen(function* () {
      const acquiredAt = yield* DateTime.now;
      const bootId = yield* probe.bootId;
      const startTime = yield* probe.startTime(probe.pid);
      const text = yield* Effect.orDie(
        encodeHolder(StateLockHolder.make({ pid: probe.pid, command, acquiredAt, bootId, startTime }))
      );
      yield* Effect.mapError(fs.makeDirectory(stateDirectory, { recursive: true }), unwritable);
      yield* fs
        .writeFileString(lockPath, text, { flag: "wx" })
        .pipe(Effect.catchIf(isAlreadyExists, () => contend(command, mayTakeOver), flow(unwritable, Effect.fail)));
    }).pipe(Effect.withSpan("StateLock.acquire"));
  }

  return StateLock.of({
    hold: Effect.fn("StateLock.hold")((command: string) =>
      Effect.acquireRelease(acquire(command, true), () => Effect.ignore(fs.remove(lockPath)))
    ),
  });
});
