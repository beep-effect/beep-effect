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
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Context, Effect, Exit, FileSystem, HashMap, Layer, Path, Ref } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";

// A nested directory that does not exist yet: building the store has to create it.
const DIRECTORY = "/fixture/state/docket-intake";

type MemoryFilesShape = {
  readonly files: Ref.Ref<HashMap.HashMap<string, string>>;
  /** Every write and rename, in order. */
  readonly operations: Ref.Ref<ReadonlyArray<string>>;
};

class MemoryFiles extends Context.Service<MemoryFiles, MemoryFilesShape>()(
  "@beep/law-practice-server/test/DocketIntake.store.test/MemoryFiles"
) {}

const MemoryFilesLayer = Layer.effect(
  MemoryFiles,
  Effect.gen(function* () {
    return MemoryFiles.of({
      files: yield* Ref.make(HashMap.empty<string, string>()),
      operations: yield* Ref.make<ReadonlyArray<string>>([]),
    });
  })
);

const notFound = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "NotFound", method, module: "FileSystem", pathOrDescriptor: path });

// The store's own behavior is the subject, so the file system is an in-memory one that records
// the order of writes and renames.
const MemoryFileSystemLayer = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const memory = yield* MemoryFiles;
    const read = Effect.fnUntraced(function* (method: string, path: string) {
      return yield* Effect.fromOption(HashMap.get(yield* Ref.get(memory.files), path), () => notFound(method, path));
    });

    return FileSystem.makeNoop({
      exists: (path) => Ref.get(memory.files).pipe(Effect.map(HashMap.has(path))),
      makeDirectory: () => Effect.void,
      readDirectory: (path) =>
        Ref.get(memory.files).pipe(
          Effect.map((files) =>
            A.map(
              A.filter(A.fromIterable(HashMap.keys(files)), Str.startsWith(`${path}/`)),
              Str.slice(Str.length(path) + 1)
            )
          )
        ),
      readFileString: (path) => read("readFileString", path),
      rename: Effect.fnUntraced(function* (oldPath, newPath) {
        const contents = yield* read("rename", oldPath);
        yield* Ref.update(memory.files, (files) => HashMap.set(HashMap.remove(files, oldPath), newPath, contents));
        yield* Ref.update(memory.operations, A.append(`rename ${oldPath} -> ${newPath}`));
      }),
      writeFileString: Effect.fnUntraced(function* (path, contents) {
        yield* Ref.update(memory.files, HashMap.set(path, contents));
        yield* Ref.update(memory.operations, A.append(`write ${path}`));
      }),
    });
  })
);

const storeLayer = makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: DIRECTORY })).pipe(
  Layer.provideMerge(MemoryFileSystemLayer),
  Layer.provideMerge(Path.layer),
  Layer.provideMerge(MemoryFilesLayer)
);

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
        const memory = yield* MemoryFiles;

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
        expect(files).toStrictEqual(["state.json"]);
        expect(yield* Ref.get(memory.operations)).toStrictEqual([
          `write ${DIRECTORY}/state.json.tmp`,
          `rename ${DIRECTORY}/state.json.tmp -> ${DIRECTORY}/state.json`,
        ]);
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
