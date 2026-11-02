/**
 * Durable journal primitives shared by every journaled publication writer.
 *
 * **Details**
 *
 * Lifted from the `beep models` writer so the skills projection writer runs
 * the same protocol; both writers build their primitives here. A journal
 * record is published as an fsynced sibling file, then an exclusive `link`
 * for the first state or a `rename` for every later one, then a directory
 * `fsync`. A publication
 * owner is the boot id, pid and start time of a process, read from procfs, so
 * a dead, reaped or reused pid never reads as alive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual } from "effect/Function";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import { ModelsPublicationOwner, ModelsPublicationState } from "../Models.exchange.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";
import type { ModelsPublicationStep, ModelsRecoveryResult } from "../Models.exchange.schemas.ts";

const $I = $RepoCliId.create("internal/publication/PublicationLedger");
const encodeOwner = S.encodeEffect(S.fromJsonString(ModelsPublicationOwner));
const decodeOwner = S.decodeEffect(S.fromJsonString(ModelsPublicationOwner));
const textEncoder = new TextEncoder();
// A stamp that does not decode is never read as a dead owner while it is this recent.
const unreadableLockGraceMillis = 10 * 60 * 1000;

/**
 * The exclusive recovery lock of a journal could not be created.
 *
 * **Details**
 *
 * Raised for every failure to publish the lock other than an existing lock
 * (`EEXIST`), which means "held". `path` is the lock and `message` names the
 * platform error code. Each writer maps it onto its own typed
 * `lock-unavailable` refusal.
 *
 * @category errors
 * @since 0.0.0
 */
class PublicationLockUnavailable extends S.TaggedError<PublicationLockUnavailable, { readonly brand: unique symbol }>(
  $I`PublicationLockUnavailable`
)(
  "PublicationLockUnavailable",
  { path: S.String, message: S.String },
  $I.annoteError<PublicationLockUnavailable>("PublicationLockUnavailable", {
    title: "Publication Lock Unavailable",
    description: "The exclusive per-journal recovery lock could not be created for a reason other than EEXIST.",
  })
) {}

// Parse a procfs `stat` record into its pid, state and start time. The record
// is `pid (comm) state ...`, where `comm` may hold spaces or parentheses, so
// fields are counted after the last `)`. Field 3 is the process state and
// field 22 the start time in clock ticks since boot.
const parsePublicationProcessStat = (
  text: string
): O.Option<{ readonly pid: number; readonly state: string; readonly startTicks: string }> => {
  const close = O.getOrElse(Str.lastIndexOf(")")(text), constant(-1));
  const pid = Number.parseInt(text, 10);
  const fields = Str.split(Str.trim(Str.slice(close + 1)(text)), " ");
  return O.all({ state: A.get(fields, 0), startTicks: A.get(fields, 19) }).pipe(
    O.filter(() => close > 0 && Number.isSafeInteger(pid)),
    O.map((entry) => ({ ...entry, pid }))
  );
};

/**
 * Durable journal and owner-liveness primitives over one `FileSystem`.
 *
 * **Details**
 *
 * `writeDurable` creates a file exclusively, writes every byte and fsyncs it
 * before closing. `syncFile` and `syncDirectory` fsync an existing entry.
 * `publishRecord` publishes one journal record as described in the module
 * notes. `currentOwner` names this process, or none without procfs.
 * `ownerAlive` is true while the named process still runs; a recorded owner
 * with an unreadable boot id now counts as alive, so recovery stays out of the
 * way of an anomaly. `discard` removes an entry and tolerates one that is
 * already gone. `recoveryLock` takes the exclusive per-journal lock
 * `<directory>/<id>.recovering` for the enclosing scope and answers whether it
 * is held.
 *
 * The lock's owner stamp is written and fsynced to a uniquely named sibling,
 * then published with `link`, so the lock is never visible without its
 * complete stamp. Only `EEXIST` means held; any other failure is
 * {@link PublicationLockUnavailable}. A held lock whose stamp names a dead
 * owner is reclaimed. A stamp that does not decode holds the lock for ten
 * minutes, measured against a fresh file's mtime on the same filesystem, and
 * is stale after that. A stale lock is renamed aside and reclaimed only when
 * the renamed bytes are still the stale bytes read, so a fresh lock taken in
 * the meantime is put back.
 *
 * @category services
 * @since 0.0.0
 */
interface PublicationLedgerPrimitives {
  readonly currentOwner: Effect.Effect<O.Option<ModelsPublicationOwner>>;
  readonly discard: (
    entry: string,
    options?: { readonly recursive?: boolean }
  ) => Effect.Effect<void, PlatformError.PlatformError>;
  readonly ownerAlive: (owner: O.Option<ModelsPublicationOwner>) => Effect.Effect<boolean>;
  readonly publishRecord: (
    directory: string,
    file: string,
    bytes: Uint8Array,
    exclusive: boolean
  ) => Effect.Effect<void, PlatformError.PlatformError>;
  readonly recoveryLock: (
    directory: string,
    id: string
  ) => Effect.Effect<boolean, PublicationLockUnavailable | PlatformError.PlatformError, Scope.Scope>;
  readonly syncDirectory: (directory: string) => Effect.Effect<void>;
  readonly syncFile: (file: string) => Effect.Effect<void, PlatformError.PlatformError>;
  readonly writeDurable: (file: string, bytes: Uint8Array) => Effect.Effect<void, PlatformError.PlatformError>;
}

/**
 * Build the shared primitives over the `FileSystem` in context.
 *
 * **Details**
 *
 * The primitives capture the `FileSystem` they were built with, so a writer
 * that wraps its file system (for example a crash fixture that halts after a
 * journal link) sees every journal write through its wrapper.
 *
 * **Example** (Build the primitives)
 *
 * ```ts
 * import { makePublicationLedger } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makePublicationLedger())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePublicationLedger = Effect.fn("PublicationLedger.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const writeDurable: PublicationLedgerPrimitives["writeDurable"] = (file, bytes) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* fs.open(file, { flag: "wx", mode: 0o600 });
        yield* handle.writeAll(bytes);
        yield* handle.sync;
      })
    );
  const syncFile: PublicationLedgerPrimitives["syncFile"] = (file) =>
    Effect.scoped(Effect.flatMap(fs.open(file, { flag: "r" }), (handle) => handle.sync));
  const syncDirectory: PublicationLedgerPrimitives["syncDirectory"] = (directory) => Effect.ignore(syncFile(directory));
  const publishRecord: PublicationLedgerPrimitives["publishRecord"] = Effect.fnUntraced(
    function* (directory, file, bytes, exclusive) {
      const partial = `${path.join(directory, file)}.${yield* Random.nextIntBetween(0, 0xffffff)}.partial`;
      yield* writeDurable(partial, bytes).pipe(
        Effect.andThen(
          exclusive ? fs.link(partial, path.join(directory, file)) : fs.rename(partial, path.join(directory, file))
        ),
        Effect.ensuring(Effect.ignore(fs.remove(partial)))
      );
      yield* syncDirectory(directory);
    }
  );
  const bootId = fs.readFileString("/proc/sys/kernel/random/boot_id").pipe(Effect.map(Str.trim), Effect.option);
  const processStat = (pid: string) =>
    fs.readFileString(`/proc/${pid}/stat`).pipe(Effect.option, Effect.map(O.flatMap(parsePublicationProcessStat)));
  const currentOwner: PublicationLedgerPrimitives["currentOwner"] = Effect.gen(function* () {
    const boot = yield* bootId;
    const stat = yield* processStat("self");
    return O.isSome(boot) && O.isSome(stat) && Str.isNonEmpty(boot.value)
      ? O.some(
          ModelsPublicationOwner.make({ bootId: boot.value, pid: stat.value.pid, startTicks: stat.value.startTicks })
        )
      : O.none<ModelsPublicationOwner>();
  });
  const ownerAlive: PublicationLedgerPrimitives["ownerAlive"] = Effect.fnUntraced(function* (owner) {
    if (O.isNone(owner)) return false;
    const boot = yield* bootId;
    if (O.isNone(boot)) return true;
    if (boot.value !== owner.value.bootId) return false;
    const stat = yield* processStat(`${owner.value.pid}`);
    return O.exists(
      stat,
      (entry) => entry.startTicks === owner.value.startTicks && entry.state !== "Z" && entry.state !== "X"
    );
  });
  const discard: PublicationLedgerPrimitives["discard"] = (entry, options) =>
    fs
      .remove(entry, { recursive: options?.recursive === true })
      .pipe(
        Effect.catchTag("PlatformError", (error) =>
          error.reason._tag === "NotFound" ? Effect.void : Effect.fail(error)
        )
      );
  const lockUnavailable = (lock: string) => (error: PlatformError.PlatformError) =>
    PublicationLockUnavailable.make({
      path: lock,
      message: `Cannot create the recovery lock (${error.reason._tag}); refusing recovery.`,
    });
  const createLock = Effect.fnUntraced(function* (lock: string) {
    const stamp = yield* O.match(yield* currentOwner, {
      onNone: () => Effect.succeed(""),
      onSome: (owner) => encodeOwner(owner).pipe(Effect.orDie),
    });
    const sibling = `${lock}.${yield* Random.nextIntBetween(0, 0xffffff)}.stamp`;
    const staged = writeDurable(sibling, textEncoder.encode(stamp)).pipe(Effect.mapError(lockUnavailable(lock)));
    const published = fs.link(sibling, lock).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "AlreadyExists" ? Effect.succeed(false) : error.pipe(lockUnavailable(lock), Effect.fail)
      )
    );
    const held = yield* staged.pipe(Effect.andThen(published), Effect.ensuring(Effect.ignore(fs.remove(sibling))));
    yield* syncDirectory(path.dirname(lock));
    return held;
  });
  const unreadableLockStale = Effect.fnUntraced(function* (lock: string) {
    const lockTime = O.flatMap(yield* fs.stat(lock).pipe(Effect.option), (info) => info.mtime);
    const probe = `${lock}.${yield* Random.nextIntBetween(0, 0xffffff)}.clock`;
    const nowTime = yield* fs.writeFileString(probe, "", { flag: "wx", mode: 0o600 }).pipe(
      Effect.andThen(fs.stat(probe)),
      Effect.map((info) => info.mtime),
      Effect.option,
      Effect.map(O.flatten),
      Effect.ensuring(Effect.ignore(fs.remove(probe)))
    );
    return O.isSome(lockTime) && O.isSome(nowTime)
      ? nowTime.value.getTime() - lockTime.value.getTime() > unreadableLockGraceMillis
      : false;
  });
  const lockHolderAlive = Effect.fnUntraced(function* (lock: string, stamp: string) {
    const owner = yield* decodeOwner(stamp).pipe(Effect.option);
    if (O.isSome(owner)) return yield* ownerAlive(owner);
    return !(yield* unreadableLockStale(lock));
  });
  const reclaimLock = Effect.fnUntraced(function* (lock: string, stale: string) {
    const aside = `${lock}.${yield* Random.nextIntBetween(0, 0xffffff)}.stale`;
    if (O.isNone(yield* fs.rename(lock, aside).pipe(Effect.option))) return false;
    const moved = yield* fs.readFileString(aside).pipe(Effect.option);
    if (!O.contains(moved, stale)) {
      yield* fs.link(aside, lock).pipe(Effect.ignore);
      yield* discard(aside);
      return false;
    }
    yield* discard(aside);
    return yield* createLock(lock);
  });
  const acquireLock = Effect.fnUntraced(function* (lock: string) {
    if (yield* createLock(lock)) return true;
    const stamp = yield* fs.readFileString(lock).pipe(Effect.option);
    if (O.isNone(stamp)) return yield* createLock(lock);
    if (yield* lockHolderAlive(lock, stamp.value)) return false;
    return yield* reclaimLock(lock, stamp.value);
  });
  const recoveryLock: PublicationLedgerPrimitives["recoveryLock"] = (directory, id) => {
    const lock = path.join(directory, `${id}.recovering`);
    return Effect.acquireRelease(acquireLock(lock), (held) => (held ? Effect.ignore(discard(lock)) : Effect.void));
  };
  return {
    currentOwner,
    discard,
    ownerAlive,
    publishRecord,
    recoveryLock,
    syncDirectory,
    syncFile,
    writeDurable,
  } satisfies PublicationLedgerPrimitives;
});

type SettledResult = Exclude<ModelsRecoveryResult, { readonly _tag: "skipped" }>;

/**
 * The terminal state a settled recovery records.
 *
 * **Details**
 *
 * A recovered result closes the publication as `recovered` with its outcome,
 * and a refused result as `refused` with its reason and detail. Both name the
 * step recovery started from.
 *
 * **Example** (Close out a refusal)
 *
 * ```ts
 * import { ModelsRecoveryResult } from "@beep/repo-cli/commands/Models/Models.exchange.schemas"
 * import { publicationTerminalState } from "@beep/repo-cli/test/SharedInternals"
 *
 * const refused = ModelsRecoveryResult.cases.refused.make({ reason: "competing-writer", detail: "Changed." })
 * console.log(publicationTerminalState("staged", refused)._tag) // "refused"
 * ```
 *
 * @param from - Publication step the interrupted run had reached when recovery began.
 * @param result - Recovery outcome: `recovered` with its outcome, or `refused` with reason and detail.
 * @returns A `recovered` or `refused` ledger state carrying `from`, ready to record.
 * @category constructors
 * @since 0.0.0
 */
export const publicationTerminalState: {
  (result: SettledResult): (from: ModelsPublicationStep) => ModelsPublicationState;
  (from: ModelsPublicationStep, result: SettledResult): ModelsPublicationState;
} = dual(
  2,
  (from: ModelsPublicationStep, result: SettledResult): ModelsPublicationState =>
    result._tag === "recovered"
      ? ModelsPublicationState.cases.recovered.make({ from, outcome: result.outcome })
      : ModelsPublicationState.cases.refused.make({ from, reason: result.reason, detail: result.detail })
);

/**
 * A unique, sortable publication suffix: the ISO time without separators and a salt.
 *
 * **Example** (Make a suffix)
 *
 * ```ts
 * import { publicationSuffix } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(publicationSuffix)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const publicationSuffix: Effect.Effect<string> = Effect.gen(function* () {
  const now = yield* DateTime.now;
  const salt = yield* Random.nextIntBetween(0, 0xffffff);
  return `${now.pipe(DateTime.formatIso, Str.replace(/[:.]/g, ""))}-${salt}`;
});

/**
 * Read one journal record, keeping it only when its file is named for its id.
 *
 * **Details**
 *
 * An unreadable, undecodable or misnamed record is none: it is not this
 * writer's record to judge.
 *
 * **Example** (Read a record)
 *
 * ```ts
 * import { readPublicationRecord } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeEffect(S.fromJsonString(S.Struct({ id: S.String })))
 * console.log(Effect.isEffect(readPublicationRecord("/repo/journals", "a.json", decode))) // true
 * ```
 *
 * @param directory - The journal directory.
 * @param entry - The record's file name.
 * @param decode - The record decoder.
 * @returns The decoded record, or none.
 * @category parsing
 * @since 0.0.0
 */
export const readPublicationRecord = Effect.fn("PublicationLedger.readRecord")(function* <
  Record extends { readonly id: string },
>(directory: string, entry: string, decode: (text: string) => Effect.Effect<Record, S.SchemaError>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .readFileString(path.join(directory, entry))
    .pipe(Effect.flatMap(decode), Effect.option, Effect.map(O.filter((record) => entry === `${record.id}.json`)));
});

/**
 * Remove the partial record writes a crash left beside one journal.
 *
 * **Example** (Drop stale partials)
 *
 * ```ts
 * import { dropStalePublicationPartials } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(dropStalePublicationPartials("/repo/journals", "skills-1"))) // true
 * ```
 *
 * @param directory - The journal directory.
 * @param id - The journal id.
 * @returns An effect that removes `<id>.json.<n>.partial` entries.
 * @category utilities
 * @since 0.0.0
 */
export const dropStalePublicationPartials = Effect.fn("PublicationLedger.dropStalePartials")(function* (
  directory: string,
  id: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stale = A.filter(
    yield* fs.readDirectory(directory),
    (entry) => Str.startsWith(`${id}.json.`)(entry) && Str.endsWith(".partial")(entry)
  );
  yield* Effect.forEach(stale, (entry) => fs.remove(path.join(directory, entry), { force: true }), { discard: true });
});
