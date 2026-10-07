/**
 * File-backed docket intake store proofs over an in-memory file system.
 *
 * Every fixture is synthetic: invented ids and placeholder text.
 */
import {
  DocketFileStoreOptions,
  DocketMatterLookupUnavailableLive,
  makeDocketFileStoreLayer,
  readDocketStateFile,
  writeDigestFile,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketIntakeState,
  DocketIntakeStore,
  DocketLedgerRecord,
  DocketMatterLookup,
  IntakeFailed,
  NotDocketItem,
} from "@beep/law-practice-use-cases/DocketIntake";
import { addDays, LocalDate, equals as sameDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Context, Effect, Exit, FileSystem, Layer, Path, Ref, Scope } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// A nested directory that does not exist yet: building the store has to create it.
const DIRECTORY = "/fixture/state/docket-intake";
const STATE_PATH = `${DIRECTORY}/state.json`;
const LOCK_PATH = `${DIRECTORY}/state.lock`;
const OWN_PID = "4242";
const BOOT_ID = "boot-a";
class OpenedFiles extends Context.Service()("@beep/law-practice-server/test/DocketIntake.store.test/OpenedFiles") {}
const OpenedFilesLayer = Layer.effect(
  OpenedFiles,
  Effect.gen(function* () {
    return OpenedFiles.of({
      opened: yield* Ref.make([]),
      written: yield* Ref.make([]),
    });
  })
);
const OWN_START = "1000";
// A `/proc/<pid>/stat` line. The command name holds spaces and parentheses on purpose: the start
// time is the twentieth field after the last closing parenthesis.
const statLine = (pid, startTime) =>
  `${pid} (docket) intake (x) S 1 1 1 0 -1 4194560 100 0 0 0 1 1 0 0 20 0 1 0 ${startTime} 1000 200\n`;
// Make a process look as if it is running.
const addProcess = Effect.fnUntraced(function* (fs, pid, startTime) {
  yield* fs.makeDirectory(`/proc/${pid}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${pid}/stat`, statLine(pid, startTime));
});
// An in-memory file system that looks like Linux to the store: `/proc/self` names this process,
// `/proc/<pid>/stat` exists for a running process, and the kernel reports a boot id. It also
// records which files are opened or written, so temporary file names are visible.
const fileSystemLayer = (bootId) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const memory = yield* MemoryFileSystem.make;
      const record = yield* OpenedFiles;
      yield* addProcess(memory, OWN_PID, OWN_START);
      yield* memory.symlink(OWN_PID, "/proc/self");
      yield* memory.makeDirectory("/proc/sys/kernel/random", { recursive: true });
      yield* Effect.forEach(O.toArray(bootId), (id) =>
        memory.writeFileString("/proc/sys/kernel/random/boot_id", `${id}\n`)
      );
      return {
        ...memory,
        open: (path, options) =>
          Ref.update(record.opened, A.append(path)).pipe(Effect.andThen(memory.open(path, options))),
        writeFileString: (path, data, options) =>
          Ref.update(record.written, A.append(path)).pipe(Effect.andThen(memory.writeFileString(path, data, options))),
      };
    }).pipe(Effect.orDie)
  );
const FilesLayer = fileSystemLayer(O.some(BOOT_ID)).pipe(
  Layer.provideMerge(OpenedFilesLayer),
  Layer.provideMerge(Path.layer)
);
const storeOptions = DocketFileStoreOptions.make({ directory: DIRECTORY });
const storeLayer = makeDocketFileStoreLayer(storeOptions).pipe(Layer.provideMerge(FilesLayer));
const LockFile = S.fromJsonString(
  S.Struct({ bootId: S.String, pid: S.String, startedAt: S.String, startTime: S.String })
);
const decodeLockFile = S.decodeUnknownOption(LockFile);
const encodeLockFile = S.encodeUnknownEffect(LockFile);
const lockText = (holder) => Effect.orDie(encodeLockFile({ ...holder, startedAt: "2030-01-09T10:00:00.000Z" }));
// Put a lock in place as another process would have left it.
const leaveLock = Effect.fnUntraced(function* (holder) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(DIRECTORY, { recursive: true });
  yield* fs.remove(LOCK_PATH, { force: true });
  yield* fs.writeFileString(LOCK_PATH, yield* lockText(holder));
});
const lockHolder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return O.map(decodeLockFile(yield* fs.readFileString(LOCK_PATH)), (lock) => [lock.pid, lock.bootId, lock.startTime]);
});
const OWN_HOLDER = [OWN_PID, BOOT_ID, OWN_START];
const OTHER = { bootId: BOOT_ID, pid: "777", startTime: "2000" };
const OTHER_HOLDER = [OTHER.pid, OTHER.bootId, OTHER.startTime];
// Files a lock attempt may leave beside the lock if it does not clean up.
const leftovers = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return A.filter(
    yield* fs.readDirectory(DIRECTORY),
    (name) => Str.endsWith(".tmp")(name) || Str.endsWith(".stale")(name)
  );
});
// Open the store in a scope of its own, hand back who holds the lock while it is open, and close
// the scope again.
const openAndClose = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const scope = yield* Scope.make();
  const context = yield* Layer.buildWithScope(makeDocketFileStoreLayer(storeOptions), scope);
  const empty = yield* Context.get(context, DocketIntakeStore).load;
  const holder = yield* lockHolder;
  yield* Scope.close(scope, Exit.void);
  return { empty, holder, lockedAfterClose: yield* fs.exists(LOCK_PATH) };
});
// The file system as another process sees it: the same files, its own process id, and hooks that
// let a test act at the exact moment the store moves a stale lock aside.
const processView = Effect.fnUntraced(function* (pid, hooks = {}) {
  const fs = yield* FileSystem.FileSystem;
  const renameLock = (oldPath, newPath) =>
    hooks.fail === true
      ? fs.rename(`${oldPath}.already-moved`, newPath)
      : (hooks.before ?? Effect.void).pipe(
          Effect.andThen(fs.rename(oldPath, newPath)),
          Effect.andThen(hooks.after ?? Effect.void)
        );
  return {
    ...fs,
    readLink: (path) => (path === "/proc/self" ? Effect.succeed(pid) : fs.readLink(path)),
    rename: (oldPath, newPath) => (oldPath === LOCK_PATH ? renameLock(oldPath, newPath) : fs.rename(oldPath, newPath)),
  };
});
// Try to open the store as the process behind a view; the scope stays open so a winner keeps
// its lock.
const openAs = Effect.fnUntraced(function* (scope, view) {
  return yield* failureOf(
    Layer.buildWithScope(
      makeDocketFileStoreLayer(storeOptions).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, view))),
      scope
    )
  );
});
// A state directory that takes no hard link, as a read-only or full one would not. `from` is the
// number of the first link call that fails; earlier ones reach the real file system.
const refusingLinks = Effect.fnUntraced(function* (from) {
  const fs = yield* FileSystem.FileSystem;
  const calls = yield* Ref.make(0);
  return {
    ...fs,
    link: (fromPath, toPath) =>
      Ref.updateAndGet(calls, (count) => count + 1).pipe(
        Effect.flatMap((call) =>
          call < from
            ? fs.link(fromPath, toPath)
            : Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  description: "fixture directory takes no hard link",
                  method: "link",
                  module: "FileSystem",
                })
              )
        )
      ),
  };
});
// Another starter's complete lock appears at the lock path.
const otherTakesLock = (fs) =>
  Effect.gen(function* () {
    yield* fs.remove(LOCK_PATH, { force: true });
    yield* fs.writeFileString(LOCK_PATH, yield* lockText(OTHER));
  }).pipe(Effect.orDie);
const failureOf = (effect) =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));
const day = LocalDate.make({ year: 2030, month: 1, day: 9 });
const state = DocketIntakeState.make({
  cursor: O.some("2030-01-09T10:01:00.000Z"),
  digestedThrough: O.some(day),
  ledger: {
    m1: DocketLedgerRecord.make({
      attempts: 1,
      outcome: NotDocketItem.make({ messageId: "m1" }),
      processedOn: day,
      receivedAt: "2030-01-09T10:00:00.000Z",
    }),
    m2: DocketLedgerRecord.make({
      attempts: 2,
      outcome: IntakeFailed.make({ messageId: "m2", stage: "review" }),
      processedOn: day,
      receivedAt: "2030-01-09T10:01:00.000Z",
    }),
  },
});
const sameState = S.toEquivalence(DocketIntakeState);
const GeneratedLedger = S.Struct({
  attempts: S.Natural,
  cursor: S.NonEmptyString,
  dayOffset: S.Int.check(S.isBetween({ maximum: 4000, minimum: 0 })),
  messageIds: S.Array(S.NonEmptyString),
});
describe("@beep/law-practice-server DocketIntake file store", () => {
  it.layer(storeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "loads empty state before anything is saved, then round-trips state without leaving a temporary file",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const fs = yield* FileSystem.FileSystem;
        const record = yield* OpenedFiles;
        const initial = yield* store.load;
        yield* store.save(state);
        const loaded = yield* store.load;
        const files = yield* fs.readDirectory(DIRECTORY);
        assertNone(initial.cursor);
        expect(R.keys(initial.ledger)).toStrictEqual([]);
        assertTrue(sameState(loaded, state));
        assertSome(loaded.cursor, "2030-01-09T10:01:00.000Z");
        assertTrue(O.exists(loaded.digestedThrough, (digested) => sameDate(digested, day)));
        expect(A.map(R.values(loaded.ledger), (record) => record.outcome._tag)).toStrictEqual([
          "NotDocketItem",
          "IntakeFailed",
        ]);
        expect(A.sort(files, Str.Order)).toStrictEqual(["state.json", "state.lock"]);
        // The lock is complete from the moment it exists: it is linked into place, never written there.
        assertSome(yield* lockHolder, OWN_HOLDER);
        expect(A.filter(yield* Ref.get(record.written), (path) => path === LOCK_PATH)).toStrictEqual([]);
        expect(yield* leftovers).toStrictEqual([]);
        expect(yield* Ref.get(record.opened)).toHaveLength(1);
      })
    );
  });
  it.layer(storeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reads the saved state without the lock, and empty state from a directory with none",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const empty = yield* readDocketStateFile("/fixture/state/elsewhere");
        yield* store.save(state);
        const read = yield* readDocketStateFile(DIRECTORY);
        expect(R.keys(empty.ledger)).toStrictEqual([]);
        assertTrue(sameState(read, state));
      })
    );
  });
  it.layer(storeLayer, { timeout: "10 seconds" })((it) => {
    it.effect.prop(
      "round-trips a ledger of any size, with any ids, cursor and attempt counts, through the state file",
      [Arbitrary.schema(GeneratedLedger)],
      Effect.fnUntraced(function* ([generated]) {
        const store = yield* DocketIntakeStore;
        const processedOn = addDays(day, generated.dayOffset);
        const expected = DocketIntakeState.make({
          cursor: O.some(generated.cursor),
          digestedThrough: O.some(processedOn),
          ledger: R.fromIterableWith(generated.messageIds, (messageId) => [
            messageId,
            DocketLedgerRecord.make({
              attempts: generated.attempts,
              outcome: IntakeFailed.make({ messageId, stage: "calendar" }),
              processedOn,
              receivedAt: generated.cursor,
            }),
          ]),
        });
        yield* store.save(expected);
        assertTrue(sameState(yield* store.load, expected));
      }),
      { arbitrary: fcRuns(25) }
    );
  });
  it.layer(storeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "writes a day's digest beside the state file",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = DIRECTORY;
        const file = yield* writeDigestFile({ day, directory, text: "Docket intake digest for 2030-01-09." });
        yield* writeDigestFile({ day, directory, text: "Docket intake digest for 2030-01-09, rewritten." });
        expect(file).toBe(path.join(directory, "digests", "2030-01-09.md"));
        expect(yield* fs.readFileString(file)).toBe("Docket intake digest for 2030-01-09, rewritten.");
        expect(yield* fs.readDirectory(path.join(directory, "digests"))).toStrictEqual(["2030-01-09.md"]);
      })
    );
  });
  it.layer(storeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails at the store stage on a state file it cannot decode, and leaves the file alone",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const statePath = path.join(DIRECTORY, "state.json");
        yield* fs.writeFileString(statePath, '{"ledger":{"m1":{"attempts":"many"}}');
        const failure = yield* failureOf(store.load);
        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "decode"]
        );
        expect(yield* fs.readFileString(statePath)).toBe('{"ledger":{"m1":{"attempts":"many"}}');
      })
    );
  });
  it.layer(storeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "writes each save to its own temporary file and leaves none behind",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const fs = yield* FileSystem.FileSystem;
        const record = yield* OpenedFiles;
        yield* store.save(state);
        yield* store.save(DocketIntakeState.make({}));
        const opened = yield* Ref.get(record.opened);
        expect(opened).toHaveLength(2);
        expect(A.dedupe(opened)).toHaveLength(2);
        assertTrue(
          A.every(opened, (name) => Str.startsWith(`${STATE_PATH}.${OWN_PID}.`)(name) && Str.endsWith(".tmp")(name))
        );
        expect(A.filter(yield* fs.readDirectory(DIRECTORY), Str.endsWith(".tmp"))).toStrictEqual([]);
        assertNone((yield* store.load).cursor);
      })
    );
  });
  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "refuses to open while another live process holds the lock, and leaves that lock alone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* addProcess(fs, OTHER.pid, OTHER.startTime);
        yield* leaveLock(OTHER);
        const failure = yield* failureOf(Layer.launch(makeDocketFileStoreLayer(storeOptions)));
        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "state-locked"]
        );
        assertSome(yield* lockHolder, OTHER_HOLDER);
        expect(yield* leftovers).toStrictEqual([]);
      })
    );
  });
  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "takes over a lock whose holder is gone, and releases its own lock when the scope closes",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The holder's process no longer exists.
        yield* leaveLock({ bootId: BOOT_ID, pid: "888", startTime: "2000" });
        const afterDeadProcess = yield* openAndClose;
        // The holder's process id is running with the same start time, but the lock is from before
        // the last boot.
        yield* addProcess(fs, "999", "2000");
        yield* leaveLock({ bootId: "boot-before", pid: "999", startTime: "2000" });
        const afterReboot = yield* openAndClose;
        // The holder's process id is running, but the kernel started that process at another time:
        // the id was reused.
        yield* addProcess(fs, "666", "3000");
        yield* leaveLock({ bootId: BOOT_ID, pid: "666", startTime: "2999" });
        const afterPidReuse = yield* openAndClose;
        // The lock names this very process id and start time, as after a restart in a fresh
        // process namespace.
        yield* leaveLock({ bootId: BOOT_ID, pid: OWN_PID, startTime: OWN_START });
        const afterOwnPid = yield* openAndClose;
        // The lock file is not a lock at all.
        yield* fs.remove(LOCK_PATH, { force: true });
        yield* fs.writeFileString(LOCK_PATH, "not a lock");
        const afterGarbage = yield* openAndClose;
        for (const opened of [afterDeadProcess, afterReboot, afterPidReuse, afterOwnPid, afterGarbage]) {
          assertSome(opened.holder, OWN_HOLDER);
          assertNone(opened.empty.cursor);
          expect(opened.lockedAfterClose).toBe(false);
        }
        expect(yield* leftovers).toStrictEqual([]);
      })
    );
  });
  it.layer(fileSystemLayer(O.none()).pipe(Layer.provideMerge(OpenedFilesLayer), Layer.provideMerge(Path.layer)), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "still locks on a system that reports no boot id",
      Effect.fnUntraced(function* () {
        const opened = yield* openAndClose;
        assertSome(opened.holder, [OWN_PID, "", OWN_START]);
        expect(opened.lockedAfterClose).toBe(false);
      })
    );
  });
  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "lets exactly one of two processes that start together take a stale lock",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const scope = yield* Scope.make();
        yield* addProcess(fs, "5151", "5000");
        yield* leaveLock({ bootId: BOOT_ID, pid: "888", startTime: "2000" });
        const first = yield* processView(OWN_PID);
        const second = yield* processView("5151");
        const [firstFailure, secondFailure] = yield* Effect.all([openAs(scope, first), openAs(scope, second)], {
          concurrency: 2,
        });
        const holder = yield* lockHolder;
        yield* Scope.close(scope, Exit.void);
        expect(A.map(A.getSomes([firstFailure, secondFailure]), (error) => [error.stage, error.cause])).toStrictEqual([
          ["store", "state-locked"],
        ]);
        // The lock names whichever process did not fail.
        assertSome(
          O.map(holder, (held) => held[0]),
          O.isSome(firstFailure) ? "5151" : OWN_PID
        );
        expect(yield* leftovers).toStrictEqual([]);
      })
    );
  });
  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "loses to a starter that moved, replaced or re-took the stale lock in the middle of a takeover",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const scope = yield* Scope.make();
        const stale = { bootId: BOOT_ID, pid: "888", startTime: "2000" };
        yield* addProcess(fs, OTHER.pid, OTHER.startTime);
        // Another starter already moved the stale lock away.
        yield* leaveLock(stale);
        const moved = yield* openAs(scope, yield* processView(OWN_PID, { fail: true }));
        // Another starter replaced the stale lock with its own just before this one moved it:
        // what was moved is not what was judged, so the other lock is put back.
        yield* leaveLock(stale);
        const replaced = yield* openAs(scope, yield* processView(OWN_PID, { before: otherTakesLock(fs) }));
        const afterReplaced = yield* lockHolder;
        // Another starter took the lock right after this one moved the stale lock away.
        yield* leaveLock(stale);
        const retaken = yield* openAs(scope, yield* processView(OWN_PID, { after: otherTakesLock(fs) }));
        const afterRetaken = yield* lockHolder;
        yield* Scope.close(scope, Exit.void);
        for (const failure of [moved, replaced, retaken]) {
          assertSome(
            O.map(failure, (error) => [error.stage, error.cause]),
            ["store", "state-locked"]
          );
        }
        assertSome(afterReplaced, OTHER_HOLDER);
        assertSome(afterRetaken, OTHER_HOLDER);
        expect(yield* leftovers).toStrictEqual([]);
      })
    );
  });
  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reports a state directory it cannot write the lock to as a lock failure, not as a held lock",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const scope = yield* Scope.make();
        // No lock exists: the link fails for another reason.
        const failure = yield* openAs(scope, yield* refusingLinks(1));
        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "lock"]
        );
        expect(yield* fs.exists(LOCK_PATH)).toBe(false);
        expect(yield* leftovers).toStrictEqual([]);
        yield* Scope.close(scope, Exit.void);
      })
    );
  });
  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reports the same failure when the lock cannot be written after a stale one was moved aside",
      Effect.fnUntraced(function* () {
        const scope = yield* Scope.make();
        yield* leaveLock(OTHER);
        // The first link fails because the stale lock exists; the second, in the takeover, cannot be written.
        const failure = yield* openAs(scope, yield* refusingLinks(2));
        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "lock"]
        );
        expect(yield* leftovers).toStrictEqual([]);
        yield* Scope.close(scope, Exit.void);
      })
    );
  });
  it.layer(DocketMatterLookupUnavailableLive, { timeout: "5 seconds" })((it) => {
    it.effect(
      "reports the matter lookup as not wired instead of answering",
      Effect.fnUntraced(function* () {
        const lookup = yield* DocketMatterLookup;
        const failure = yield* failureOf(lookup.lookup(["FIX-0001"]));
        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["lookup", "practice-kg-lookup-not-wired"]
        );
      })
    );
  });
});
