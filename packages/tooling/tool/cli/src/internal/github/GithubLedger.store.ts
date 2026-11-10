/**
 * The GitHub budget ledger's storage contract, its host-scoped file store and
 * an in-memory store for tests.
 *
 * **Details**
 *
 * The file store lives under `$XDG_STATE_HOME/beep/github/ledger`
 * (`BEEP_GITHUB_LEDGER_STATE_ROOT` overrides it). Rows go to one append-only
 * JSON Lines file per UTC hour (`rows/<YYYY-MM-DDTHH>.jsonl`): each row is one
 * `O_APPEND` write of one line no longer than 4 KiB, so writers on one host do
 * not interleave, and a reader skips any torn line. `latest/*.json`,
 * `aliases.json` and `rollups/*.json` are replaced atomically and privately
 * (`0600` files in `0700` directories). Calibration pairs are also appended to
 * `calibration.jsonl`, so the read side can judge calibration without opening
 * any raw hour. A sampler lease names its holder with a random token and is
 * removed only by that holder. Nothing is resolved or created until the first
 * operation runs.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { partitionJsonLines } from "../state/JsonLinesStore.ts";
import { writePrivateFile } from "../state/PrivateFile.ts";
import { resolveWorkstationStateDir } from "../state/WorkstationState.ts";
import { hourFileKey, hourStartOf } from "./GithubLedger.reducers.ts";
import {
  BucketReadingJson,
  bucketKeyString,
  emptyIdentityAliases,
  fileKeyOf,
  GITHUB_LEDGER_MAX_LINE_BYTES,
  GithubLedgerError,
  GithubLedgerRow,
  GithubLedgerRowJson,
  IdentityAliases,
  IdentityAliasesJson,
  LedgerHourRollupJson,
  LedgerSummary,
  LedgerSummaryJson,
  SampleRowJson,
} from "./GithubLedger.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";
import type {
  BucketReading,
  CalibrationRow,
  GithubIdentityLabel,
  LedgerHourRollup,
  LedgerRange,
  RetentionCutoffs,
  SampleRow,
} from "./GithubLedger.schemas.ts";

const $I = $RepoCliId.create("internal/github/GithubLedger.store");

const HOUR_MILLIS = Duration.toMillis(Duration.hours(1));
const CALIBRATION_FILE = "calibration.jsonl";
const SAMPLER_LEASE_STALE = Duration.seconds(120);
const textEncoder = new TextEncoder();

/**
 * What the ledger needs from its storage.
 *
 * @category services
 * @since 0.0.0
 */
export interface GithubLedgerStoreShape {
  /** Take the identity's sampler lease for the scope; false when another process holds a fresh one. */
  readonly acquireSamplerLease: (
    identity: GithubIdentityLabel
  ) => Effect.Effect<boolean, GithubLedgerError, Scope.Scope>;
  /** Append one row to its hour's file; an encoded line over 4 KiB is rejected. */
  readonly append: (row: GithubLedgerRow) => Effect.Effect<void, GithubLedgerError>;
  /** Append one calibration pair to the calibration file the read side judges calibration from. */
  readonly appendCalibration: (row: CalibrationRow) => Effect.Effect<void, GithubLedgerError>;
  /** The retained calibration pairs, oldest first; torn or corrupt lines are skipped. */
  readonly calibrations: Effect.Effect<ReadonlyArray<CalibrationRow>, GithubLedgerError>;
  /** The newest sample per identity. */
  readonly latestSamples: Effect.Effect<ReadonlyArray<SampleRow>, GithubLedgerError>;
  /** The newest transport reading per key. */
  readonly latestTransport: Effect.Effect<ReadonlyArray<BucketReading>, GithubLedgerError>;
  /** The alias map; empty when absent or unreadable. */
  readonly readAliases: Effect.Effect<IdentityAliases, GithubLedgerError>;
  /** The rollup of an hour, when one was written. */
  readonly readRollup: (hour: DateTime.Utc) => Effect.Effect<O.Option<LedgerHourRollup>, GithubLedgerError>;
  /** The hot-parcel summary, when one was written. */
  readonly readSummary: Effect.Effect<O.Option<LedgerSummary>, GithubLedgerError>;
  /** Delete raw hours, rollups, `latest/` readings and calibration pairs past retention. */
  readonly removeBefore: (cutoffs: RetentionCutoffs) => Effect.Effect<void, GithubLedgerError>;
  /** The hours that still have a raw row file, oldest first. */
  readonly rowHours: Effect.Effect<ReadonlyArray<DateTime.Utc>, GithubLedgerError>;
  /** The rows stamped in `(from, to]`; torn or corrupt lines are skipped. */
  readonly rows: (range: LedgerRange) => Effect.Effect<ReadonlyArray<GithubLedgerRow>, GithubLedgerError>;
  /** Record that a `token:` label belongs to a user label. */
  readonly writeAlias: (
    token: GithubIdentityLabel,
    user: GithubIdentityLabel
  ) => Effect.Effect<void, GithubLedgerError>;
  /** Replace the newest sample of the row's identity. */
  readonly writeLatestSample: (row: SampleRow) => Effect.Effect<void, GithubLedgerError>;
  /** Replace the newest transport reading of the reading's key. */
  readonly writeLatestTransport: (reading: BucketReading) => Effect.Effect<void, GithubLedgerError>;
  /** Replace an hour's rollup. */
  readonly writeRollup: (rollup: LedgerHourRollup) => Effect.Effect<void, GithubLedgerError>;
  /** Replace the hot-parcel summary. */
  readonly writeSummary: (summary: LedgerSummary) => Effect.Effect<void, GithubLedgerError>;
}

/**
 * The ledger's storage.
 *
 * **Example** (Run against the memory store)
 *
 * ```ts
 * import { GithubLedgerStore, layerGithubLedgerStoreMemory } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * const aliases = Effect.runSync(
 *   GithubLedgerStore.use((store) => store.readAliases).pipe(Effect.provide(layerGithubLedgerStoreMemory))
 * )
 * console.log(Object.keys(aliases.aliases).length) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GithubLedgerStore extends Context.Service<GithubLedgerStore, GithubLedgerStoreShape>()(
  $I`GithubLedgerStore`
) {}

const rangeHours = (range: LedgerRange): ReadonlyArray<DateTime.Utc> => {
  const first = range.from.pipe(hourStartOf, DateTime.toEpochMillis);
  const last = range.to.pipe(hourStartOf, DateTime.toEpochMillis);
  return last < first
    ? A.empty()
    : A.map(A.range(0, (last - first) / HOUR_MILLIS), (index) => DateTime.makeUnsafe(first + index * HOUR_MILLIS));
};

const inRange = (range: LedgerRange) => (row: GithubLedgerRow) =>
  DateTime.toEpochMillis(row.at) > DateTime.toEpochMillis(range.from) &&
  DateTime.toEpochMillis(row.at) <= DateTime.toEpochMillis(range.to);

const encodeLine = (row: GithubLedgerRow) =>
  S.encodeEffect(GithubLedgerRowJson)(row).pipe(
    Effect.mapError(GithubLedgerError.fromUnknown("decode", "encode a ledger row")),
    Effect.flatMap((line) => {
      const bytes = textEncoder.encode(line).length;
      return bytes > GITHUB_LEDGER_MAX_LINE_BYTES
        ? Effect.fail(
            GithubLedgerError.make({
              reason: "write",
              detail: `a ledger row of ${bytes} bytes exceeds the ${GITHUB_LEDGER_MAX_LINE_BYTES}-byte line cap`,
            })
          )
        : Effect.succeed(line);
    })
  );

const hourOfFileName = (name: string): O.Option<DateTime.Utc> =>
  pipe(
    Str.match(/^(\d{4}-\d{2}-\d{2}T\d{2})\.jsonl?$|^(\d{4}-\d{2}-\d{2}T\d{2})\.json$/)(name),
    O.flatMap((parts) => O.fromNullishOr(parts[1] ?? parts[2])),
    O.flatMap((stem) => DateTime.make(`${stem}:00:00.000Z`)),
    O.map(DateTime.toUtc)
  );

const isNotFound = (error: PlatformError.PlatformError): boolean => error.reason._tag === "NotFound";

const isCalibrationRow = GithubLedgerRow.guards.Calibration;

const SamplerLeaseJson = S.fromJsonString(
  S.Struct({ pid: S.Int, at: S.DateTimeUtcFromString, token: S.String }).pipe(
    $I.annoteSchema("SamplerLease", { description: "Who holds a sampler lease, so only the holder removes it." })
  )
);

const leaseBody = Effect.gen(function* () {
  const pid = yield* Effect.sync(() => process.pid);
  const at = yield* DateTime.now;
  const high = yield* Random.nextIntBetween(0, 2_147_483_647);
  const low = yield* Random.nextIntBetween(0, 2_147_483_647);
  return yield* S.encodeEffect(SamplerLeaseJson)({ pid, at, token: `${pid}-${high}-${low}` }).pipe(
    Effect.mapError(GithubLedgerError.fromUnknown("decode", "encode the sampler lease"))
  );
});

/**
 * Build the file store, resolving the state directory on first use.
 *
 * **Example** (Build the live store)
 *
 * ```ts
 * import { makeGithubLedgerStoreLive } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeGithubLedgerStoreLive)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGithubLedgerStoreLive = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
  const root = yield* Effect.cached(
    resolveWorkstationStateDir({ override: "BEEP_GITHUB_LEDGER_STATE_ROOT", store: "github/ledger" }).pipe(
      Effect.mapError(GithubLedgerError.fromUnknown("state-dir", "resolve the ledger state directory"))
    )
  );
  const dir = (name: string) => Effect.map(root, (base) => path.join(base, name));
  const writeError = (detail: string) => GithubLedgerError.fromUnknown("write", detail);
  const readError = (detail: string) => GithubLedgerError.fromUnknown("read", detail);
  const failWith =
    (toError: (cause: unknown) => GithubLedgerError) =>
    (error: PlatformError.PlatformError): Effect.Effect<never, GithubLedgerError> =>
      error.pipe(toError, Effect.fail);

  const writePrivate = (file: string, text: string, detail: string) =>
    writePrivateFile(file, text).pipe(Effect.provideContext(services), Effect.mapError(writeError(detail)));

  const readOptional = (file: string, detail: string) =>
    fs.readFileString(file).pipe(
      Effect.asSome,
      Effect.catchTag("PlatformError", (error) =>
        isNotFound(error) ? Effect.succeedNone : failWith(readError(detail))(error)
      )
    );

  const listNames = (directory: string, detail: string) =>
    fs
      .readDirectory(directory)
      .pipe(
        Effect.catchTag("PlatformError", (error) =>
          isNotFound(error) ? Effect.succeed(A.empty<string>()) : failWith(readError(detail))(error)
        )
      );

  const removeIfPresent = (file: string, detail: string) =>
    fs
      .remove(file)
      .pipe(
        Effect.catchTag("PlatformError", (error) =>
          isNotFound(error) ? Effect.void : failWith(writeError(detail))(error)
        )
      );

  const encodeWith =
    <A, I>(codec: S.Codec<A, I>, detail: string) =>
    (value: A) =>
      S.encodeEffect(codec)(value).pipe(Effect.mapError(GithubLedgerError.fromUnknown("decode", detail)));

  const readLatestFiles = Effect.fnUntraced(function* <A>(prefix: string, decode: (input: string) => O.Option<A>) {
    const latest = yield* dir("latest");
    const listed = yield* listNames(latest, "list latest readings");
    const names = A.filter(listed, (name) => Str.startsWith(prefix)(name) && Str.endsWith(".json")(name));
    const texts = yield* Effect.forEach(names, (name) => readOptional(path.join(latest, name), "read a reading"), {
      concurrency: 8,
    });
    return A.getSomes(A.map(texts, O.flatMap(decode)));
  });

  const readAliases = Effect.gen(function* () {
    const base = yield* root;
    const text = yield* readOptional(path.join(base, "aliases.json"), "read the identity aliases");
    return text.pipe(
      O.flatMap(S.decodeUnknownOption(IdentityAliasesJson)),
      O.getOrElse(() => emptyIdentityAliases)
    );
  });

  const createLease = (lock: string, body: string) =>
    fs.writeFileString(lock, body, { flag: "wx", mode: 0o600 }).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "AlreadyExists"
          ? Effect.succeed(false)
          : failWith(writeError("create the sampler lease"))(error)
      )
    );

  const rowFile = (rows: string, hour: DateTime.Utc) => path.join(rows, `${hourFileKey(hour)}.jsonl`);

  const rowHours = Effect.gen(function* () {
    const rows = yield* dir("rows");
    const names = yield* listNames(rows, "list ledger hours");
    return A.sort(A.getSomes(A.map(names, hourOfFileName)), DateTime.Order);
  });

  const append = Effect.fnUntraced(function* (row: GithubLedgerRow) {
    const line = yield* encodeLine(row);
    const rows = yield* dir("rows");
    yield* fs
      .makeDirectory(rows, { recursive: true, mode: 0o700 })
      .pipe(Effect.mapError(writeError("create the rows directory")));
    yield* fs
      .writeFileString(rowFile(rows, row.at), `${line}\n`, { flag: "a", mode: 0o600 })
      .pipe(Effect.mapError(writeError("append a ledger row")));
  });

  const appendCalibration = Effect.fnUntraced(function* (row: CalibrationRow) {
    const line = yield* encodeLine(row);
    const base = yield* root;
    yield* fs
      .makeDirectory(base, { recursive: true, mode: 0o700 })
      .pipe(Effect.mapError(writeError("create the ledger directory")));
    yield* fs
      .writeFileString(path.join(base, CALIBRATION_FILE), `${line}\n`, { flag: "a", mode: 0o600 })
      .pipe(Effect.mapError(writeError("append a calibration pair")));
  });

  const calibrations = Effect.gen(function* () {
    const base = yield* root;
    const text = yield* readOptional(path.join(base, CALIBRATION_FILE), "read the calibration pairs");
    const decode = partitionJsonLines(S.decodeUnknownOption(GithubLedgerRowJson));
    return O.match(text, {
      onNone: A.empty<CalibrationRow>,
      onSome: (content) => A.filter(decode(content).rows, isCalibrationRow),
    });
  });

  const readRows = Effect.fnUntraced(function* (range: LedgerRange) {
    const rows = yield* dir("rows");
    const decode = partitionJsonLines(S.decodeUnknownOption(GithubLedgerRowJson));
    const reads = yield* Effect.forEach(
      rangeHours(range),
      (hour) => readOptional(rowFile(rows, hour), "read ledger rows"),
      {
        concurrency: 8,
      }
    );
    const decoded = A.map(A.getSomes(reads), decode);
    const corrupt = A.reduce(decoded, 0, (total, read) => total + read.corruptLineCount);
    if (corrupt > 0) {
      yield* Effect.logDebug("github.ledger.corruptLines").pipe(Effect.annotateLogs({ corrupt }));
    }
    return A.filter(
      A.flatMap(decoded, (read) => read.rows),
      inRange(range)
    );
  });

  const writeLatestSample = Effect.fnUntraced(function* (row: SampleRow) {
    const text = yield* encodeWith(SampleRowJson, "encode a sample")(row);
    const latest = yield* dir("latest");
    yield* writePrivate(path.join(latest, `sample-${fileKeyOf(row.identity)}.json`), text, "write the latest sample");
  });

  const writeLatestTransport = Effect.fnUntraced(function* (reading: BucketReading) {
    const text = yield* encodeWith(BucketReadingJson, "encode a reading")(reading);
    const latest = yield* dir("latest");
    const file = path.join(latest, `transport-${fileKeyOf(reading.key.identity)}-${reading.key.resource}.json`);
    yield* writePrivate(file, text, "write the latest transport reading");
  });

  const writeAlias = Effect.fnUntraced(function* (token: GithubIdentityLabel, user: GithubIdentityLabel) {
    const current = yield* readAliases;
    if (O.exists(R.get(current.aliases, token), (owner) => owner === user)) return;
    const next = IdentityAliases.make({ aliases: R.set(current.aliases, token, user) });
    const text = yield* encodeWith(IdentityAliasesJson, "encode the identity aliases")(next);
    const base = yield* root;
    yield* writePrivate(path.join(base, "aliases.json"), text, "write the identity aliases");
  });

  const readRollup = Effect.fnUntraced(function* (hour: DateTime.Utc) {
    const rollups = yield* dir("rollups");
    const text = yield* readOptional(path.join(rollups, `${hourFileKey(hour)}.json`), "read an hour rollup");
    return O.flatMap(text, S.decodeUnknownOption(LedgerHourRollupJson));
  });

  const writeRollup = Effect.fnUntraced(function* (rollup: LedgerHourRollup) {
    const text = yield* encodeWith(LedgerHourRollupJson, "encode an hour rollup")(rollup);
    const rollups = yield* dir("rollups");
    yield* writePrivate(path.join(rollups, `${hourFileKey(rollup.hour)}.json`), text, "write an hour rollup");
  });

  const readSummary = Effect.gen(function* () {
    const latest = yield* dir("latest");
    const text = yield* readOptional(path.join(latest, "summary.json"), "read the ledger summary");
    return O.flatMap(text, S.decodeUnknownOption(LedgerSummaryJson));
  });

  const writeSummary = Effect.fnUntraced(function* (summary: LedgerSummary) {
    const text = yield* encodeWith(LedgerSummaryJson, "encode the ledger summary")(summary);
    const latest = yield* dir("latest");
    yield* writePrivate(path.join(latest, "summary.json"), text, "write the ledger summary");
  });

  const acquireSamplerLease = Effect.fnUntraced(function* (identity: GithubIdentityLabel) {
    const sampler = yield* dir("sampler");
    yield* fs
      .makeDirectory(sampler, { recursive: true, mode: 0o700 })
      .pipe(Effect.mapError(writeError("create the sampler directory")));
    const lock = path.join(sampler, `${fileKeyOf(identity)}.lock`);
    const body = yield* leaseBody;
    // Remove the lock only while it is still this holder's: a reclaimer may have replaced it.
    const release = Effect.addFinalizer(() =>
      fs.readFileString(lock).pipe(
        Effect.flatMap((current) => (current === body ? fs.remove(lock) : Effect.void)),
        Effect.ignore
      )
    );
    const created = yield* createLease(lock, body);
    if (created) {
      yield* release;
      return true;
    }
    const info = yield* fs.stat(lock).pipe(Effect.asSome, Effect.orElseSucceed(O.none<FileSystem.File.Info>));
    const now = yield* DateTime.now;
    const nowMillis = DateTime.toEpochMillis(now);
    const fresh = O.exists(
      O.flatMap(info, (value) => value.mtime),
      (mtime) => nowMillis - mtime.getTime() < Duration.toMillis(SAMPLER_LEASE_STALE)
    );
    if (fresh) return false;
    // Only one process can win the rename of a stale lease; the loser sees NotFound.
    const suffix = yield* Random.nextIntBetween(0, 2_147_483_647);
    const stale = `${lock}.stale.${suffix}`;
    const reclaimed = yield* fs.rename(lock, stale).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );
    if (!reclaimed) return false;
    yield* fs.remove(stale).pipe(Effect.ignore);
    const retried = yield* createLease(lock, body);
    if (retried) yield* release;
    return retried;
  });

  // A key seen once (a reviewer App run, an old token) would otherwise stay in every read forever.
  const removeLatestBefore = Effect.fnUntraced(function* (limit: DateTime.Utc) {
    const latest = yield* dir("latest");
    const listed = yield* listNames(latest, "list latest readings");
    const limitMillis = DateTime.toEpochMillis(limit);
    const takenAt = (name: string) => (text: string) =>
      Str.startsWith("sample-")(name)
        ? O.map(S.decodeOption(SampleRowJson)(text), (sample) => sample.at)
        : O.map(S.decodeOption(BucketReadingJson)(text), (reading) => reading.asOf);
    const readings = A.filter(
      listed,
      (name) => (Str.startsWith("sample-")(name) || Str.startsWith("transport-")(name)) && Str.endsWith(".json")(name)
    );
    yield* Effect.forEach(
      readings,
      Effect.fnUntraced(function* (name) {
        const file = path.join(latest, name);
        const text = yield* readOptional(file, "read a reading");
        // An unreadable reading is dropped by every read, so it is removed too.
        const expired = O.exists(text, (content) =>
          pipe(
            takenAt(name)(content),
            O.map((at) => DateTime.toEpochMillis(at) < limitMillis),
            O.getOrElse(() => true)
          )
        );
        if (expired) yield* removeIfPresent(file, "remove an old reading");
      }),
      { discard: true, concurrency: 8 }
    );
  });

  const removeCalibrationsBefore = Effect.fnUntraced(function* (limit: DateTime.Utc) {
    const base = yield* root;
    const file = path.join(base, CALIBRATION_FILE);
    const text = yield* readOptional(file, "read the calibration pairs");
    if (O.isNone(text)) return;
    const decode = partitionJsonLines(S.decodeUnknownOption(GithubLedgerRowJson));
    const read = decode(text.value);
    const kept = A.filter(
      read.rows,
      (row) => isCalibrationRow(row) && DateTime.toEpochMillis(row.at) >= DateTime.toEpochMillis(limit)
    );
    if (A.length(kept) === A.length(read.rows) && read.corruptLineCount === 0) return;
    const lines = yield* Effect.forEach(kept, encodeLine);
    yield* writePrivate(
      file,
      A.join(
        A.map(lines, (line) => `${line}\n`),
        ""
      ),
      "rewrite the calibration pairs"
    );
  });

  const removeBefore = Effect.fnUntraced(function* (cutoffs: RetentionCutoffs) {
    const rows = yield* dir("rows");
    const rollups = yield* dir("rollups");
    const hours = yield* rowHours;
    const before = (limit: DateTime.Utc) => {
      const limitMillis = limit.pipe(hourStartOf, DateTime.toEpochMillis);
      return (hour: DateTime.Utc) => DateTime.toEpochMillis(hour) < limitMillis;
    };
    const removeRows = (hour: DateTime.Utc) => removeIfPresent(rowFile(rows, hour), "remove a ledger hour");
    const expired = before(cutoffs.rowsBefore);
    yield* Effect.forEach(A.filter(hours, expired), removeRows, { discard: true });
    const kept = A.filter(hours, (hour) => !expired(hour));
    const sizes = yield* Effect.forEach(kept, (hour) =>
      fs.stat(rowFile(rows, hour)).pipe(
        Effect.map((info) => Number(info.size)),
        Effect.orElseSucceed(() => 0)
      )
    );
    // Over the byte cap, drop the oldest hours older than rowsKeepAfter until it fits.
    const total = A.reduce(sizes, 0, (sum, size) => sum + size);
    const evictable = A.filter(A.zip(kept, sizes), ([hour]) => before(cutoffs.rowsKeepAfter)(hour));
    const evict = A.reduce(evictable, { remaining: total, hours: A.empty<DateTime.Utc>() }, (state, [hour, size]) =>
      state.remaining > cutoffs.rowsMaxBytes
        ? { remaining: state.remaining - size, hours: A.append(state.hours, hour) }
        : state
    );
    yield* Effect.forEach(evict.hours, removeRows, { discard: true });
    const rollupNames = yield* listNames(rollups, "list rollups");
    const rollupHours = A.getSomes(A.map(rollupNames, hourOfFileName));
    yield* Effect.forEach(
      A.filter(rollupHours, before(cutoffs.rollupsBefore)),
      (hour) => removeIfPresent(path.join(rollups, `${hourFileKey(hour)}.json`), "remove a rollup"),
      { discard: true }
    );
    yield* removeLatestBefore(cutoffs.latestBefore);
    yield* removeCalibrationsBefore(cutoffs.calibrationsBefore);
  });

  const store: GithubLedgerStoreShape = {
    append,
    appendCalibration,
    calibrations,
    rows: readRows,
    rowHours,
    writeLatestSample,
    latestSamples: readLatestFiles("sample-", S.decodeUnknownOption(SampleRowJson)),
    writeLatestTransport,
    latestTransport: readLatestFiles("transport-", S.decodeUnknownOption(BucketReadingJson)),
    readAliases,
    writeAlias,
    readRollup,
    writeRollup,
    readSummary,
    writeSummary,
    acquireSamplerLease,
    removeBefore,
  };
  return store;
}).pipe(Effect.withSpan("GithubLedgerStore.makeLive"));

/**
 * The file store under `$XDG_STATE_HOME/beep/github/ledger`.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { layerGithubLedgerStoreLive } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubLedgerStoreLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerGithubLedgerStoreLive: Layer.Layer<GithubLedgerStore, never, FileSystem.FileSystem | Path.Path> =
  Layer.effect(GithubLedgerStore, makeGithubLedgerStoreLive);

/**
 * An in-memory store for tests, backed by `MutableHashMap`.
 *
 * **Example** (Build the memory store)
 *
 * ```ts
 * import { makeGithubLedgerStoreMemory } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * const store = Effect.runSync(makeGithubLedgerStoreMemory)
 * console.log(Effect.runSync(store.rowHours).length) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGithubLedgerStoreMemory = Effect.sync((): GithubLedgerStoreShape => {
  const rows = MutableHashMap.empty<number, ReadonlyArray<GithubLedgerRow>>();
  const calibrationRows = MutableHashMap.empty<"calibrations", ReadonlyArray<CalibrationRow>>();
  const samples = MutableHashMap.empty<string, SampleRow>();
  const transports = MutableHashMap.empty<string, BucketReading>();
  const rollups = MutableHashMap.empty<number, LedgerHourRollup>();
  const singletons = MutableHashMap.empty<"aliases" | "summary", IdentityAliases | LedgerSummary>();
  const leases = MutableHashSet.empty<string>();
  const hourKey = (at: DateTime.Utc) => at.pipe(hourStartOf, DateTime.toEpochMillis);
  const valuesOf = <K, V>(map: MutableHashMap.MutableHashMap<K, V>): ReadonlyArray<V> =>
    map.pipe(MutableHashMap.values, A.fromIterable);
  const keysOf = <K, V>(map: MutableHashMap.MutableHashMap<K, V>): ReadonlyArray<K> =>
    map.pipe(MutableHashMap.keys, A.fromIterable);
  const hoursOf = (): ReadonlyArray<DateTime.Utc> => A.sort(A.map(keysOf(rows), DateTime.makeUnsafe), DateTime.Order);
  const aliasesNow = (): IdentityAliases =>
    MutableHashMap.get(singletons, "aliases").pipe(
      O.filter(S.is(IdentityAliases)),
      O.getOrElse(() => emptyIdentityAliases)
    );
  const store: GithubLedgerStoreShape = {
    append: (row) =>
      encodeLine(row).pipe(
        Effect.andThen(
          Effect.sync(() => {
            const key = hourKey(row.at);
            const existing = O.getOrElse(MutableHashMap.get(rows, key), A.empty<GithubLedgerRow>);
            MutableHashMap.set(rows, key, A.append(existing, row));
          })
        )
      ),
    appendCalibration: (row) =>
      encodeLine(row).pipe(
        Effect.andThen(
          Effect.sync(() =>
            MutableHashMap.set(
              calibrationRows,
              "calibrations",
              A.append(O.getOrElse(MutableHashMap.get(calibrationRows, "calibrations"), A.empty<CalibrationRow>), row)
            )
          )
        )
      ),
    calibrations: Effect.sync(() =>
      O.getOrElse(MutableHashMap.get(calibrationRows, "calibrations"), A.empty<CalibrationRow>)
    ),
    rows: (range) =>
      Effect.sync(() =>
        A.filter(
          A.flatMap(rangeHours(range), (hour) =>
            O.getOrElse(MutableHashMap.get(rows, DateTime.toEpochMillis(hour)), A.empty<GithubLedgerRow>)
          ),
          inRange(range)
        )
      ),
    rowHours: Effect.sync(hoursOf),
    writeLatestSample: (row) => Effect.sync(() => MutableHashMap.set(samples, row.identity, row)),
    latestSamples: Effect.sync(() => valuesOf(samples)),
    writeLatestTransport: (reading) =>
      Effect.sync(() => MutableHashMap.set(transports, bucketKeyString(reading.key), reading)),
    latestTransport: Effect.sync(() => valuesOf(transports)),
    readAliases: Effect.sync(aliasesNow),
    writeAlias: (token, user) =>
      Effect.sync(() =>
        MutableHashMap.set(
          singletons,
          "aliases",
          IdentityAliases.make({ aliases: R.set(aliasesNow().aliases, token, user) })
        )
      ),
    readRollup: (hour) => Effect.sync(() => MutableHashMap.get(rollups, hourKey(hour))),
    writeRollup: (rollup) => Effect.sync(() => MutableHashMap.set(rollups, hourKey(rollup.hour), rollup)),
    readSummary: Effect.sync(() => O.filter(MutableHashMap.get(singletons, "summary"), S.is(LedgerSummary))),
    writeSummary: (summary) => Effect.sync(() => MutableHashMap.set(singletons, "summary", summary)),
    acquireSamplerLease: (identity) =>
      Effect.suspend(() => {
        if (MutableHashSet.has(leases, identity)) return Effect.succeed(false);
        MutableHashSet.add(leases, identity);
        return Effect.as(
          Effect.addFinalizer(() => Effect.sync(() => MutableHashSet.remove(leases, identity))),
          true
        );
      }),
    removeBefore: (cutoffs) =>
      Effect.sync(() => {
        const rowsLimit = hourKey(cutoffs.rowsBefore);
        const rollupsLimit = hourKey(cutoffs.rollupsBefore);
        A.forEach(
          A.filter(keysOf(rows), (key) => key < rowsLimit),
          (key) => MutableHashMap.remove(rows, key)
        );
        A.forEach(
          A.filter(keysOf(rollups), (key) => key < rollupsLimit),
          (key) => MutableHashMap.remove(rollups, key)
        );
        const latestLimit = DateTime.toEpochMillis(cutoffs.latestBefore);
        A.forEach(
          A.filter(A.fromIterable(samples), ([, sample]) => DateTime.toEpochMillis(sample.at) < latestLimit),
          ([key]) => MutableHashMap.remove(samples, key)
        );
        A.forEach(
          A.filter(A.fromIterable(transports), ([, reading]) => DateTime.toEpochMillis(reading.asOf) < latestLimit),
          ([key]) => MutableHashMap.remove(transports, key)
        );
        const calibrationLimit = DateTime.toEpochMillis(cutoffs.calibrationsBefore);
        MutableHashMap.modify(calibrationRows, "calibrations", (kept) =>
          A.filter(kept, (row) => DateTime.toEpochMillis(row.at) >= calibrationLimit)
        );
      }),
  };
  return store;
});

/**
 * {@link GithubLedgerStore} backed by memory, for tests.
 *
 * **Example** (Provide the memory store)
 *
 * ```ts
 * import { layerGithubLedgerStoreMemory } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubLedgerStoreMemory)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerGithubLedgerStoreMemory: Layer.Layer<GithubLedgerStore> = Layer.effect(
  GithubLedgerStore,
  makeGithubLedgerStoreMemory
);

const byHour = Order.mapInput(Order.Number, DateTime.toEpochMillis);

/**
 * The hours between two instants, inclusive, oldest first.
 *
 * **Example** (List two hours)
 *
 * ```ts
 * import { LedgerRange, hoursOfRange } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(hoursOfRange(LedgerRange.make({ from: DateTime.makeUnsafe(0), to: DateTime.makeUnsafe(3_600_000) })).length) // 2
 * ```
 *
 * @param range - The range.
 * @returns The hour starts it touches.
 * @category utilities
 * @since 0.0.0
 */
export const hoursOfRange = (range: LedgerRange): ReadonlyArray<DateTime.Utc> => A.sort(rangeHours(range), byHour);
