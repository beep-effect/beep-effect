/**
 * The writer lock of the state directory: one writing command at a time.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeMailTaggingId } from "@beep/identity/packages";
import { Context, Effect, FileSystem, Layer, Path, Runtime } from "effect";
import * as DateTime from "effect/DateTime";
import { flow, identity } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
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
 * **Example** (Describe a holder)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { StateLockHolder } from "@/PracticeMailTagging.lock"
 *
 * const holder = StateLockHolder.make({
 *   pid: 4242,
 *   command: "watch",
 *   acquiredAt: DateTime.makeUnsafe("2026-07-01T09:00:00Z")
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

// `process.kill(pid, 0)` throws EPERM for a live process owned by another user.
const PermissionDenied = S.Struct({ code: S.Literal("EPERM") });

/**
 * Whether a failed liveness signal still proves the process exists.
 *
 * **Example** (Read a permission refusal)
 *
 * ```ts
 * import { signalRefusalMeansAlive } from "@/PracticeMailTagging.lock"
 *
 * console.log(signalRefusalMeansAlive({ code: "EPERM" })) // true
 * console.log(signalRefusalMeansAlive({ code: "ESRCH" })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const signalRefusalMeansAlive: (cause: unknown) => boolean = S.is(PermissionDenied);

/**
 * The current process and a liveness probe for other processes.
 *
 * **Example** (Ask whether a process runs)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { ProcessProbe } from "@/PracticeMailTagging.lock"
 *
 * const program = ProcessProbe.use((probe) => probe.isAlive(probe.pid))
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
    readonly isAlive: (pid: number) => Effect.Effect<boolean>;
  }
>()($I`ProcessProbe`) {}

/**
 * The probe over the running process: signal 0, which checks without
 * signalling.
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
export const ProcessProbeLive: Layer.Layer<ProcessProbe> = Layer.sync(ProcessProbe, () =>
  ProcessProbe.of({
    pid: process.pid,
    isAlive: Effect.fn("ProcessProbe.isAlive")((pid: number) =>
      Effect.try({ try: () => process.kill(pid, 0), catch: signalRefusalMeansAlive }).pipe(
        Effect.match({ onFailure: identity, onSuccess: () => true })
      )
    ),
  })
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
 * When the file exists, its recorded process is asked whether it still runs.
 * A dead holder's lock is stale: it is replaced once, with a warning naming
 * the old process id. A live holder, or a lock that cannot be read, fails
 * with {@link StateDirectoryLocked}.
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

  // Answers the holder when its process is gone; a live or unreadable holder is none.
  const staleHolder = (holder: O.Option<StateLockHolder>) =>
    O.match(holder, {
      onNone: () => Effect.succeedNone,
      onSome: (found) => Effect.map(probe.isAlive(found.pid), (alive) => O.liftPredicate(found, () => !alive)),
    });

  const takeOver = Effect.fn("StateLock.takeOver")(function* (command: string, stale: StateLockHolder) {
    yield* Effect.logWarning("taking over a stale state lock").pipe(
      Effect.annotateLogs({ lockPath, stalePid: stale.pid })
    );
    yield* Effect.ignore(fs.remove(lockPath));
    return yield* acquire(command, false);
  });

  const contend = Effect.fn("StateLock.contend")(function* (command: string, mayTakeOver: boolean) {
    const holder = yield* readHolder;
    const stale = O.filter(yield* staleHolder(holder), () => mayTakeOver);
    return yield* O.match(stale, {
      onNone: () =>
        Effect.fail(
          StateDirectoryLocked.held(
            lockPath,
            O.map(holder, (found) => found.pid)
          )
        ),
      onSome: (found) => takeOver(command, found),
    });
  });

  function acquire(
    command: string,
    mayTakeOver: boolean
  ): Effect.Effect<void, StateDirectoryLocked | PracticeMailTaggingError> {
    return Effect.gen(function* () {
      const acquiredAt = yield* DateTime.now;
      const text = yield* Effect.orDie(encodeHolder(StateLockHolder.make({ pid: probe.pid, command, acquiredAt })));
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
