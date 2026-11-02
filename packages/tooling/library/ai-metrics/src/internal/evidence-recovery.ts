/** Bounded logical retirement recovery; callers own the surrounding transaction. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { EvidenceWindow } from "../evidence-window.ts";
import { hashPublicTextSha256 } from "../privacy.ts";

const $I = $RepoAiMetricsId.create("internal/evidence-recovery");
const RecoveryProgress = S.Struct({ rows: S.Natural, bytes: S.Natural, chain: Sha256Hex }).pipe(
  $I.annoteSchema("RecoveryProgress", {
    description: "Bounded in-transaction recovery population and ordered checksum progress.",
  })
);
const descriptors = [
  {
    name: "observation_launch_facts",
    columns: ["sequence", "launch_id", "phase", "payload", "payload_bytes", "digest", "recorded_at", "evidence_epoch"],
  },
  { name: "observation_delivery_queries", columns: ["event_id", "attempt_id", "query_count", "recorded_at", "digest"] },
  { name: "observation_delivery_visibility", columns: ["event_id", "payload", "digest"] },
  { name: "observation_delivery_results", columns: ["attempt_id", "payload", "digest", "recorded_at"] },
  { name: "observation_delivery_attempt_events", columns: ["attempt_id", "event_id"] },
  { name: "observation_delivery_attempts", columns: ["sequence", "attempt_id", "payload", "digest", "recorded_at"] },
  { name: "observation_delivery_events", columns: ["event_id", "receipt_id", "payload_hash"] },
  { name: "observation_delivery_pages", columns: ["receipt_id", "events"] },
  { name: "observation_native_events", columns: ["event_id", "payload_hash", "receipt_id", "span_index"] },
  { name: "observation_native_receipts", columns: ["receipt_id", "payload", "payload_hash"] },
  { name: "observation_page_dispositions", columns: ["receipt_id", "payload", "digest"] },
];
const Row = S.Record(S.String, S.Union([S.String.check(S.isMaxLength(65536)), S.Natural]));
const Manifest = S.Struct({
  version: S.tag("evidence-recovery/v1"),
  state: S.Literals(["available", "restored"]),
  before: EvidenceWindow,
  afterDigest: Sha256Hex,
  retirementDigest: Sha256Hex,
  rows: S.Natural,
  bytes: S.Natural,
  chain: Sha256Hex,
  intakeSequence: S.Natural,
  attemptSequence: S.Natural,
});
const Count = S.Tuple([S.Struct({ n: S.Natural })]);
const StoredRows = S.Array(S.Struct({ ordinal: S.Natural, name: S.String, payload: S.String, digest: Sha256Hex }));
const sequence = (sql: SqlClient.SqlClient, name: string) =>
  sql`SELECT coalesce((SELECT seq FROM sqlite_sequence WHERE name=${name}),0) AS n`.pipe(
    Effect.flatMap(S.decodeUnknownEffect(Count)),
    Effect.map((rows) => rows[0].n)
  );
const encodeManifestJson = S.encodeEffect(S.fromJsonString(Manifest));

const writeManifest = Effect.fn("AiMetrics.recovery.writeManifest")(function* (
  sql: SqlClient.SqlClient,
  manifest: typeof Manifest.Type
) {
  const payload = yield* encodeManifestJson(manifest);
  const digest = yield* hashPublicTextSha256(payload);
  yield* sql`INSERT OR REPLACE INTO observation_evidence_recovery(singleton,payload,digest) VALUES(1,${payload},${digest})`;
});
const decodeRowRows = S.decodeUnknownEffect(S.Array(Row));
const encodeRowJson = S.encodeEffect(S.fromJsonString(Row));
const decodePayloadDigestRecordRows = S.decodeUnknownEffect(
  S.Array(S.Struct({ payload: S.String, digest: Sha256Hex }))
);
const decodeManifestJson = S.decodeEffect(S.fromJsonString(Manifest));
const encodeEvidenceWindowJson = S.encodeEffect(S.fromJsonString(EvidenceWindow));
const decodeRowJson = S.decodeEffect(S.fromJsonString(Row));

export const makeEvidenceRecovery = Effect.fn("AiMetrics.makeEvidenceRecovery")(function* (
  maxRows: number,
  maxBytes: number
) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE IF NOT EXISTS observation_evidence_recovery(singleton INTEGER PRIMARY KEY CHECK(singleton=1),payload TEXT NOT NULL,digest TEXT NOT NULL)`;
  yield* sql`CREATE TABLE IF NOT EXISTS observation_evidence_recovery_rows(ordinal INTEGER PRIMARY KEY, name TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL)`;
  const emptyProgress = Effect.fnUntraced(function* () {
    return RecoveryProgress.make({ rows: 0, bytes: 0, chain: yield* hashPublicTextSha256("evidence-recovery/v1") });
  });
  const accountPayload = Effect.fnUntraced(function* (progress: typeof RecoveryProgress.Type, payload: string) {
    const payloadBytes = new TextEncoder().encode(payload).byteLength;
    if (payloadBytes > 262144) return yield* Effect.fail("capacity");
    const rows = progress.rows + 1;
    const bytes = progress.bytes + payloadBytes;
    if (rows > maxRows || bytes > maxBytes) return yield* Effect.fail("capacity");
    return RecoveryProgress.make({ rows, bytes, chain: progress.chain });
  });
  const captureRow = Effect.fnUntraced(function* (
    table: string,
    row: typeof Row.Type,
    progress: typeof RecoveryProgress.Type
  ) {
    const payload = yield* encodeRowJson(row);
    const next = yield* accountPayload(progress, payload);
    const digest = yield* hashPublicTextSha256(payload);
    const chain = yield* hashPublicTextSha256(`${next.chain}:${next.rows}:${table}:${digest}`);
    yield* sql`INSERT INTO observation_evidence_recovery_rows(ordinal,name,payload,digest) VALUES(${next.rows},${table},${payload},${digest})`;
    return RecoveryProgress.make({ ...next, chain });
  });
  const captureTable = Effect.fnUntraced(function* (
    table: (typeof descriptors)[number],
    initial: typeof RecoveryProgress.Type
  ) {
    let after = 0;
    let progress = initial;
    const count = yield* sql`SELECT count(*) AS n FROM ${sql(table.name)}`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(Count))
    );
    if (count[0].n + progress.rows > maxRows) return yield* Effect.fail("capacity");
    const columns = A.map(table.columns, (c) =>
      c === "sequence" || c === "recorded_at" || c === "span_index" || c === "events"
        ? sql`${sql(c)}`
        : sql`substr(${sql(c)},1,65537) AS ${sql(c)}`
    );
    while (true) {
      const page =
        yield* sql`SELECT rowid AS recovery_rowid,${sql.csv(columns)} FROM ${sql(table.name)} WHERE rowid>${after} ORDER BY rowid LIMIT 32`.pipe(
          Effect.flatMap(decodeRowRows)
        );
      if (page.length === 0) break;
      for (const entry of page) {
        after = yield* S.decodeUnknownEffect(S.Natural)(entry.recovery_rowid);
        progress = yield* captureRow(table.name, R.remove(entry, "recovery_rowid"), progress);
      }
    }
    if (progress.rows - initial.rows !== count[0].n) return yield* Effect.fail("storage");
    return progress;
  });
  const capture = Effect.fn("AiMetrics.recovery.capture")(function* (
    before: EvidenceWindow,
    afterDigest: Sha256Hex,
    retirementDigest: Sha256Hex
  ) {
    yield* sql`DELETE FROM observation_evidence_recovery_rows`;
    let progress = yield* emptyProgress();
    for (const table of descriptors) progress = yield* captureTable(table, progress);
    yield* writeManifest(sql, {
      version: "evidence-recovery/v1",
      state: "available",
      before,
      afterDigest,
      retirementDigest,
      ...progress,
      intakeSequence: yield* sequence(sql, "observation_intake_pages"),
      attemptSequence: yield* sequence(sql, "observation_delivery_attempts"),
    });
  });
  const readManifest = Effect.fnUntraced(function* (expectedDigest: Sha256Hex) {
    const stored =
      yield* sql`SELECT substr(payload,1,16385) AS payload,substr(digest,1,65) AS digest FROM observation_evidence_recovery WHERE singleton=1`.pipe(
        Effect.flatMap(decodePayloadDigestRecordRows)
      );
    const head = stored[0];
    if (head === undefined) return yield* Effect.fail("conflict");
    if (head.payload.length > 16384 || (yield* hashPublicTextSha256(head.payload)) !== head.digest)
      return yield* Effect.fail("storage");
    const manifest = yield* decodeManifestJson(head.payload);
    if (manifest.retirementDigest !== expectedDigest) return yield* Effect.fail("conflict");
    return manifest;
  });
  const requireCurrentGeneration = Effect.fnUntraced(function* (
    manifest: typeof Manifest.Type,
    current: EvidenceWindow
  ) {
    const currentPayload = yield* encodeEvidenceWindowJson(current);
    if (
      (yield* hashPublicTextSha256(currentPayload)) !== manifest.afterDigest ||
      (yield* sequence(sql, "observation_intake_pages")) !== manifest.intakeSequence ||
      (yield* sequence(sql, "observation_delivery_attempts")) !== manifest.attemptSequence
    )
      return yield* Effect.fail("conflict");
  });
  const requireEmptyTables = Effect.fnUntraced(function* () {
    for (const name of ["observation_intake_pages", ...A.map(descriptors, (d) => d.name)]) {
      const count = yield* sql`SELECT count(*) AS n FROM ${sql(name)}`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(Count))
      );
      if (count[0].n !== 0) return yield* Effect.fail("conflict");
    }
  });
  const decodeRestoredRow = Effect.fnUntraced(function* (entry: (typeof StoredRows.Type)[number], ordinal: number) {
    if (
      entry.ordinal !== ordinal ||
      entry.payload.length > 262144 ||
      (yield* hashPublicTextSha256(entry.payload)) !== entry.digest
    )
      return yield* Effect.fail("storage");
    const descriptor = A.findFirst(descriptors, (d) => d.name === entry.name);
    if (descriptor._tag === "None") return yield* Effect.fail("storage");
    const row = yield* decodeRowJson(entry.payload);
    if (
      R.keys(row).length !== descriptor.value.columns.length ||
      !A.every(descriptor.value.columns, (c) => R.has(row, c))
    )
      return yield* Effect.fail("storage");
    return row;
  });
  const restoreRow = Effect.fnUntraced(function* (
    entry: (typeof StoredRows.Type)[number],
    progress: typeof RecoveryProgress.Type
  ) {
    const next = yield* accountPayload(progress, entry.payload);
    const row = yield* decodeRestoredRow(entry, next.rows);
    const chain = yield* hashPublicTextSha256(`${next.chain}:${next.rows}:${entry.name}:${entry.digest}`);
    yield* sql`INSERT INTO ${sql(entry.name)} ${sql.insert(row)}`;
    return RecoveryProgress.make({ ...next, chain });
  });
  const restoreRows = Effect.fnUntraced(function* () {
    let progress = yield* emptyProgress();
    while (true) {
      const page =
        yield* sql`SELECT ordinal,substr(name,1,129) AS name,substr(payload,1,262145) AS payload,substr(digest,1,65) AS digest FROM observation_evidence_recovery_rows WHERE ordinal>${progress.rows} ORDER BY ordinal LIMIT 32`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(StoredRows))
        );
      if (page.length === 0) break;
      for (const entry of page) progress = yield* restoreRow(entry, progress);
    }
    return progress;
  });
  const publishRestoredWindow = Effect.fnUntraced(function* (
    manifest: typeof Manifest.Type,
    progress: typeof RecoveryProgress.Type
  ) {
    if (progress.rows !== manifest.rows || progress.bytes !== manifest.bytes || progress.chain !== manifest.chain)
      return yield* Effect.fail("storage");
    const payload = yield* encodeEvidenceWindowJson(manifest.before);
    const digest = yield* hashPublicTextSha256(payload);
    yield* sql`UPDATE observation_evidence_window SET payload=${payload},digest=${digest} WHERE singleton=1`;
    yield* writeManifest(sql, { ...manifest, state: "restored" });
  });
  const restore = Effect.fn("AiMetrics.recovery.restore")(function* (
    expectedDigest: Sha256Hex,
    current: EvidenceWindow
  ) {
    const manifest = yield* readManifest(expectedDigest);
    if (manifest.state === "restored") return "already-restored";
    yield* requireCurrentGeneration(manifest, current);
    yield* requireEmptyTables();
    if (manifest.rows > maxRows || manifest.bytes > maxBytes) return yield* Effect.fail("capacity");
    const progress = yield* restoreRows();
    yield* publishRestoredWindow(manifest, progress);
    return "restored";
  });
  return { capture, restore };
});
