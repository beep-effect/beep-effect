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
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { addDays, LocalDate, equals as sameDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";

const UNCREATED_NESTED_DIRECTORY = "/fixture/state/docket-intake";
const STATE_PATH = `${UNCREATED_NESTED_DIRECTORY}/state.json`;
const LOCK_PATH = `${UNCREATED_NESTED_DIRECTORY}/state.lock`;
const OWN_PID = "4242";
const BOOT_ID = "boot-a";

type OpenedFilesShape = {
  readonly openedForWritingInOrder: Ref.Ref<ReadonlyArray<string>>;
  readonly writtenInOneCallInOrder: Ref.Ref<ReadonlyArray<string>>;
};

class OpenedFiles extends Context.Service<OpenedFiles, OpenedFilesShape>()(
  "@beep/law-practice-server/test/DocketIntake.store.test/OpenedFiles"
) {}

const OpenedFilesLayer = Layer.effect(
  OpenedFiles,
  Effect.gen(function* () {
    return OpenedFiles.of({
      openedForWritingInOrder: yield* Ref.make<ReadonlyArray<string>>([]),
      writtenInOneCallInOrder: yield* Ref.make<ReadonlyArray<string>>([]),
    });
  })
);

const OWN_START = "1000";

const statLineWithSpacedParenthesizedCommand = (pid: string, startTime: string): string =>
  `${pid} (docket) intake (x) S 1 1 1 0 -1 4194560 100 0 0 0 1 1 0 0 20 0 1 0 ${startTime} 1000 200\n`;

const addRunningProcess = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, pid: string, startTime: string) {
  yield* fs.makeDirectory(`/proc/${pid}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${pid}/stat`, statLineWithSpacedParenthesizedCommand(pid, startTime));
});

const linuxLikeRecordingFileSystemLayer = (bootId: O.Option<string>) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const memory = yield* MemoryFileSystem.make;
      const record = yield* OpenedFiles;
      yield* addRunningProcess(memory, OWN_PID, OWN_START);
      yield* memory.symlink(OWN_PID, "/proc/self");
      yield* memory.makeDirectory("/proc/sys/kernel/random", { recursive: true });
      yield* Effect.forEach(
        O.toArray(bootId),
        (id) => memory.writeFileString("/proc/sys/kernel/random/boot_id", `${id}\n`),
        { concurrency: 1 }
      );
      return {
        ...memory,
        open: (path, options) =>
          Ref.update(record.openedForWritingInOrder, A.append(path)).pipe(Effect.andThen(memory.open(path, options))),
        writeFileString: (path, data, options) =>
          Ref.update(record.writtenInOneCallInOrder, A.append(path)).pipe(
            Effect.andThen(memory.writeFileString(path, data, options))
          ),
      } satisfies FileSystem.FileSystem;
    }).pipe(Effect.orDie)
  );

const FilesLayer = linuxLikeRecordingFileSystemLayer(O.some(BOOT_ID)).pipe(
  Layer.provideMerge(OpenedFilesLayer),
  Layer.provideMerge(Path.layer)
);

const storeOptions = DocketFileStoreOptions.make({ directory: UNCREATED_NESTED_DIRECTORY });

const storeLayer = makeDocketFileStoreLayer(storeOptions).pipe(Layer.provideMerge(FilesLayer));

const LockFile = S.fromJsonString(
  S.Struct({ bootId: S.String, pid: S.String, startedAt: S.String, startTime: S.String })
);
const decodeLockFile = S.decodeUnknownOption(LockFile);
const encodeLockFile = S.encodeUnknownEffect(LockFile);

type Holder = { readonly bootId: string; readonly pid: string; readonly startTime: string };

const lockText = (holder: Holder) => Effect.orDie(encodeLockFile({ ...holder, startedAt: "2030-01-09T10:00:00.000Z" }));

const leaveLockBehind = Effect.fnUntraced(function* (holder: Holder) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(UNCREATED_NESTED_DIRECTORY, { recursive: true });
  yield* fs.remove(LOCK_PATH, { force: true });
  const lockText1 = yield* lockText(holder);
  yield* fs.writeFileString(LOCK_PATH, lockText1);
});

const lockHolder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const readFileString2 = yield* fs.readFileString(LOCK_PATH);
  return O.map(decodeLockFile(readFileString2), (lock) => [lock.pid, lock.bootId, lock.startTime]);
});

const OWN_HOLDER = [OWN_PID, BOOT_ID, OWN_START];
const OTHER: Holder = { bootId: BOOT_ID, pid: "777", startTime: "2000" };
const OTHER_HOLDER = [OTHER.pid, OTHER.bootId, OTHER.startTime];

const uncleanedTmpOrStaleFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const readDirectory3 = yield* fs.readDirectory(UNCREATED_NESTED_DIRECTORY);
  return A.filter(readDirectory3, (name) => Str.endsWith(".tmp")(name) || Str.endsWith(".stale")(name));
});

const openInOwnScopeThenClose = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const scope = yield* Scope.make();
  const context = yield* Layer.buildWithScope(makeDocketFileStoreLayer(storeOptions), scope);
  const empty = yield* Context.get(context, DocketIntakeStore).load;
  const holder = yield* lockHolder;
  yield* Scope.close(scope, Exit.void);
  return { empty, holder, lockedAfterClose: yield* fs.exists(LOCK_PATH) };
});

type RenameHooks = {
  readonly beforeLockRename?: Effect.Effect<void>;
  readonly afterLockRename?: Effect.Effect<void>;
  readonly lockAlreadyMovedByOtherStarter?: boolean;
};

const sharedFilesAsProcessWithLockRenameHooks = Effect.fnUntraced(function* (pid: string, hooks: RenameHooks = {}) {
  const fs = yield* FileSystem.FileSystem;
  const renameLock = (oldPath: string, newPath: string) =>
    hooks.lockAlreadyMovedByOtherStarter === true
      ? fs.rename(`${oldPath}.already-moved`, newPath)
      : (hooks.beforeLockRename ?? Effect.void).pipe(
          Effect.andThen(fs.rename(oldPath, newPath)),
          Effect.andThen(hooks.afterLockRename ?? Effect.void)
        );
  return {
    ...fs,
    readLink: (path) => (path === "/proc/self" ? Effect.succeed(pid) : fs.readLink(path)),
    rename: (oldPath, newPath) => (oldPath === LOCK_PATH ? renameLock(oldPath, newPath) : fs.rename(oldPath, newPath)),
  } satisfies FileSystem.FileSystem;
});

const tryOpenAsProcessKeepingScopeOpen = Effect.fnUntraced(function* (scope: Scope.Scope, view: FileSystem.FileSystem) {
  return yield* failureOf(
    Layer.buildWithScope(
      makeDocketFileStoreLayer(storeOptions).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, view))),
      scope
    )
  );
});

const refusingLinksFromCall = Effect.fnUntraced(function* (firstRefusedLinkCall: number) {
  const fs = yield* FileSystem.FileSystem;
  const calls = yield* Ref.make(0);
  return {
    ...fs,
    link: (fromPath, toPath) =>
      Ref.updateAndGet(calls, (count) => count + 1).pipe(
        Effect.flatMap((call) =>
          call < firstRefusedLinkCall
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
  } satisfies FileSystem.FileSystem;
});

const otherStarterPlacesCompleteLock = (fs: FileSystem.FileSystem): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* fs.remove(LOCK_PATH, { force: true });
    const lockText4 = yield* lockText(OTHER);
    yield* fs.writeFileString(LOCK_PATH, lockText4);
  }).pipe(Effect.orDie);

const failureOf = <A, R>(
  effect: Effect.Effect<A, DocketIntakeError, R>
): Effect.Effect<O.Option<DocketIntakeError>, never, R> =>
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
        const files = yield* fs.readDirectory(UNCREATED_NESTED_DIRECTORY);

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
        expect((yield* fs.stat(UNCREATED_NESTED_DIRECTORY)).mode & 0o077).toBe(0);
        expect((yield* fs.stat(STATE_PATH)).mode & 0o077).toBe(0);
        const lockHolder5 = yield* lockHolder;
        assertSome(lockHolder5, OWN_HOLDER);
        const got = yield* Ref.get(record.writtenInOneCallInOrder);
        expect(
          A.filter(got, (path) => path === LOCK_PATH),
          "the lock is complete from the moment it exists: linked into place, never written there"
        ).toStrictEqual([]);
        const leftovers6 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers6).toStrictEqual([]);
        const got7 = yield* Ref.get(record.openedForWritingInOrder);
        expect(got7).toHaveLength(1);
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
        const read = yield* readDocketStateFile(UNCREATED_NESTED_DIRECTORY);

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

        const loaded8 = yield* store.load;
        assertTrue(sameState(loaded8, expected));
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
        const directory = UNCREATED_NESTED_DIRECTORY;

        const file = yield* writeDigestFile({ day, directory, text: "Docket intake digest for 2030-01-09." });
        yield* writeDigestFile({ day, directory, text: "Docket intake digest for 2030-01-09, rewritten." });

        expect(file).toBe(path.join(directory, "digests", "2030-01-09.md"));
        const readFileString9 = yield* fs.readFileString(file);
        expect(readFileString9).toBe("Docket intake digest for 2030-01-09, rewritten.");
        const readDirectory10 = yield* fs.readDirectory(path.join(directory, "digests"));
        expect(readDirectory10).toStrictEqual(["2030-01-09.md"]);
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
        const statePath = path.join(UNCREATED_NESTED_DIRECTORY, "state.json");
        yield* fs.writeFileString(statePath, '{"ledger":{"m1":{"attempts":"many"}}');

        const failure = yield* failureOf(store.load);

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "decode"]
        );
        const readFileString11 = yield* fs.readFileString(statePath);
        expect(readFileString11).toBe('{"ledger":{"m1":{"attempts":"many"}}');
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
        const opened = yield* Ref.get(record.openedForWritingInOrder);

        expect(opened).toHaveLength(2);
        expect(A.dedupe(opened)).toHaveLength(2);
        assertTrue(
          A.every(opened, (name) => Str.startsWith(`${STATE_PATH}.${OWN_PID}.`)(name) && Str.endsWith(".tmp")(name))
        );
        const readDirectory12 = yield* fs.readDirectory(UNCREATED_NESTED_DIRECTORY);
        expect(A.filter(readDirectory12, Str.endsWith(".tmp"))).toStrictEqual([]);
        assertNone((yield* store.load).cursor);
      })
    );
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "refuses to open while another live process holds the lock, and leaves that lock alone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* addRunningProcess(fs, OTHER.pid, OTHER.startTime);
        yield* leaveLockBehind(OTHER);

        const failure = yield* makeDocketFileStoreLayer(storeOptions).pipe(Layer.launch, failureOf);

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "state-locked"]
        );
        const lockHolder13 = yield* lockHolder;
        assertSome(lockHolder13, OTHER_HOLDER);
        const leftovers14 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers14).toStrictEqual([]);
      })
    );
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "takes over a lock whose holder is gone, and releases its own lock when the scope closes",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;

        yield* leaveLockBehind({ bootId: BOOT_ID, pid: "888", startTime: "2000" });
        const afterDeadProcess = yield* openInOwnScopeThenClose;
        yield* addRunningProcess(fs, "999", "2000");
        yield* leaveLockBehind({ bootId: "boot-before", pid: "999", startTime: "2000" });
        const afterRebootSamePidAndStartTime = yield* openInOwnScopeThenClose;
        yield* addRunningProcess(fs, "666", "3000");
        yield* leaveLockBehind({ bootId: BOOT_ID, pid: "666", startTime: "2999" });
        const afterPidReusedWithOtherStartTime = yield* openInOwnScopeThenClose;
        yield* leaveLockBehind({ bootId: BOOT_ID, pid: OWN_PID, startTime: OWN_START });
        const afterOwnPidInFreshProcessNamespace = yield* openInOwnScopeThenClose;
        yield* fs.remove(LOCK_PATH, { force: true });
        yield* fs.writeFileString(LOCK_PATH, "not a lock");
        const afterLockFileThatIsNoLock = yield* openInOwnScopeThenClose;

        for (const opened of [
          afterDeadProcess,
          afterRebootSamePidAndStartTime,
          afterPidReusedWithOtherStartTime,
          afterOwnPidInFreshProcessNamespace,
          afterLockFileThatIsNoLock,
        ]) {
          assertSome(opened.holder, OWN_HOLDER);
          assertNone(opened.empty.cursor);
          expect(opened.lockedAfterClose).toBe(false);
        }
        const leftovers15 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers15).toStrictEqual([]);
      })
    );
  });

  it.layer(
    linuxLikeRecordingFileSystemLayer(O.none()).pipe(
      Layer.provideMerge(OpenedFilesLayer),
      Layer.provideMerge(Path.layer)
    ),
    {
      timeout: "10 seconds",
    }
  )((it) => {
    it.effect(
      "still locks on a system that reports no boot id",
      Effect.fnUntraced(function* () {
        const opened = yield* openInOwnScopeThenClose;

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
        yield* addRunningProcess(fs, "5151", "5000");
        yield* leaveLockBehind({ bootId: BOOT_ID, pid: "888", startTime: "2000" });
        const first = yield* sharedFilesAsProcessWithLockRenameHooks(OWN_PID);
        const second = yield* sharedFilesAsProcessWithLockRenameHooks("5151");

        const [firstFailure, secondFailure] = yield* Effect.all(
          [tryOpenAsProcessKeepingScopeOpen(scope, first), tryOpenAsProcessKeepingScopeOpen(scope, second)],
          {
            concurrency: 2,
          }
        );
        const holder = yield* lockHolder;
        yield* Scope.close(scope, Exit.void);

        expect(A.map(A.getSomes([firstFailure, secondFailure]), (error) => [error.stage, error.cause])).toStrictEqual([
          ["store", "state-locked"],
        ]);
        const processThatDidNotFail = O.isSome(firstFailure) ? "5151" : OWN_PID;
        assertSome(
          O.map(holder, (held) => held[0]),
          processThatDidNotFail
        );
        const leftovers16 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers16).toStrictEqual([]);
      })
    );
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "loses to a starter that moved, replaced or re-took the stale lock in the middle of a takeover",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const scope = yield* Scope.make();
        const stale: Holder = { bootId: BOOT_ID, pid: "888", startTime: "2000" };
        yield* addRunningProcess(fs, OTHER.pid, OTHER.startTime);

        yield* leaveLockBehind(stale);
        const processView17 = yield* sharedFilesAsProcessWithLockRenameHooks(OWN_PID, {
          lockAlreadyMovedByOtherStarter: true,
        });
        const alreadyMovedByOtherStarter = yield* tryOpenAsProcessKeepingScopeOpen(scope, processView17);
        yield* leaveLockBehind(stale);
        const processView18 = yield* sharedFilesAsProcessWithLockRenameHooks(OWN_PID, {
          beforeLockRename: otherStarterPlacesCompleteLock(fs),
        });
        const replacedBeforeMoveSoOtherLockPutBack = yield* tryOpenAsProcessKeepingScopeOpen(scope, processView18);
        const afterReplacedLockPutBack = yield* lockHolder;
        yield* leaveLockBehind(stale);
        const processView19 = yield* sharedFilesAsProcessWithLockRenameHooks(OWN_PID, {
          afterLockRename: otherStarterPlacesCompleteLock(fs),
        });
        const retakenRightAfterMove = yield* tryOpenAsProcessKeepingScopeOpen(scope, processView19);
        const afterRetaken = yield* lockHolder;
        yield* Scope.close(scope, Exit.void);

        for (const failure of [
          alreadyMovedByOtherStarter,
          replacedBeforeMoveSoOtherLockPutBack,
          retakenRightAfterMove,
        ]) {
          assertSome(
            O.map(failure, (error) => [error.stage, error.cause]),
            ["store", "state-locked"]
          );
        }
        assertSome(afterReplacedLockPutBack, OTHER_HOLDER);
        assertSome(afterRetaken, OTHER_HOLDER);
        const leftovers20 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers20).toStrictEqual([]);
      })
    );
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reports a state directory it cannot write the lock to as a lock failure, not as a held lock",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const scope = yield* Scope.make();

        const noLockYetFirstLinkRefused = yield* refusingLinksFromCall(1);
        const failure = yield* tryOpenAsProcessKeepingScopeOpen(scope, noLockYetFirstLinkRefused);

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "lock"]
        );
        const exists22 = yield* fs.exists(LOCK_PATH);
        expect(exists22).toBe(false);
        const leftovers23 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers23).toStrictEqual([]);
        yield* Scope.close(scope, Exit.void);
      })
    );
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reports the same failure when the lock cannot be written after a stale one was moved aside",
      Effect.fnUntraced(function* () {
        const scope = yield* Scope.make();
        yield* leaveLockBehind(OTHER);

        const staleLockExistsThenTakeoverLinkRefused = yield* refusingLinksFromCall(2);
        const failure = yield* tryOpenAsProcessKeepingScopeOpen(scope, staleLockExistsThenTakeoverLinkRefused);

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "lock"]
        );
        const leftovers25 = yield* uncleanedTmpOrStaleFiles;
        expect(leftovers25).toStrictEqual([]);
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
