/**
 * File-backed durable state of the docket intake service, and the plain-text
 * archive of its daily digests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketIntakeError, DocketIntakeState, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import { thunkEmptyStr } from "@beep/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { LocalDate } from "@beep/schema/LocalDate";
import type * as PlatformError from "effect/PlatformError";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.store");

const STATE_FILE = "state.json";
const LOCK_FILE = "state.lock";
const DIGEST_DIRECTORY = "digests";

/**
 * **Example** (Make store options)
 *
 * ```ts
 * import { DocketFileStoreOptions } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketFileStoreOptions.make({ directory: "state/docket-intake" }).directory);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketFileStoreOptions extends S.Opaque<DocketFileStoreOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    directory: S.NonEmptyString.annotateKey({ description: "Directory that holds the state file and the digests." }),
  }).pipe(
    $I.annoteSchema("DocketFileStoreOptions", { description: "Settings of the file-backed docket intake store." })
  )
) {}

const StateJson = S.fromJsonString(DocketIntakeState);
const decodeState = S.decodeUnknownEffect(StateJson);
const encodeState = S.encodeUnknownEffect(StateJson);

const LockJson = S.fromJsonString(
  S.Struct({ bootId: S.String, pid: S.NonEmptyString, startedAt: S.String, startTime: S.String })
);
const decodeLock = S.decodeUnknownOption(LockJson);
const encodeLock = S.encodeUnknownEffect(LockJson);

const PROCESS_SELF = "/proc/self";
const BOOT_ID = "/proc/sys/kernel/random/boot_id";
const SUFFIX_RANGE = 0xffffffff;
const HEX = 16;
const STAT_START_TIME_FIELD = 22;
const STAT_FIELDS_THROUGH_COMM = 2;
const START_TIME_INDEX_AFTER_LAST_PAREN = STAT_START_TIME_FIELD - STAT_FIELDS_THROUGH_COMM - 1;

const storeError = (cause: string) => () => DocketIntakeError.make({ cause, stage: "store" });
const stateLocked = () => DocketIntakeError.make({ cause: "state-locked", stage: "store" });

const textEncoder = new TextEncoder();

const siblingNamedByPidAndRandomSoNoOtherProcessOrCallCollides = Effect.fnUntraced(function* (
  path: string,
  pid: string,
  kind: string
) {
  const suffix = (yield* Random.nextIntBetween(0, SUFFIX_RANGE)).toString(HEX);
  return `${path}.${pid}.${suffix}.${kind}`;
});

const writeAtomically = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  contents: string
): Effect.fn.Return<void, DocketIntakeError> {
  const pid = yield* fs.readLink(PROCESS_SELF).pipe(Effect.mapError(storeError("process-id")));
  const temporary = yield* siblingNamedByPidAndRandomSoNoOtherProcessOrCallCollides(path, pid, "tmp");
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(temporary, { flag: "wx", mode: 0o600 });
      yield* file.writeAll(textEncoder.encode(contents));
      yield* file.sync;
    })
  ).pipe(Effect.mapError(storeError("write")));
  yield* fs.rename(temporary, path).pipe(Effect.mapError(storeError("rename")));
});

const loadState = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  statePath: string
): Effect.fn.Return<DocketIntakeState, DocketIntakeError> {
  const exists = yield* fs.exists(statePath).pipe(Effect.mapError(storeError("stat")));
  if (!exists) {
    return DocketIntakeState.make({});
  }
  const contents = yield* fs.readFileString(statePath).pipe(Effect.mapError(storeError("read")));
  return yield* decodeState(contents).pipe(Effect.mapError(storeError("decode")));
});

type LockHolder = { readonly bootId: string; readonly pid: string; readonly startTime: string };

const readBootId = (fs: FileSystem.FileSystem): Effect.Effect<string> =>
  fs.readFileString(BOOT_ID).pipe(Effect.map(Str.trim), Effect.orElseSucceed(thunkEmptyStr));

const startTimeFromStat = (stat: string): O.Option<string> =>
  pipe(
    Str.lastIndexOf(")")(stat),
    O.map((commEnd) => Str.trim(Str.slice(commEnd + 1)(stat))),
    O.flatMap((fieldsAfterCommandName) =>
      A.get(Str.split(" ")(fieldsAfterCommandName), START_TIME_INDEX_AFTER_LAST_PAREN)
    )
  );

const currentProcessStartTime = (fs: FileSystem.FileSystem, pid: string): Effect.Effect<O.Option<string>> =>
  Effect.option(fs.readFileString(`/proc/${pid}/stat`)).pipe(Effect.map(O.flatMap(startTimeFromStat)));

const isAlive = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, self: LockHolder, holder: LockHolder) {
  const leftoverOfThisNotYetLockedProcess = holder.pid === self.pid;
  const fromAnotherBoot = holder.bootId !== self.bootId;
  if (leftoverOfThisNotYetLockedProcess || fromAnotherBoot) {
    return false;
  }
  const processStartTime1 = yield* currentProcessStartTime(fs, holder.pid);
  return O.contains(processStartTime1, holder.startTime);
});

const sameContents = O.makeEquivalence(Str.Equivalence);

const discard = (fs: FileSystem.FileSystem, path: string): Effect.Effect<void> =>
  fs.remove(path, { force: true }).pipe(Effect.ignore);

const lockWriteFailed = storeError("lock");

const lockHeldElsewhere = (error: PlatformError.PlatformError): boolean => error.reason._tag === "AlreadyExists";

const linkCompleteLockIntoPlace = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  lockPath: string,
  pid: string,
  contents: string
): Effect.fn.Return<boolean, DocketIntakeError> {
  const temporary = yield* siblingNamedByPidAndRandomSoNoOtherProcessOrCallCollides(lockPath, pid, "tmp");
  yield* fs.writeFileString(temporary, contents, { flag: "wx", mode: 0o600 }).pipe(Effect.mapError(lockWriteFailed));
  return yield* fs.link(temporary, lockPath).pipe(
    Effect.as(true),
    Effect.catchIf(lockHeldElsewhere, () => Effect.succeed(false)),
    Effect.mapError(lockWriteFailed),
    Effect.ensuring(discard(fs, temporary))
  );
});

const setJudgedStaleLockAsideOrRestoreReplacement = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  lockPath: string,
  aside: string,
  judged: O.Option<string>
): Effect.fn.Return<void, DocketIntakeError> {
  yield* fs.rename(lockPath, aside).pipe(Effect.mapError(stateLocked));
  const moved = yield* Effect.option(fs.readFileString(aside));
  if (!sameContents(moved, judged)) {
    yield* fs.link(aside, lockPath).pipe(Effect.ignore);
    yield* discard(fs, aside);
    return yield* stateLocked();
  }
});

const acquireLock = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  lockPath: string
): Effect.fn.Return<void, DocketIntakeError> {
  const pid = yield* fs.readLink(PROCESS_SELF).pipe(Effect.mapError(storeError("process-id")));
  const argument = yield* readBootId(fs);
  const processStartTime2 = yield* currentProcessStartTime(fs, pid);
  const self: LockHolder = {
    bootId: argument,
    pid,
    startTime: O.getOrElse(processStartTime2, thunkEmptyStr),
  };
  const now2 = yield* DateTime.now;
  const startedAt = DateTime.formatIso(now2);
  const contents = yield* encodeLock({ ...self, startedAt }).pipe(Effect.mapError(storeError("encode")));
  const place = linkCompleteLockIntoPlace(fs, lockPath, pid, contents);

  const takeOver = Effect.fnUntraced(function* () {
    const judged = yield* Effect.option(fs.readFileString(lockPath));
    const holder = O.flatMap(judged, decodeLock);
    const held = yield* O.match(holder, {
      onNone: () => Effect.succeed(false),
      onSome: (value) => isAlive(fs, self, value),
    });
    if (held) {
      return yield* stateLocked();
    }
    const aside = yield* siblingNamedByPidAndRandomSoNoOtherProcessOrCallCollides(lockPath, pid, "stale");
    yield* setJudgedStaleLockAsideOrRestoreReplacement(fs, lockPath, aside, judged);
    yield* Effect.logWarning("docket intake state lock taken over from a holder that is gone", {
      holderPid: O.getOrElse(
        O.map(holder, (value) => value.pid),
        () => "unreadable"
      ),
    });
    const placed = yield* place.pipe(Effect.ensuring(discard(fs, aside)));
    if (!placed) {
      return yield* stateLocked();
    }
  });

  const placed = yield* place;
  if (!placed) {
    yield* takeOver();
  }
});

/**
 * Build the file-backed docket intake store.
 *
 * **Details**
 *
 * State lives in `state.json` inside the directory, which is created when the
 * layer is built. A missing file loads as empty state. A file that does not
 * decode fails the load at stage `store`; it is never replaced by empty state,
 * because that would silently forget the cursor and the ledger.
 *
 * The layer holds `state.lock` in the directory for as long as its scope is
 * open, so one process writes the state at a time. A second process fails to
 * build with cause `state-locked`. A state directory the lock cannot be
 * written to fails with cause `lock`. A lock is taken over when its holder is
 * gone: the process id no longer exists, the kernel started the process that
 * has that id now at a different time, the lock is from an earlier boot, it
 * names this very process id, or it cannot be read. A killed service
 * therefore restarts on its own, including in a container where it gets the
 * same process id again. The lock is linked into place complete and a stale
 * one is renamed aside before it is replaced, so two starters cannot both
 * take it and a lock file is never seen half written.
 * Every save goes to a uniquely named temporary file that is synced to disk
 * before it replaces the state file.
 *
 * **Example** (Make the file store layer)
 *
 * ```ts
 * import { DocketFileStoreOptions, makeDocketFileStoreLayer } from "@beep/law-practice-server/DocketIntake";
 *
 * const layer = makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: "state/docket-intake" }));
 * console.log(layer);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketFileStoreLayer = (
  options: DocketFileStoreOptions
): Layer.Layer<DocketIntakeStore, DocketIntakeError, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    DocketIntakeStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const statePath = path.join(options.directory, STATE_FILE);
      const lockPath = path.join(options.directory, LOCK_FILE);
      yield* fs
        .makeDirectory(options.directory, { recursive: true, mode: 0o700 })
        .pipe(Effect.andThen(fs.chmod(options.directory, 0o700)), Effect.mapError(storeError("directory")));
      yield* Effect.acquireRelease(acquireLock(fs, lockPath), () => discard(fs, lockPath));

      return DocketIntakeStore.of({
        load: loadState(fs, statePath).pipe(Effect.withSpan("DocketFileStore.load")),
        save: Effect.fn("DocketFileStore.save")(function* (state) {
          const contents = yield* encodeState(state).pipe(Effect.mapError(storeError("encode")));
          yield* writeAtomically(fs, statePath, contents);
        }),
      });
    }).pipe(Effect.withSpan("DocketFileStore.make"))
  );

/**
 * Save the text of one day's digest as `digests/<YYYY-MM-DD>.md` under the
 * store directory, replacing an earlier file for the same day.
 *
 * **Example** (Write a digest file)
 *
 * ```ts
 * import { writeDigestFile } from "@beep/law-practice-server/DocketIntake";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const program = writeDigestFile({
 *   day: LocalDate.make({ year: 2030, month: 1, day: 9 }),
 *   directory: "state/docket-intake",
 *   text: "Docket intake digest for 2030-01-09."
 * });
 * console.log(program);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const writeDigestFile: (input: {
  readonly day: LocalDate;
  readonly directory: string;
  readonly text: string;
}) => Effect.Effect<string, DocketIntakeError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocketFileStore.writeDigestFile"
)(function* (input) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const digests = path.join(input.directory, DIGEST_DIRECTORY);
  const file = path.join(digests, `${input.day.toISOString()}.md`);
  yield* fs
    .makeDirectory(digests, { recursive: true, mode: 0o700 })
    .pipe(Effect.andThen(fs.chmod(digests, 0o700)), Effect.mapError(storeError("directory")));
  yield* writeAtomically(fs, file, input.text);
  return file;
});

/**
 * Read the saved state of a state directory without taking its lock, for a
 * command that only looks.
 *
 * **Details**
 *
 * State is replaced by an atomic rename, so a read never sees a half-written
 * file even while a running service holds the lock. A missing file reads as
 * empty state; a file that does not decode fails at stage `store`.
 *
 * **Example** (Read the saved state)
 *
 * ```ts
 * import { readDocketStateFile } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(readDocketStateFile("state/docket-intake"));
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readDocketStateFile: (
  directory: string
) => Effect.Effect<DocketIntakeState, DocketIntakeError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocketFileStore.readStateFile"
)(function* (directory) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* loadState(fs, path.join(directory, STATE_FILE));
});
