/**
 * File-backed durable state of the docket intake service, and the plain-text
 * archive of its daily digests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketIntakeError, DocketIntakeState, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import { thunkEmptyStr, thunkFalse } from "@beep/utils";
import { DateTime, Effect, FileSystem, Layer, Path, Random } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { LocalDate } from "@beep/schema/LocalDate";

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
export class DocketFileStoreOptions extends S.Class<DocketFileStoreOptions>($I`DocketFileStoreOptions`)(
  {
    directory: S.NonEmptyString.annotateKey({ description: "Directory that holds the state file and the digests." }),
  },
  $I.annote("DocketFileStoreOptions", { description: "Settings of the file-backed docket intake store." })
) {}

const StateJson = S.fromJsonString(DocketIntakeState);
const decodeState = S.decodeUnknownEffect(StateJson);
const encodeState = S.encodeUnknownEffect(StateJson);

// Who holds the state directory: the process, the boot it belongs to, and when it started. The
// boot id is what keeps a process id from before a reboot from looking alive afterwards.
const LockJson = S.fromJsonString(S.Struct({ bootId: S.String, pid: S.NonEmptyString, startedAt: S.String }));
const decodeLock = S.decodeUnknownOption(LockJson);
const encodeLock = S.encodeUnknownEffect(LockJson);

const PROCESS_SELF = "/proc/self";
const BOOT_ID = "/proc/sys/kernel/random/boot_id";
const SUFFIX_RANGE = 0xffffffff;
const HEX = 16;

const storeError = (cause: string) => () => DocketIntakeError.make({ cause, stage: "store" });

const textEncoder = new TextEncoder();

// Write beside the target under a name no other writer uses, flush it to disk, and rename it
// over the target: a reader never sees a half-written file, and a crash leaves the old one.
const writeAtomically = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  contents: string
): Effect.fn.Return<void, DocketIntakeError> {
  const pid = yield* fs.readLink(PROCESS_SELF).pipe(Effect.mapError(storeError("process-id")));
  const suffix = (yield* Random.nextIntBetween(0, SUFFIX_RANGE)).toString(HEX);
  const temporary = `${path}.${pid}.${suffix}.tmp`;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(temporary, { flag: "wx" });
      yield* file.writeAll(textEncoder.encode(contents));
      yield* file.sync;
    })
  ).pipe(Effect.mapError(storeError("write")));
  yield* fs.rename(temporary, path).pipe(Effect.mapError(storeError("rename")));
});

type LockHolder = { readonly bootId: string; readonly pid: string };

const readBootId = (fs: FileSystem.FileSystem): Effect.Effect<string> =>
  fs.readFileString(BOOT_ID).pipe(Effect.map(Str.trim), Effect.orElseSucceed(thunkEmptyStr));

// The holder recorded in an existing lock file. A lock that cannot be read or does not decode
// names nobody, so it is stale.
const readHolder = (fs: FileSystem.FileSystem, lockPath: string): Effect.Effect<O.Option<LockHolder>> =>
  Effect.option(fs.readFileString(lockPath)).pipe(Effect.map(O.flatMap(decodeLock)));

// A holder is alive when it belongs to this boot and its process still exists.
const isAlive = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, self: LockHolder, holder: LockHolder) {
  const running = yield* fs.exists(`/proc/${holder.pid}`).pipe(Effect.orElseSucceed(thunkFalse));
  return running && holder.bootId === self.bootId;
});

const acquireLock = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  lockPath: string
): Effect.fn.Return<void, DocketIntakeError> {
  const self: LockHolder = {
    bootId: yield* readBootId(fs),
    pid: yield* fs.readLink(PROCESS_SELF).pipe(Effect.mapError(storeError("process-id"))),
  };
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const contents = yield* encodeLock({ ...self, startedAt }).pipe(Effect.mapError(storeError("encode")));
  const create = fs.writeFileString(lockPath, contents, { flag: "wx" });

  // Taking over a dead holder's lock is what lets the service restart unattended after it was
  // killed without a chance to clean up.
  const takeOver = Effect.fnUntraced(function* () {
    const holder = yield* readHolder(fs, lockPath);
    const held = yield* O.match(holder, {
      onNone: () => Effect.succeed(false),
      onSome: (value) => isAlive(fs, self, value),
    });
    if (held) {
      return yield* DocketIntakeError.make({ cause: "state-locked", stage: "store" });
    }
    yield* Effect.logWarning("docket intake state lock taken over from a holder that is gone", {
      holderPid: O.getOrElse(
        O.map(holder, (value) => value.pid),
        () => "unreadable"
      ),
    });
    yield* fs.remove(lockPath, { force: true }).pipe(Effect.andThen(create), Effect.mapError(storeError("lock")));
  });

  yield* create.pipe(Effect.catch(takeOver));
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
 * build with cause `state-locked`. A lock left by a process that is gone (its
 * `/proc` entry is missing, it belongs to an earlier boot, or the lock file
 * is unreadable) is taken over, so a killed service restarts on its own.
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
      yield* fs.makeDirectory(options.directory, { recursive: true }).pipe(Effect.mapError(storeError("directory")));
      yield* Effect.acquireRelease(acquireLock(fs, lockPath), () =>
        fs.remove(lockPath, { force: true }).pipe(Effect.ignore)
      );

      return DocketIntakeStore.of({
        load: Effect.gen(function* () {
          const exists = yield* fs.exists(statePath).pipe(Effect.mapError(storeError("stat")));
          if (!exists) {
            return DocketIntakeState.make({});
          }
          const contents = yield* fs.readFileString(statePath).pipe(Effect.mapError(storeError("read")));
          return yield* decodeState(contents).pipe(Effect.mapError(storeError("decode")));
        }).pipe(Effect.withSpan("DocketFileStore.load")),
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
  yield* fs.makeDirectory(digests, { recursive: true }).pipe(Effect.mapError(storeError("directory")));
  yield* writeAtomically(fs, file, input.text);
  return file;
});
