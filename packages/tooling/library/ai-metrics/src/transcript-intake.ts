/**
 * Atomic metadata-page acceptance and source cursors on an owned SQLite connection.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { EvidenceWindow, RetiredEvidenceTotals, readEvidenceWindow } from "./evidence-window.ts";
import { requireDispositionCapacity } from "./internal/disposition-capacity.ts";
import { observationJournalTables as tables } from "./internal/observation-journal-tables.ts";
import { CanonicalOwnershipSummary } from "./internal/unenrolled-evidence.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { TranscriptCursor, TranscriptPage } from "./transcript-page.ts";

const $I = $RepoAiMetricsId.create("transcript-intake");
/**
 * Bounded candidate identities for one fair scheduling reservation.
 *
 * **Details**
 *
 * Candidates are source-qualified hashes, never paths. Scheduling is independent of durable source progress; reserving a failed source cannot advance its accepted byte cursor.
 *
 * **Example** (Set a one-candidate scheduling limit)
 *
 * ```ts
 * import { TranscriptScheduleInput } from "@beep/repo-ai-metrics/transcript-intake"
 * console.log(TranscriptScheduleInput.make({ candidates: [], limit: 1 }).limit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptScheduleInput extends S.Opaque<TranscriptScheduleInput, { readonly brand: unique symbol }>()(
  S.Struct({
    candidates: S.Array(Sha256Hex).check(S.isMaxLength(4096)),
    limit: S.Int.check(S.isBetween({ minimum: 1, maximum: 32 })),
  }).pipe($I.annoteSchema("TranscriptScheduleInput", { description: "Bounded fair source reservation." }))
) {}
/**
 * Fixed ownership and storage bounds for a dedicated local intake database.
 *
 * **Details**
 *
 * A changed host, namespace or limit profile requires an explicit migration. Database pages are 4096 bytes; rollback-journal space and filesystem overhead need separate deployment headroom.
 *
 * **Example** (Reject an empty transcript intake config)
 *
 * ```ts
 * import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptIntakeConfig)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptIntakeConfig extends S.Opaque<TranscriptIntakeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("transcript-intake/v1"),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    maxPages: S.Int.check(S.isBetween({ minimum: 1, maximum: 65536 })),
    maxPayloadBytes: S.Int.check(S.isBetween({ minimum: 4096, maximum: 268435456 })),
    maxDatabasePages: S.Int.check(S.isBetween({ minimum: 256, maximum: 131072 })),
  }).pipe(
    $I.annoteSchema("TranscriptIntakeConfig", {
      description: "Explicit metadata journal scope and hard logical/database bounds.",
    })
  )
) {}
/**
 * Local transaction acceptance, distinct from export or backend visibility.
 *
 * **Details**
 *
 * Returned only after the page and cursor transaction commits. Exact replays return the same receipt. It does not assert Phoenix storage or delivery.
 *
 * **Example** (Reject an empty transcript acceptance)
 *
 * ```ts
 * import { TranscriptAcceptance } from "@beep/repo-ai-metrics/transcript-intake"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptAcceptance)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptAcceptance extends S.Opaque<TranscriptAcceptance, { readonly brand: unique symbol }>()(
  S.Struct({
    receiptId: Sha256Hex,
    sequence: S.Natural,
    acceptedAt: S.Natural,
    payloadBytes: S.Natural,
    frames: S.Natural,
    evidenceEpoch: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
  }).pipe(
    $I.annoteSchema("TranscriptAcceptance", { description: "Stable receipt for one locally accepted metadata page." })
  )
) {}
/**
 * Durable evidence that a verified page payload was intentionally reclaimed.
 *
 * **Details**
 *
 * The original acceptance and event identities survive payload removal. Verification is historical evidence, not a promise of perpetual backend retention. This record never represents uncertain expiry.
 *
 * **Example** (Inspect the verified page disposition constructor)
 *
 * ```ts
 * import { VerifiedPageDisposition } from "@beep/repo-ai-metrics/transcript-intake"
 * console.log(typeof VerifiedPageDisposition.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerifiedPageDisposition extends S.Opaque<VerifiedPageDisposition, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("verified-page-disposition/v1"),
    reason: S.tag("backend-verified"),
    page: TranscriptAcceptance,
    disposedAt: S.Natural,
    enrolledOwnership: S.optionalKey(CanonicalOwnershipSummary),
    verifiedEvents: S.Natural,
  }).pipe(
    $I.annoteSchema("VerifiedPageDisposition", { description: "Preserved receipt after verified payload reclamation." })
  )
) {}
/**
 * Explicit retention expiry with the delivery-state population at removal.
 *
 * **Details**
 *
 * Counts describe unique accepted event references in this page, including native duplicates owned by other pages. They are a historical snapshot, not fleet totals or a delivery outcome. Never-enrolled references remain separate from the five delivery states; native canonical ownership has a separate count and checksum. Expiry never writes a successful result or visibility fact.
 *
 * **Example** (Inspect the expired page disposition constructor)
 *
 * ```ts
 * import { ExpiredPageDisposition } from "@beep/repo-ai-metrics/transcript-intake"
 * console.log(typeof ExpiredPageDisposition.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpiredPageDisposition extends S.Opaque<ExpiredPageDisposition, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("expired-page-disposition/v1"),
    reason: S.tag("retention-expired"),
    page: TranscriptAcceptance,
    disposedAt: S.Natural,
    enrolledOwnership: S.optionalKey(CanonicalOwnershipSummary),
    eventCount: S.Natural.check(S.isLessThanOrEqualTo(4096)),
    unenrolledReferences: S.optionalKey(S.Natural.check(S.isLessThanOrEqualTo(4096))),
    unenrolledNativeOwnership: S.optionalKey(CanonicalOwnershipSummary),
    states: S.Struct({
      pending: S.Natural,
      acceptedUnverified: S.Natural,
      visible: S.Natural,
      rejected: S.Natural,
      unresolved: S.Natural,
    }),
  })
    .check(
      S.makeFilter(
        (value) =>
          value.eventCount ===
            value.states.pending +
              value.states.acceptedUnverified +
              value.states.visible +
              value.states.rejected +
              value.states.unresolved +
              (value.unenrolledReferences ?? 0) &&
          (value.unenrolledNativeOwnership?.count ?? 0) <= (value.unenrolledReferences ?? 0),
        {
          identifier: "ExpiryPopulation",
          message: "Expiry states must reconcile to unique accepted events",
        }
      )
    )
    .pipe(
      $I.annoteSchema("ExpiredPageDisposition", {
        description: "Explicit expiry preserving historical delivery populations.",
      })
    )
) {}
/**
 * Durable payload disposition, distinguishing verification from retention expiry.
 * **Example** (Inspecting supported dispositions)
 * ```ts
 * import { PageDisposition } from "@beep/repo-ai-metrics/transcript-intake"
 * import * as S from "effect/Schema"
 * console.log(S.is(PageDisposition)({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export const PageDisposition = S.Union([VerifiedPageDisposition, ExpiredPageDisposition]).pipe(
  $I.annoteSchema("PageDisposition", { description: "Checksummed reason for metadata payload removal." })
);
/**
 * Validated payload disposition returned by journal maintenance.
 *
 * **Example** (Read a disposition reason)
 * ```ts
 * import type { PageDisposition } from "@beep/repo-ai-metrics/transcript-intake"
 * const reason = (disposition: PageDisposition) => disposition.reason
 * ```
 * @category models
 * @since 0.0.0
 */
export type PageDisposition = typeof PageDisposition.Type;
/**
 * Current retained metadata totals, not a fleet coverage count.
 *
 * **Details**
 *
 * Counts include transcript pages and native request batches admitted into this journal. Frames count accepted occurrences, including duplicate native occurrences; they are not unique-event or coverage counts. Physical SQLite and rollback-journal sizes are separate health measurements.
 *
 * **Example** (Reject an empty transcript intake stats)
 *
 * ```ts
 * import { TranscriptIntakeStats } from "@beep/repo-ai-metrics/transcript-intake"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptIntakeStats)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptIntakeStats extends S.Opaque<TranscriptIntakeStats, { readonly brand: unique symbol }>()(
  S.Struct({ pages: S.Natural, payloadBytes: S.Natural, frames: S.Natural }).pipe(
    $I.annoteSchema("TranscriptIntakeStats", { description: "Retained page, payload and frame counts." })
  )
) {}
/**
 * Safe refusal of intake without advancing source progress.
 *
 * **Details**
 *
 * SQL errors never expose paths, query parameters or payloads. A storage failure requires checking the durable cursor before retrying an uncertain acknowledgment.
 *
 * **Example** (Construct a capacity refusal)
 *
 * ```ts
 * import { TranscriptIntakeError } from "@beep/repo-ai-metrics/transcript-intake"
 * console.log(TranscriptIntakeError.make({ reason: "capacity" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TranscriptIntakeError extends S.TaggedError<TranscriptIntakeError, { readonly brand: unique symbol }>(
  $I`TranscriptIntakeError`
)(
  "TranscriptIntakeError",
  {
    reason: S.Literals([
      "not-owned",
      "configuration",
      "namespace",
      "stale-cursor",
      "capacity",
      "oversize",
      "reclaimed",
      "expired",
      "storage",
    ]),
  },
  $I.annote("TranscriptIntakeError", { description: "Payload-free intake refusal." })
) {
  /**
   * Content-free intake refusal description.
   *
   * @returns A fixed message containing only the enumerated refusal reason.
   */
  override get message(): string {
    return `Transcript intake refused (${this.reason}).`;
  }
}
const failure = (reason: TranscriptIntakeError["reason"]) => TranscriptIntakeError.make({ reason });
const encodeCursor = S.encodeEffect(S.fromJsonString(TranscriptCursor));
const decodeCursor = S.decodeEffect(S.fromJsonString(TranscriptCursor), { onExcessProperty: "error" });
const PayloadRows = S.Array(S.Struct({ payload: S.String }));
const ReceiptRows = S.Array(TranscriptAcceptance);
const singleStats = S.Tuple([TranscriptIntakeStats]);

/**
 * Preserve typed intake refusals while redacting unknown storage failures.
 *
 * **Details**
 *
 * Native and reconstructed intake share this boundary. Unknown errors
 * become content-free storage refusals; known intake errors retain their identity.
 *
 * **Example** (Preserve a known intake refusal reason)
 *
 * ```ts
 * import { sanitizeTranscriptIntakeError, TranscriptIntakeError } from "@beep/repo-ai-metrics/transcript-intake"
 * console.log(sanitizeTranscriptIntakeError(TranscriptIntakeError.make({ reason: "capacity" })).reason)
 * ```
 *
 * @param error - A typed refusal or untrusted storage error to sanitize.
 * @returns The existing safe refusal, or a content-free storage refusal.
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeTranscriptIntakeError = (error: unknown): TranscriptIntakeError =>
  S.is(TranscriptIntakeError)(error) ? error : failure("storage");
const safe = Effect.mapError(sanitizeTranscriptIntakeError);
const encodeTranscriptIntakeConfigJson = S.encodeEffect(S.fromJsonString(TranscriptIntakeConfig));
const decodeNameRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ name: S.String })));
const decodeNameFileRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ name: S.String, file: S.String })));
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ synchronous: S.tag(3) })]));
const decodeArguments2 = S.decodeUnknownEffect(S.Tuple([S.Struct({ journal_mode: S.tag("delete") })]));
const decodeArguments3 = S.decodeUnknownEffect(S.Tuple([S.Struct({ page_size: S.tag(4096) })]));
const decodeArguments4 = S.decodeUnknownEffect(S.Tuple([S.Struct({ max_page_count: S.Natural })]));
const encodeEvidenceWindowJson = S.encodeEffect(S.fromJsonString(EvidenceWindow));
const decodeArguments5 = S.decodeUnknownEffect(S.Tuple([S.Struct({ bytes: S.Natural })]));
const decodePayloadDigestRecordRows = S.decodeUnknownEffect(
  S.Array(S.Struct({ payload: S.String, digest: Sha256Hex }))
);
const decodePageDispositionJson = S.decodeEffect(S.fromJsonString(PageDisposition), {
  onExcessProperty: "error",
});
const encodeTranscriptPageJson = S.encodeEffect(S.fromJsonString(TranscriptPage));
const decodeArguments6 = S.decodeUnknownEffect(S.Tuple([TranscriptAcceptance]));
const decodeSourceIdRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ sourceId: Sha256Hex })));

const requireStoredConfiguration = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, configJson: string) {
  const existing =
    yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_intake_config WHERE singleton = 1`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
    );
  if (existing.length !== 1 || existing[0]?.payload !== configJson) return yield* failure("configuration");
});
const requireOwnedJournal = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, configJson: string) {
  const names =
    yield* sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' LIMIT ${tables.length + 1}`.pipe(
      Effect.flatMap(decodeNameRecordRows)
    );
  if (
    names.length > tables.length ||
    A.some(names, (row) => !A.contains(tables, row.name)) ||
    (names.length > 0 && !A.some(names, (row) => row.name === "observation_intake_config"))
  )
    return yield* failure("not-owned");
  if (names.length > 0) {
    yield* requireStoredConfiguration(sql, configJson);
  }
});
const configureJournalDatabase = Effect.fnUntraced(function* (
  sql: SqlClient.SqlClient,
  config: TranscriptIntakeConfig
) {
  const databases = yield* sql`PRAGMA database_list`.pipe(Effect.flatMap(decodeNameFileRecordRows));
  if (databases.length !== 1 || databases[0]?.name !== "main" || databases[0]?.file === "")
    return yield* failure("configuration");
  yield* sql`PRAGMA page_size = 4096`;
  yield* sql`PRAGMA journal_mode = DELETE`;
  yield* sql`PRAGMA synchronous = EXTRA`;
  yield* sql`PRAGMA mmap_size = 0`;
  yield* sql`PRAGMA cache_size = -2048`;
  yield* sql.unsafe(`PRAGMA max_page_count = ${config.maxDatabasePages}`);
  yield* sql`PRAGMA synchronous`.pipe(Effect.flatMap(decodeArguments));
  yield* sql`PRAGMA journal_mode`.pipe(Effect.flatMap(decodeArguments2));
  yield* sql`PRAGMA page_size`.pipe(Effect.flatMap(decodeArguments3));
  const ceiling = yield* sql`PRAGMA max_page_count`.pipe(Effect.flatMap(decodeArguments4));
  if (ceiling[0].max_page_count !== config.maxDatabasePages) return yield* failure("configuration");
});
const initializeJournalTables = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, configJson: string) {
  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`CREATE TABLE IF NOT EXISTS observation_intake_config (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL)`;
      yield* sql`INSERT OR IGNORE INTO observation_intake_config(singleton,payload) VALUES (1,${configJson})`;
      yield* requireStoredConfiguration(sql, configJson);
      yield* sql`CREATE TABLE IF NOT EXISTS observation_intake_pages (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id TEXT NOT NULL UNIQUE,
        source_key TEXT NOT NULL, payload TEXT NOT NULL, payload_bytes INTEGER NOT NULL CHECK(payload_bytes>0),
        frames INTEGER NOT NULL CHECK(frames>=0), accepted_at INTEGER NOT NULL,evidence_epoch INTEGER NOT NULL DEFAULT 0)`;
      const columns = yield* sql`PRAGMA table_info(observation_intake_pages)`.pipe(
        Effect.flatMap(decodeNameRecordRows)
      );
      if (!A.some(columns, (c) => c.name === "evidence_epoch"))
        yield* sql`ALTER TABLE observation_intake_pages ADD COLUMN evidence_epoch INTEGER NOT NULL DEFAULT 0`;
      yield* sql`CREATE TABLE IF NOT EXISTS observation_evidence_window(singleton INTEGER PRIMARY KEY CHECK(singleton=1),payload TEXT NOT NULL,digest TEXT NOT NULL)`;
      const window = EvidenceWindow.make({
        epoch: 0,
        openedAt: yield* Clock.currentTimeMillis,
        latest: O.none(),
        totals: RetiredEvidenceTotals.make({
          pages: 0,
          payloadBytes: 0,
          nativeAcceptedOccurrences: 0,
          nativeRejectedOccurrences: 0,
          transcriptFrameOccurrences: 0,
          eventObservations: 0,
          attempts: 0,
          pending: 0,
          acceptedUnverified: 0,
          visible: 0,
          rejected: 0,
          unresolved: 0,
          verifiedPages: 0,
          expiredPages: 0,
        }),
      });
      const windowPayload = yield* encodeEvidenceWindowJson(window);
      const windowDigest = yield* hashPublicTextSha256(windowPayload);
      yield* sql`INSERT OR IGNORE INTO observation_evidence_window(singleton,payload,digest) VALUES(1,${windowPayload},${windowDigest})`;
      yield* readEvidenceWindow().pipe(Effect.provideService(SqlClient.SqlClient, sql));
      yield* sql`CREATE TABLE IF NOT EXISTS observation_launch_facts (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, launch_id TEXT NOT NULL, phase INTEGER NOT NULL CHECK(phase BETWEEN 0 AND 3),
        payload TEXT NOT NULL, payload_bytes INTEGER NOT NULL CHECK(payload_bytes>0), digest TEXT NOT NULL,
        recorded_at INTEGER NOT NULL, evidence_epoch INTEGER NOT NULL, UNIQUE(launch_id,phase))`;
      yield* sql`CREATE TABLE IF NOT EXISTS observation_page_dispositions (receipt_id TEXT PRIMARY KEY, payload TEXT NOT NULL, digest TEXT NOT NULL)`;
      yield* sql`CREATE TABLE IF NOT EXISTS observation_source_cursors (source_key TEXT PRIMARY KEY, payload TEXT NOT NULL, receipt_id TEXT NOT NULL)`;
      yield* sql`CREATE TABLE IF NOT EXISTS observation_schedule_cursor (singleton INTEGER PRIMARY KEY CHECK(singleton=1), source_id TEXT NOT NULL)`;
      yield* sql`CREATE TABLE IF NOT EXISTS observation_native_events (event_id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, receipt_id TEXT NOT NULL, span_index INTEGER NOT NULL)`;
      yield* sql`CREATE INDEX IF NOT EXISTS observation_native_events_by_receipt ON observation_native_events(receipt_id,span_index)`;
      yield* sql`CREATE TABLE IF NOT EXISTS observation_native_receipts (receipt_id TEXT PRIMARY KEY, payload TEXT NOT NULL, payload_hash TEXT NOT NULL)`;
    })
  );
});

/**
 * Open the metadata journal on an injected dedicated, file-backed SQLite client.
 *
 * **Details**
 *
 * Verifies DELETE journal mode, EXTRA synchronization, 4096-byte pages and the configured page ceiling. Refuses foreign tables and in-memory databases before initialization. The caller owns a private directory, scoped connection, disk headroom and hard worker limits. Source pages and compare-and-swap cursors commit atomically; full capacity refuses new pages while exact retries stay idempotent. No source files, historical stores or services are mutated.
 *
 * **Example** (Inspect the factory for transcript intake journal)
 *
 * ```ts
 * import { makeTranscriptIntakeJournal } from "@beep/repo-ai-metrics/transcript-intake"
 * console.log(typeof makeTranscriptIntakeJournal) // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeTranscriptIntakeJournal = Effect.fn("AiMetrics.makeTranscriptIntakeJournal")(
  (config: TranscriptIntakeConfig) =>
    safe(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const configJson = yield* encodeTranscriptIntakeConfigJson(config);
        yield* requireOwnedJournal(sql, configJson);
        yield* configureJournalDatabase(sql, config);
        yield* initializeJournalTables(sql, configJson);
        const stats = safe(
          sql`SELECT COUNT(*) AS pages, COALESCE(SUM(payload_bytes),0) + (SELECT COALESCE(SUM(payload_bytes),0) FROM observation_launch_facts) AS "payloadBytes", COALESCE(SUM(frames),0) AS frames FROM observation_intake_pages`.pipe(
            Effect.flatMap(S.decodeUnknownEffect(singleStats)),
            Effect.map((rows) => rows[0])
          )
        );
        const reservedLaunchBytes = safe(
          sql`SELECT COALESCE(SUM(32768 - used),0) AS bytes FROM (
          SELECT launch_id, SUM(payload_bytes) AS used FROM observation_launch_facts GROUP BY launch_id
          HAVING MIN(phase)=0 AND MAX(phase)<3
        )`.pipe(
            Effect.flatMap(decodeArguments5),
            Effect.map((rows) => rows[0].bytes)
          )
        );
        const readDisposition = Effect.fn("AiMetrics.intake.readDisposition")((receiptId: Sha256Hex) =>
          safe(
            Effect.gen(function* () {
              const rows =
                yield* sql`SELECT substr(payload,1,4097) AS payload,digest FROM observation_page_dispositions WHERE receipt_id=${receiptId}`.pipe(
                  Effect.flatMap(decodePayloadDigestRecordRows)
                );
              if (rows[0] === undefined) return O.none<PageDisposition>();
              if ((yield* hashPublicTextSha256(rows[0].payload)) !== rows[0].digest) return yield* failure("storage");
              const value = yield* decodePageDispositionJson(rows[0].payload);
              if (value.page.receiptId !== receiptId) return yield* failure("storage");
              return O.some(value);
            })
          )
        );
        const readCursor = Effect.fn("AiMetrics.intake.readCursor")(
          (source: TranscriptCursor["source"], pathHash: Sha256Hex) =>
            safe(
              Effect.gen(function* () {
                const rows =
                  yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_source_cursors WHERE source_key = ${`${source}:${pathHash}`}`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
                  );
                const row = A.head(rows);
                return O.isNone(row) ? O.none<TranscriptCursor>() : O.some(yield* decodeCursor(row.value.payload));
              })
            )
        );
        const acceptPage = Effect.fn("AiMetrics.intake.acceptPage")(
          (page: TranscriptPage, expected: O.Option<TranscriptCursor>) =>
            safe(
              Effect.gen(function* () {
                if (page.cursor.namespaceId !== config.namespaceId) return yield* failure("namespace");
                if (
                  O.isSome(expected) &&
                  (expected.value.namespaceId !== config.namespaceId ||
                    expected.value.pathHash !== page.cursor.pathHash ||
                    expected.value.source !== page.cursor.source)
                )
                  return yield* failure("namespace");
                const payload = yield* encodeTranscriptPageJson(page);
                const payloadBytes = new TextEncoder().encode(payload).byteLength;
                if (payloadBytes > 4_194_304) return yield* failure("oversize");

                const expectedJson = O.isSome(expected)
                  ? O.some(yield* encodeCursor(expected.value))
                  : O.none<string>();
                const nextCursor = yield* encodeCursor(page.cursor);
                const key = `${page.cursor.source}:${page.cursor.pathHash}`;
                return yield* sql.withTransaction(
                  Effect.gen(function* () {
                    const window = yield* readEvidenceWindow().pipe(Effect.provideService(SqlClient.SqlClient, sql));
                    const receiptId = yield* hashPublicTextSha256(
                      window.epoch === 0
                        ? `transcript-acceptance/v1:${config.hostId}:${config.namespaceId}:${payload}`
                        : `transcript-acceptance/v2:${config.hostId}:${config.namespaceId}:${window.epoch}:${payload}`
                    );
                    const replay =
                      yield* sql`SELECT receipt_id AS "receiptId", sequence, accepted_at AS "acceptedAt", payload_bytes AS "payloadBytes", frames,evidence_epoch AS "evidenceEpoch" FROM observation_intake_pages WHERE receipt_id = ${receiptId}`.pipe(
                        Effect.flatMap(S.decodeUnknownEffect(ReceiptRows))
                      );
                    if (replay[0] !== undefined) return replay[0];
                    const disposed = yield* readDisposition(receiptId);
                    if (O.isSome(disposed)) {
                      if (disposed.value.reason === "retention-expired") return yield* failure("expired");
                      return disposed.value.page;
                    }
                    const current =
                      yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_source_cursors WHERE source_key = ${key}`.pipe(
                        Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
                      );
                    if (
                      !Equal.equals(
                        O.map(A.head(current), (row) => row.payload),
                        expectedJson
                      )
                    )
                      return yield* failure("stale-cursor");
                    yield* requireDispositionCapacity.pipe(
                      Effect.provideService(SqlClient.SqlClient, sql),
                      Effect.mapError((error) => failure(error === "disposition-capacity" ? "capacity" : "storage"))
                    );
                    const count = yield* stats;
                    if (
                      count.pages >= config.maxPages ||
                      count.payloadBytes + (yield* reservedLaunchBytes) + payloadBytes > config.maxPayloadBytes
                    )
                      return yield* failure("capacity");
                    const at = yield* Clock.currentTimeMillis;
                    yield* sql`INSERT INTO observation_intake_pages(receipt_id,source_key,payload,payload_bytes,frames,accepted_at,evidence_epoch)
          VALUES (${receiptId},${key},${payload},${payloadBytes},${page.frames.length},${at},${window.epoch})`;
                    yield* sql`INSERT INTO observation_source_cursors(source_key,payload,receipt_id) VALUES (${key},${nextCursor},${receiptId})
          ON CONFLICT(source_key) DO UPDATE SET payload=excluded.payload,receipt_id=excluded.receipt_id`;
                    const inserted =
                      yield* sql`SELECT receipt_id AS "receiptId", sequence, accepted_at AS "acceptedAt", payload_bytes AS "payloadBytes", frames,evidence_epoch AS "evidenceEpoch" FROM observation_intake_pages WHERE receipt_id=${receiptId}`.pipe(
                        Effect.flatMap(decodeArguments6)
                      );
                    return inserted[0];
                  })
                );
              })
            )
        );
        const reserveSources = Effect.fn("AiMetrics.intake.reserveSources")((input: TranscriptScheduleInput) =>
          safe(
            sql.withTransaction(
              Effect.gen(function* () {
                const candidates = A.sort(A.dedupe(input.candidates), Order.String);
                const rows =
                  yield* sql`SELECT source_id AS "sourceId" FROM observation_schedule_cursor WHERE singleton=1`.pipe(
                    Effect.flatMap(decodeSourceIdRecordRows)
                  );
                const prior = rows[0]?.sourceId;
                const ordered =
                  prior === undefined
                    ? candidates
                    : [...A.filter(candidates, (id) => id > prior), ...A.filter(candidates, (id) => id <= prior)];
                return A.take(ordered, input.limit);
              })
            )
          )
        );
        // Advance the fair schedule only as each source is attempted, so an interrupted
        // sweep resumes after the last attempted file instead of skipping untried ones.
        const recordAttempt = Effect.fn("AiMetrics.intake.recordAttempt")((sourceId: Sha256Hex) =>
          safe(
            sql`INSERT INTO observation_schedule_cursor(singleton,source_id) VALUES(1,${sourceId})
              ON CONFLICT(singleton) DO UPDATE SET source_id=excluded.source_id`.pipe(Effect.asVoid)
          )
        );
        return {
          acceptPage,
          readCursor,
          readDisposition,
          evidenceWindow: safe(readEvidenceWindow().pipe(Effect.provideService(SqlClient.SqlClient, sql))),
          stats,
          reservedLaunchBytes,
          reserveSources,
          recordAttempt,
        };
      })
    )
);
