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
import { DateTime, Effect, FileSystem, Layer, Path, pipe, Random } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.store");
const STATE_FILE = "state.json";
const LOCK_FILE = "state.lock";
const DIGEST_DIRECTORY = "digests";
/**
 * Settings of the file-backed docket intake store.
 *
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
export class DocketFileStoreOptions extends S.Class($I`DocketFileStoreOptions`)(
  {
    directory: S.NonEmptyString.annotateKey({ description: "Directory that holds the state file and the digests." }),
  },
  $I.annote("DocketFileStoreOptions", { description: "Settings of the file-backed docket intake store." })
) {}
const StateJson = S.fromJsonString(DocketIntakeState);
const decodeState = S.decodeUnknownEffect(StateJson);
const encodeState = S.encodeUnknownEffect(StateJson);
// Who holds the state directory: the process, the boot it belongs to, when the kernel started it,
// and when it took the lock. A process id alone does not name a process: ids are reused after a
// reboot, and a restarted container often gets the same id again. The boot id and the kernel's
// start time for that id are what tell a live holder from a leftover.
const LockJson = S.fromJsonString(
  S.Struct({ bootId: S.String, pid: S.NonEmptyString, startedAt: S.String, startTime: S.String })
);
const decodeLock = S.decodeUnknownOption(LockJson);
const encodeLock = S.encodeUnknownEffect(LockJson);
const PROCESS_SELF = "/proc/self";
const BOOT_ID = "/proc/sys/kernel/random/boot_id";
const SUFFIX_RANGE = 0xffffffff;
const HEX = 16;
// `/proc/<pid>/stat` is "pid (comm) state ...": the start time is field 22, the twentieth field
// after the command name. The command name can itself hold spaces and parentheses, so fields are
// counted from the last closing parenthesis.
const START_TIME_AFTER_COMM = 19;
const storeError = (cause) => () => DocketIntakeError.make({ cause, stage: "store" });
const stateLocked = () => DocketIntakeError.make({ cause: "state-locked", stage: "store" });
const textEncoder = new TextEncoder();
// A name beside `path` that no other process and no other call uses.
const uniqueName = Effect.fnUntraced(function* (path, pid, kind) {
  const suffix = (yield* Random.nextIntBetween(0, SUFFIX_RANGE)).toString(HEX);
  return `${path}.${pid}.${suffix}.${kind}`;
});
// Write beside the target under a name no other writer uses, flush it to disk, and rename it
// over the target: a reader never sees a half-written file, and a crash leaves the old one.
const writeAtomically = Effect.fnUntraced(function* (fs, path, contents) {
  const pid = yield* fs.readLink(PROCESS_SELF).pipe(Effect.mapError(storeError("process-id")));
  const temporary = yield* uniqueName(path, pid, "tmp");
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(temporary, { flag: "wx" });
      yield* file.writeAll(textEncoder.encode(contents));
      yield* file.sync;
    })
  ).pipe(Effect.mapError(storeError("write")));
  yield* fs.rename(temporary, path).pipe(Effect.mapError(storeError("rename")));
});
// The saved state, or empty state when nothing has been saved. A file that does not decode fails.
const loadState = Effect.fnUntraced(function* (fs, statePath) {
  const exists = yield* fs.exists(statePath).pipe(Effect.mapError(storeError("stat")));
  if (!exists) {
    return DocketIntakeState.make({});
  }
  const contents = yield* fs.readFileString(statePath).pipe(Effect.mapError(storeError("read")));
  return yield* decodeState(contents).pipe(Effect.mapError(storeError("decode")));
});
const readBootId = (fs) => fs.readFileString(BOOT_ID).pipe(Effect.map(Str.trim), Effect.orElseSucceed(thunkEmptyStr));
const startTimeFromStat = (stat) =>
  pipe(
    Str.lastIndexOf(")")(stat),
    O.flatMap((index) => A.get(Str.split(" ")(Str.trim(Str.slice(index + 1)(stat))), START_TIME_AFTER_COMM))
  );
// When the kernel started the process that has this id now, if there is one.
const processStartTime = (fs, pid) =>
  Effect.option(fs.readFileString(`/proc/${pid}/stat`)).pipe(Effect.map(O.flatMap(startTimeFromStat)));
// A holder is alive when it is another process of this boot and the process that has its id now
// is the one that took the lock. A lock naming this very process id is a leftover: this process
// has only just started and has not taken the lock yet.
const isAlive = Effect.fnUntraced(function* (fs, self, holder) {
  if (holder.pid === self.pid || holder.bootId !== self.bootId) {
    return false;
  }
  return O.contains(yield* processStartTime(fs, holder.pid), holder.startTime);
});
const sameContents = O.makeEquivalence(Str.Equivalence);
const discard = (fs, path) => fs.remove(path, { force: true }).pipe(Effect.ignore);
const lockWriteFailed = storeError("lock");
const lockExists = (error) => error.reason._tag === "AlreadyExists";
// Put the complete lock in place in one step: write it under a unique name, then hard-link that
// name to the lock path. The lock file is never visible empty or half written. The answer is
// whether the lock was placed: linking fails when the lock path exists, and only that failure
// means someone else holds the lock. A directory that cannot be written (read-only, full, no hard
// links) is not a held lock, and fails with cause `lock`.
const placeLock = Effect.fnUntraced(function* (fs, lockPath, pid, contents) {
  const temporary = yield* uniqueName(lockPath, pid, "tmp");
  yield* fs.writeFileString(temporary, contents, { flag: "wx" }).pipe(Effect.mapError(lockWriteFailed));
  return yield* fs.link(temporary, lockPath).pipe(
    Effect.as(true),
    Effect.catchIf(lockExists, () => Effect.succeed(false)),
    Effect.mapError(lockWriteFailed),
    Effect.ensuring(discard(fs, temporary))
  );
});
// Move a lock judged stale out of the way, and make sure the file that was moved is the one that
// was judged. If another starter replaced it in between, its lock is put back and this one loses.
const setStaleLockAside = Effect.fnUntraced(function* (fs, lockPath, aside, judged) {
  yield* fs.rename(lockPath, aside).pipe(Effect.mapError(stateLocked));
  const moved = yield* Effect.option(fs.readFileString(aside));
  if (!sameContents(moved, judged)) {
    yield* fs.link(aside, lockPath).pipe(Effect.ignore);
    yield* discard(fs, aside);
    return yield* stateLocked();
  }
});
const acquireLock = Effect.fnUntraced(function* (fs, lockPath) {
  const pid = yield* fs.readLink(PROCESS_SELF).pipe(Effect.mapError(storeError("process-id")));
  const self = {
    bootId: yield* readBootId(fs),
    pid,
    startTime: O.getOrElse(yield* processStartTime(fs, pid), thunkEmptyStr),
  };
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const contents = yield* encodeLock({ ...self, startedAt }).pipe(Effect.mapError(storeError("encode")));
  const place = placeLock(fs, lockPath, pid, contents);
  // Taking over a dead holder's lock is what lets the service restart unattended after it was
  // killed without a chance to clean up.
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
    const aside = yield* uniqueName(lockPath, pid, "stale");
    yield* setStaleLockAside(fs, lockPath, aside, judged);
    yield* Effect.logWarning("docket intake state lock taken over from a holder that is gone", {
      holderPid: O.getOrElse(
        O.map(holder, (value) => value.pid),
        () => "unreadable"
      ),
    });
    // Another starter can still win here: its lock is then the one in place.
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
export const makeDocketFileStoreLayer = (options) =>
  Layer.effect(
    DocketIntakeStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const statePath = path.join(options.directory, STATE_FILE);
      const lockPath = path.join(options.directory, LOCK_FILE);
      yield* fs.makeDirectory(options.directory, { recursive: true }).pipe(Effect.mapError(storeError("directory")));
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
export const writeDigestFile = Effect.fn("DocketFileStore.writeDigestFile")(function* (input) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const digests = path.join(input.directory, DIGEST_DIRECTORY);
  const file = path.join(digests, `${input.day.toISOString()}.md`);
  yield* fs.makeDirectory(digests, { recursive: true }).pipe(Effect.mapError(storeError("directory")));
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
export const readDocketStateFile = Effect.fn("DocketFileStore.readStateFile")(function* (directory) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* loadState(fs, path.join(directory, STATE_FILE));
});
