/**
 * File-backed docket intake store proofs over an in-memory file system.
 *
 * Every fixture is synthetic: invented ids and placeholder text.
 */
import {
  DocketFileStoreOptions,
  DocketMatterLookupUnavailableLive,
  makeDocketFileStoreLayer,
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
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";

// A nested directory that does not exist yet: building the store has to create it.
const DIRECTORY = "/fixture/state/docket-intake";
const STATE_PATH = `${DIRECTORY}/state.json`;
const LOCK_PATH = `${DIRECTORY}/state.lock`;
const OWN_PID = "4242";
const BOOT_ID = "boot-a";

type OpenedFilesShape = {
  /** Every path the store opened for writing, in order. */
  readonly opened: Ref.Ref<ReadonlyArray<string>>;
};

class OpenedFiles extends Context.Service<OpenedFiles, OpenedFilesShape>()(
  "@beep/law-practice-server/test/DocketIntake.store.test/OpenedFiles"
) {}

const OpenedFilesLayer = Layer.effect(
  OpenedFiles,
  Effect.gen(function* () {
    return OpenedFiles.of({ opened: yield* Ref.make<ReadonlyArray<string>>([]) });
  })
);

// An in-memory file system that looks like Linux to the store: `/proc/self` names this process,
// `/proc/<pid>` exists for a running process, and the kernel reports a boot id. It also records
// which files are opened, so the temporary file names are visible.
const fileSystemLayer = (bootId: O.Option<string>) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const memory = yield* MemoryFileSystem.make;
      const record = yield* OpenedFiles;
      yield* memory.makeDirectory(`/proc/${OWN_PID}`, { recursive: true });
      yield* memory.symlink(OWN_PID, "/proc/self");
      yield* memory.makeDirectory("/proc/sys/kernel/random", { recursive: true });
      yield* Effect.forEach(O.toArray(bootId), (id) =>
        memory.writeFileString("/proc/sys/kernel/random/boot_id", `${id}\n`)
      );
      return {
        ...memory,
        open: (path, options) =>
          Ref.update(record.opened, A.append(path)).pipe(Effect.andThen(memory.open(path, options))),
      } satisfies FileSystem.FileSystem;
    }).pipe(Effect.orDie)
  );

const FilesLayer = fileSystemLayer(O.some(BOOT_ID)).pipe(
  Layer.provideMerge(OpenedFilesLayer),
  Layer.provideMerge(Path.layer)
);

const storeOptions = DocketFileStoreOptions.make({ directory: DIRECTORY });

const storeLayer = makeDocketFileStoreLayer(storeOptions).pipe(Layer.provideMerge(FilesLayer));

const LockFile = S.fromJsonString(S.Struct({ bootId: S.String, pid: S.String, startedAt: S.String }));
const decodeLockFile = S.decodeUnknownOption(LockFile);
const encodeLockFile = S.encodeUnknownEffect(LockFile);

// Put a lock in place as another process would have left it.
const leaveLock = Effect.fnUntraced(function* (holder: { readonly bootId: string; readonly pid: string }) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(DIRECTORY, { recursive: true });
  yield* fs.remove(LOCK_PATH, { force: true });
  yield* fs.writeFileString(
    LOCK_PATH,
    yield* Effect.orDie(encodeLockFile({ ...holder, startedAt: "2030-01-09T10:00:00.000Z" }))
  );
});

const lockHolder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return O.map(decodeLockFile(yield* fs.readFileString(LOCK_PATH)), (lock) => [lock.pid, lock.bootId]);
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
        assertSome(yield* lockHolder, [OWN_PID, BOOT_ID]);
        expect(yield* Ref.get(record.opened)).toHaveLength(1);
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
      "refuses to open while a live process of this boot holds the lock, and leaves that lock alone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("/proc/777", { recursive: true });
        yield* leaveLock({ bootId: BOOT_ID, pid: "777" });

        const failure = yield* failureOf(Layer.launch(makeDocketFileStoreLayer(storeOptions)));

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["store", "state-locked"]
        );
        assertSome(yield* lockHolder, ["777", BOOT_ID]);
      })
    );
  });

  it.layer(FilesLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "takes over a lock whose holder is gone, and releases its own lock when the scope closes",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;

        // The holder's process no longer exists.
        yield* leaveLock({ bootId: BOOT_ID, pid: "888" });
        const afterDeadProcess = yield* openAndClose;
        // The holder's process id exists, but the lock is from before the last boot.
        yield* fs.makeDirectory("/proc/999", { recursive: true });
        yield* leaveLock({ bootId: "boot-before", pid: "999" });
        const afterReboot = yield* openAndClose;
        // The lock file is not a lock at all.
        yield* fs.remove(LOCK_PATH, { force: true });
        yield* fs.writeFileString(LOCK_PATH, "not a lock");
        const afterGarbage = yield* openAndClose;

        for (const opened of [afterDeadProcess, afterReboot, afterGarbage]) {
          assertSome(opened.holder, [OWN_PID, BOOT_ID]);
          assertNone(opened.empty.cursor);
          expect(opened.lockedAfterClose).toBe(false);
        }
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

        assertSome(opened.holder, [OWN_PID, ""]);
        expect(opened.lockedAfterClose).toBe(false);
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
