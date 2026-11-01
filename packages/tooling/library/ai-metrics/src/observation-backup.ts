/**
 * Bounded independent journal snapshots and restoration into fresh destinations.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { observationJournalTables } from "./internal/observation-journal-tables.ts";
import { TranscriptIntakeConfig } from "./transcript-intake.ts";
import type * as SqlConnection from "effect/sql/SqlConnection";

const $I = $RepoAiMetricsId.create("observation-backup");
/**
 * Per-snapshot byte ceiling, independent of the journal's logical payload budget.
 *
 * **Details**
 *
 * Hashing uses a bounded in-memory copy. Aggregate generation retention, physical disk headroom and a hard process deadline are deployment responsibilities.
 *
 * **Example** (Set a one-mebibyte backup limit)
 *
 * ```ts
 * import { ObservationBackupPolicy } from "@beep/repo-ai-metrics/observation-backup"
 * console.log(ObservationBackupPolicy.make({ maxBytes: 1048576 }).maxBytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationBackupPolicy extends S.Opaque<ObservationBackupPolicy, { readonly brand: unique symbol }>()(
  S.Struct({ maxBytes: S.Int.check(S.isBetween({ minimum: 1048576, maximum: 33554432 })) }).pipe(
    $I.annoteSchema("ObservationBackupPolicy", { description: "Explicit bounded physical snapshot size." })
  )
) {}
/**
 * Content and source identity of an independent physical snapshot.
 *
 * **Details**
 *
 * Contains no local paths or source content. A snapshot is a recovery point, not evidence that later observations can be discarded.
 *
 * **Example** (Inspect the observation backup manifest constructor)
 *
 * ```ts
 * import { ObservationBackupManifest } from "@beep/repo-ai-metrics/observation-backup"
 * console.log(typeof ObservationBackupManifest.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationBackupManifest extends S.Opaque<ObservationBackupManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-backup/v1"),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    configDigest: Sha256Hex,
    snapshotDigest: Sha256Hex,
    bytes: S.Int.check(S.isBetween({ minimum: 4096, maximum: 33554432 })),
    createdAt: S.Natural,
  }).pipe($I.annoteSchema("ObservationBackupManifest", { description: "Verified independent journal recovery point." }))
) {}
/**
 * Caller-retained digest binding a snapshot's manifest and database.
 *
 * **Details**
 *
 * Retain this receipt outside the backup directory. Restore requires it; a self-edited manifest cannot authorize different bytes.
 *
 * **Example** (Inspect the observation backup receipt constructor)
 *
 * ```ts
 * import { ObservationBackupReceipt } from "@beep/repo-ai-metrics/observation-backup"
 * console.log(typeof ObservationBackupReceipt.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationBackupReceipt extends S.Opaque<ObservationBackupReceipt, { readonly brand: unique symbol }>()(
  S.Struct({ manifest: ObservationBackupManifest, manifestDigest: Sha256Hex }).pipe(
    $I.annoteSchema("ObservationBackupReceipt", { description: "External digest binding for one physical snapshot." })
  )
) {}
/**
 * Content-free snapshot refusal.
 * **Example** (Inspecting a failure)
 * ```ts
 * import { ObservationBackupError } from "@beep/repo-ai-metrics/observation-backup"
 * console.log(ObservationBackupError.make({ reason: "integrity" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationBackupError extends S.TaggedError<ObservationBackupError, { readonly brand: unique symbol }>(
  $I`ObservationBackupError`
)(
  "ObservationBackupError",
  { reason: S.Literals(["configuration", "capacity", "integrity", "destination", "storage"]) },
  $I.annote("ObservationBackupError", { description: "Safe physical snapshot refusal without source content." })
) {}
const failure = (reason: ObservationBackupError["reason"]) => ObservationBackupError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(ObservationBackupError)(error) ? error : failure("storage"))));
const digest = Effect.fn("ObservationBackup.digest")(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  return Sha256Hex.make(Hex.encode(yield* digest.digest(Digest.sha256, bytes)));
});
const readBounded = Effect.fn("ObservationBackup.readBounded")(function* (file: string, limit: number) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.lstat(file);
  if (info.type !== "File" || ByteSize.toBigInt(info.size) > BigInt(limit)) return yield* failure("capacity");
  const handle = yield* fs.open(file, { flag: "r" });
  const bytes = new Uint8Array(Number(ByteSize.toBigInt(info.size)));
  let offset = 0;
  while (offset < bytes.length) {
    const count = yield* handle.read(bytes.subarray(offset, Math.min(bytes.length, offset + 65536)));
    if (count === 0) return yield* failure("integrity");
    offset += count;
  }
  if ((yield* handle.read(new Uint8Array(1))) !== 0) return yield* failure("capacity");
  return bytes;
});
const syncDirectory = Effect.fn("ObservationBackup.syncDirectory")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const handle = yield* fs.open(directory, { flag: "r" });
  yield* handle.sync;
});
const newDestination = Effect.fn("ObservationBackup.newDestination")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory) return yield* failure("destination");
  const parent = path.dirname(directory);
  const info = yield* fs.lstat(parent);
  if (info.type !== "Directory" || (info.mode & 0o077) !== 0 || (yield* fs.realPath(parent)) !== parent)
    return yield* failure("destination");
  yield* fs.makeDirectory(directory, { mode: 0o700 }).pipe(Effect.mapError(() => failure("destination")));
  yield* syncDirectory(parent);
});
const writeSynced = Effect.fn("ObservationBackup.writeSynced")(function* (file: string, bytes: Uint8Array) {
  const fs = yield* FileSystem.FileSystem;
  const handle = yield* fs.open(file, { flag: "wx", mode: 0o600 });
  yield* handle.writeAll(bytes);
  yield* handle.sync;
});
const decodeNameRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ name: S.String })));
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ integrity_check: S.tag("ok") })]));
const decodeArguments2 = S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String.check(S.isMaxLength(4096)) })]));
const decodeTranscriptIntakeConfigJson = S.decodeEffect(S.fromJsonString(TranscriptIntakeConfig));

const verifyJournalTables = Effect.fnUntraced(function* (
  connection: SqlConnection.Connection,
  query: string,
  reason: ObservationBackupError["reason"]
) {
  const tables = yield* connection
    .executeUnprepared(query, [observationJournalTables.length + 1], undefined)
    .pipe(Effect.flatMap(decodeNameRecordRows));
  if (
    tables.length > observationJournalTables.length ||
    A.some(tables, (row) => !A.contains(observationJournalTables, row.name))
  )
    return yield* failure(reason);
});

const inspectSnapshot = Effect.fn("ObservationBackup.inspectSnapshot")(function* (
  connection: SqlConnection.Connection,
  file: string,
  configDigest: Sha256Hex,
  hostId: Sha256Hex,
  namespaceId: Sha256Hex
) {
  yield* Effect.acquireUseRelease(
    connection.executeUnprepared("ATTACH DATABASE ? AS observation_snapshot", [file], undefined),
    Effect.fnUntraced(function* () {
      yield* verifyJournalTables(
        connection,
        "SELECT name FROM observation_snapshot.sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' LIMIT ?",
        "integrity"
      );
      yield* connection
        .executeUnprepared("PRAGMA observation_snapshot.integrity_check(1)", [], undefined)
        .pipe(Effect.flatMap(decodeArguments));
      const rows = yield* connection
        .executeUnprepared(
          "SELECT substr(payload,1,4097) AS payload FROM observation_snapshot.observation_intake_config WHERE singleton=1",
          [],
          undefined
        )
        .pipe(Effect.flatMap(decodeArguments2));
      const config = yield* decodeTranscriptIntakeConfigJson(rows[0].payload);
      if (config.hostId !== hostId || config.namespaceId !== namespaceId) return yield* failure("integrity");
      if ((yield* digest(new TextEncoder().encode(rows[0].payload))) !== configDigest)
        return yield* failure("integrity");
    }),
    () => connection.executeUnprepared("DETACH DATABASE observation_snapshot", [], undefined).pipe(Effect.orDie)
  );
});
const decodeArguments3 = S.decodeUnknownEffect(S.Tuple([S.Struct({ name: S.tag("main"), file: S.NonEmptyString })]));
const encodeTranscriptIntakeConfigJson = S.encodeEffect(S.fromJsonString(TranscriptIntakeConfig));
const decodeArguments4 = S.decodeUnknownEffect(S.Tuple([S.Struct({ journal_mode: S.tag("delete") })]));
const decodeArguments5 = S.decodeUnknownEffect(S.Tuple([S.Struct({ synchronous: S.tag(3) })]));
const decodeArguments6 = S.decodeUnknownEffect(S.Tuple([S.Struct({ page_count: S.Natural })]));
const decodeArguments7 = S.decodeUnknownEffect(S.Tuple([S.Struct({ page_size: S.tag(4096) })]));
const encodeObservationBackupManifestJson = S.encodeEffect(S.fromJsonString(ObservationBackupManifest));

/**
 * Capture an owned, paused and drained journal into a newly created private directory.
 *
 * **Details**
 *
 * The worker must serialize this operation under maintenance and hold its OS ownership lock. Reserves the SQLite connection, checks source identity and size, uses VACUUM INTO, verifies integrity/configuration, and syncs the database before atomically publishing a bounded manifest. Existing destinations are refused. Failure/crash may leave an uncommitted new directory; no prior generation or source is overwritten. SQLite work is synchronous: use the qualified process limits, not a claimed interruptible JavaScript deadline. Snapshot retention and off-device replication remain separate.
 *
 * **Example** (Inspect the physical-backup capture function)
 *
 * ```ts
 * import { captureObservationBackup } from "@beep/repo-ai-metrics/observation-backup"
 * console.log(typeof captureObservationBackup)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const captureObservationBackup = Effect.fn("AiMetrics.captureObservationBackup")(
  (config: TranscriptIntakeConfig, policy: ObservationBackupPolicy, directory: string) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const fs = yield* FileSystem.FileSystem;
      const connection = yield* sql.reserve;
      const databases = yield* connection
        .executeUnprepared("PRAGMA database_list", [], undefined)
        .pipe(Effect.flatMap(decodeArguments3));
      if (!Str.startsWith("/")(databases[0].file)) return yield* failure("configuration");
      const rows = yield* connection
        .executeUnprepared(
          "SELECT substr(payload,1,4097) AS payload FROM observation_intake_config WHERE singleton=1",
          [],
          undefined
        )
        .pipe(Effect.flatMap(decodeArguments2));
      yield* verifyJournalTables(
        connection,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' LIMIT ?",
        "configuration"
      );
      const expected = yield* encodeTranscriptIntakeConfigJson(config);
      if (rows[0].payload !== expected) return yield* failure("configuration");
      yield* connection.executeUnprepared("PRAGMA journal_mode", [], undefined).pipe(Effect.flatMap(decodeArguments4));
      yield* connection.executeUnprepared("PRAGMA synchronous", [], undefined).pipe(Effect.flatMap(decodeArguments5));
      const pages = yield* connection
        .executeUnprepared("PRAGMA page_count", [], undefined)
        .pipe(Effect.flatMap(decodeArguments6));
      yield* connection.executeUnprepared("PRAGMA page_size", [], undefined).pipe(Effect.flatMap(decodeArguments7));
      if (pages[0].page_count * 4096 > policy.maxBytes) return yield* failure("capacity");
      yield* newDestination(directory);
      const file = `${directory}/journal.sqlite`;
      yield* connection.executeUnprepared("VACUUM main INTO ?", [file], undefined);
      yield* fs.chmod(file, 0o600);
      const handle = yield* fs.open(file, { flag: "r" });
      yield* handle.sync;
      const bytes = yield* readBounded(file, policy.maxBytes);
      const configDigest = yield* digest(new TextEncoder().encode(expected));
      yield* inspectSnapshot(connection, file, configDigest, config.hostId, config.namespaceId).pipe(
        Effect.mapError(() => failure("integrity"))
      );
      const manifest = ObservationBackupManifest.make({
        hostId: config.hostId,
        namespaceId: config.namespaceId,
        configDigest,
        snapshotDigest: yield* digest(bytes),
        bytes: bytes.length,
        createdAt: yield* Clock.currentTimeMillis,
      });
      const encoded = new TextEncoder().encode(yield* encodeObservationBackupManifestJson(manifest));
      yield* writeSynced(`${directory}/manifest.partial`, encoded);
      yield* fs.rename(`${directory}/manifest.partial`, `${directory}/manifest.json`);
      yield* syncDirectory(directory);
      return ObservationBackupReceipt.make({ manifest, manifestDigest: yield* digest(encoded) });
    }).pipe(Effect.scoped, safe)
);
const decodeObservationBackupManifestJson = S.decodeEffect(S.fromJsonString(ObservationBackupManifest));
const decodeArguments8 = S.decodeUnknownEffect(S.Tuple([S.Struct({ name: S.tag("main"), file: S.tag("") })]));
const encodeObservationBackupReceiptJson = S.encodeEffect(S.fromJsonString(ObservationBackupReceipt));

/**
 * Restore a verified snapshot into a fresh directory, preserving every existing database.
 *
 * **Details**
 *
 * Uses a dedicated disposable SQLite verification client, independent of a damaged source. Requires the caller-retained receipt, verifies manifest/database digests and integrity, writes/syncs a distinct database and publishes restore.json last. Never rewinds a live journal or resumes a worker. The caller must explicitly select the recovered route, reconcile the recovery-point gap and retain the superseded file. An incomplete destination has no valid completion marker and is not a usable restore.
 *
 * **Example** (Inspect the physical-backup restore function)
 *
 * ```ts
 * import { restoreObservationBackup } from "@beep/repo-ai-metrics/observation-backup"
 * console.log(typeof restoreObservationBackup)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const restoreObservationBackup = Effect.fn("AiMetrics.restoreObservationBackup")(
  (policy: ObservationBackupPolicy, backupDirectory: string, directory: string, receipt: ObservationBackupReceipt) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const fs = yield* FileSystem.FileSystem;
      if (receipt.manifest.bytes > policy.maxBytes) return yield* failure("capacity");
      const encoded = yield* readBounded(`${backupDirectory}/manifest.json`, 4096);
      if ((yield* digest(encoded)) !== receipt.manifestDigest) return yield* failure("integrity");
      const manifest = yield* decodeObservationBackupManifestJson(new TextDecoder().decode(encoded));
      const expected = yield* encodeObservationBackupManifestJson(receipt.manifest);
      if ((yield* encodeObservationBackupManifestJson(manifest)) !== expected) return yield* failure("integrity");
      const bytes = yield* readBounded(`${backupDirectory}/journal.sqlite`, policy.maxBytes);
      if (bytes.length !== manifest.bytes || (yield* digest(bytes)) !== manifest.snapshotDigest)
        return yield* failure("integrity");
      const connection = yield* sql.reserve;
      yield* connection.executeUnprepared("PRAGMA database_list", [], undefined).pipe(
        Effect.flatMap(decodeArguments8),
        Effect.mapError(() => failure("configuration"))
      );
      yield* newDestination(directory);
      const file = `${directory}/journal.sqlite`;
      yield* writeSynced(file, bytes);
      yield* inspectSnapshot(connection, file, manifest.configDigest, manifest.hostId, manifest.namespaceId).pipe(
        Effect.mapError(() => failure("integrity"))
      );
      const marker = new TextEncoder().encode(yield* encodeObservationBackupReceiptJson(receipt));
      yield* writeSynced(`${directory}/restore.partial`, marker);
      yield* fs.rename(`${directory}/restore.partial`, `${directory}/restore.json`);
      yield* syncDirectory(directory);
      return receipt;
    }).pipe(Effect.scoped, safe)
);
