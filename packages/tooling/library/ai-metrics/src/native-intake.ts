/**
 * Atomic native metadata admission on the shared bounded local intake journal.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Tuple from "effect/Tuple";
import { requireDispositionCapacity } from "./internal/disposition-capacity.ts";
import { NativeTraceBatch, NativeTraceMetadata } from "./native-trace.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { makeTranscriptIntakeJournal, TranscriptAcceptance, TranscriptIntakeError } from "./transcript-intake.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("native-intake");
/**
 * Durable local native admission counts and precise conflict positions.
 *
 * **Example**
 * ```ts
 * import { NativeIntakeReceipt } from "@beep/repo-ai-metrics/native-intake"
 * console.log(typeof NativeIntakeReceipt.make)
 * ```
 * **Details** Accepted includes idempotent duplicate occurrences. Rejected includes malformed projections, identity/content conflicts and explicitly expired identities. Expired indices default to empty for earlier receipts. Conflict and expired indices refer to the batch's projected spans, not raw OTLP ordinals. The receipt establishes local persistence only, never backend delivery.
 * @category models
 * @since 0.0.0
 */
export class NativeIntakeReceipt extends S.Opaque<NativeIntakeReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-intake-receipt/v1"),
    page: TranscriptAcceptance,
    accepted: S.Natural,
    rejected: S.Natural,
    newEvents: S.Natural,
    duplicates: S.Natural,
    conflictIndices: S.Array(S.Natural).check(S.isMaxLength(1024)),
    expiredIndices: S.Array(S.Natural)
      .check(S.isMaxLength(1024))
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultKey(Effect.succeed([]))),
  })
    .check(
      S.makeFilter(
        (value) =>
          value.accepted === value.newEvents + value.duplicates &&
          value.page.frames === value.accepted &&
          value.accepted + value.rejected <= 1024 &&
          value.rejected >= value.conflictIndices.length + value.expiredIndices.length &&
          A.dedupe([...value.conflictIndices, ...value.expiredIndices]).length ===
            value.conflictIndices.length + value.expiredIndices.length,
        {
          identifier: "NativeReceiptCounts",
          message: "Native receipt counts must reconcile",
        }
      )
    )
    .pipe($I.annoteSchema("NativeIntakeReceipt", { description: "Post-commit local native admission receipt." }))
) {}
const failure = (reason: TranscriptIntakeError["reason"]) => TranscriptIntakeError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(TranscriptIntakeError)(error) ? error : failure("storage"))));
const PayloadRows = S.Array(S.Struct({ payload: S.String }));
const encodeBatch = S.encodeEffect(S.fromJsonString(NativeTraceBatch));
const decodeBatch = S.decodeEffect(S.fromJsonString(NativeTraceBatch), { onExcessProperty: "error" });
const encodeReceipt = S.encodeEffect(S.fromJsonString(NativeIntakeReceipt));
const decodeReceipt = S.decodeEffect(S.fromJsonString(NativeIntakeReceipt), { onExcessProperty: "error" });

/**
 * Open native admission over the same owned SQLite profile and shared page budget.
 *
 * **Example**
 * ```ts
 * import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake"
 * console.log(typeof makeNativeIntakeJournal)
 * ```
 * **Details** Batch metadata, unique-event index and receipt commit together before return. Exact retries return the original receipt even at capacity, except that expired accepted references receive an explicit permanent refusal. Historical receipts remain readable. Repeated event IDs with different metadata are rejected without replacing the original. Native requests and transcript pages share maxPages/maxPayloadBytes and the database-file ceiling. SQLite index/receipt overhead is covered by that physical ceiling, not the payload counter. Read-back verifies payload and receipt digests; readNewEvents returns only canonical new events, while readBatch includes duplicate/conflict evidence and is not an export queue. The caller owns private storage, connection lifetime and hard process limits.
 * @category services
 * @since 0.0.0
 */
export const makeNativeIntakeJournal = Effect.fn("AiMetrics.makeNativeIntakeJournal")(
  (config: TranscriptIntakeConfig) =>
    safe(
      Effect.gen(function* () {
        const base = yield* makeTranscriptIntakeJournal(config);
        const sql = yield* SqlClient.SqlClient;
        const receipt = Effect.fn("AiMetrics.nativeIntake.receipt")((receiptId: Sha256Hex) =>
          safe(
            Effect.gen(function* () {
              const rows =
                yield* sql`SELECT substr(payload,1,65537) AS payload, payload_hash AS "payloadHash" FROM observation_native_receipts WHERE receipt_id=${receiptId}`.pipe(
                  Effect.flatMap(
                    S.decodeUnknownEffect(S.Array(S.Struct({ payload: S.String, payloadHash: Sha256Hex })))
                  )
                );
              if (rows[0] === undefined) return O.none<NativeIntakeReceipt>();
              if ((yield* hashPublicTextSha256(rows[0].payload)) !== rows[0].payloadHash)
                return yield* failure("storage");
              const decoded = yield* decodeReceipt(rows[0].payload);
              if (decoded.page.receiptId !== receiptId) return yield* failure("storage");
              return O.some(decoded);
            })
          )
        );
        const readBatch = Effect.fn("AiMetrics.nativeIntake.readBatch")((receiptId: Sha256Hex) =>
          safe(
            Effect.gen(function* () {
              const accepted = yield* receipt(receiptId);
              if (O.isNone(accepted)) return O.none<NativeTraceBatch>();
              const rows =
                yield* sql`SELECT substr(payload,1,4194305) AS payload FROM observation_intake_pages WHERE receipt_id=${receiptId} AND source_key LIKE 'native:%'`.pipe(
                  Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
                );
              if (rows[0] === undefined) {
                const disposed = yield* base.readDisposition(receiptId);
                if (O.isSome(disposed))
                  return yield* failure(disposed.value.reason === "retention-expired" ? "expired" : "reclaimed");
                return O.none<NativeTraceBatch>();
              }
              if (
                (yield* hashPublicTextSha256(
                  accepted.value.page.evidenceEpoch === 0
                    ? `native-acceptance/v1:${config.hostId}:${config.namespaceId}:${rows[0].payload}`
                    : `native-acceptance/v2:${config.hostId}:${config.namespaceId}:${accepted.value.page.evidenceEpoch}:${rows[0].payload}`
                )) !== receiptId
              )
                return yield* failure("storage");
              return O.some(yield* decodeBatch(rows[0].payload));
            })
          )
        );
        const acceptBatch = Effect.fn("AiMetrics.nativeIntake.acceptBatch")((batch: NativeTraceBatch) =>
          safe(
            Effect.gen(function* () {
              if (
                batch.namespaceId !== config.namespaceId ||
                A.some(batch.spans, (span) => span.namespaceId !== batch.namespaceId || span.routeId !== batch.routeId)
              )
                return yield* failure("namespace");
              const payload = yield* encodeBatch(batch);
              const payloadBytes = new TextEncoder().encode(payload).byteLength;
              if (payloadBytes > 4_194_304) return yield* failure("oversize");

              return yield* sql.withTransaction(
                Effect.gen(function* () {
                  const window = yield* base.evidenceWindow;
                  const receiptId = yield* hashPublicTextSha256(
                    window.epoch === 0
                      ? `native-acceptance/v1:${config.hostId}:${config.namespaceId}:${payload}`
                      : `native-acceptance/v2:${config.hostId}:${config.namespaceId}:${window.epoch}:${payload}`
                  );
                  const replay = yield* receipt(receiptId);
                  if (O.isSome(replay)) {
                    const disposed = yield* base.readDisposition(receiptId);
                    if (O.isSome(disposed)) {
                      if (disposed.value.reason === "retention-expired") return yield* failure("expired");
                      if (
                        (yield* S.encodeEffect(S.fromJsonString(TranscriptAcceptance))(disposed.value.page)) !==
                        (yield* S.encodeEffect(S.fromJsonString(TranscriptAcceptance))(replay.value.page))
                      )
                        return yield* failure("storage");
                    } else if (O.isNone(yield* readNewEvents(receiptId))) return yield* failure("storage");
                    for (const [span, index] of A.map(batch.spans, (span, index) => Tuple.make(span, index))) {
                      if (
                        A.contains(replay.value.conflictIndices, index) ||
                        A.contains(replay.value.expiredIndices, index)
                      )
                        continue;
                      const encoded = yield* S.encodeEffect(S.fromJsonString(NativeTraceMetadata))(span);
                      const digest = yield* hashPublicTextSha256(encoded);
                      const original =
                        yield* sql`SELECT payload_hash AS digest,receipt_id AS "receiptId" FROM observation_native_events WHERE event_id=${span.eventId}`.pipe(
                          Effect.flatMap(
                            S.decodeUnknownEffect(S.Array(S.Struct({ digest: Sha256Hex, receiptId: Sha256Hex })))
                          )
                        );
                      if (original[0] === undefined || original[0].digest !== digest) return yield* failure("storage");
                      const canonicalDisposition = yield* base.readDisposition(original[0].receiptId);
                      if (O.isSome(canonicalDisposition) && canonicalDisposition.value.reason === "retention-expired")
                        return yield* failure("expired");
                    }
                    return replay.value;
                  }
                  yield* requireDispositionCapacity.pipe(
                    Effect.provideService(SqlClient.SqlClient, sql),
                    Effect.mapError((error) => failure(error === "disposition-capacity" ? "capacity" : "storage"))
                  );
                  const stats = yield* base.stats;
                  if (
                    stats.pages >= config.maxPages ||
                    stats.payloadBytes + (yield* base.reservedLaunchBytes) + payloadBytes > config.maxPayloadBytes
                  )
                    return yield* failure("capacity");
                  let newEvents = 0;
                  let duplicates = 0;
                  let conflictIndices: ReadonlyArray<number> = [];
                  let expiredIndices: ReadonlyArray<number> = [];
                  for (const [span, index] of A.map(batch.spans, (span, index) => Tuple.make(span, index))) {
                    const spanPayload = yield* S.encodeEffect(S.fromJsonString(NativeTraceMetadata))(span);
                    const payloadHash = yield* hashPublicTextSha256(spanPayload);
                    const existing =
                      yield* sql`SELECT payload_hash AS "payloadHash",receipt_id AS "receiptId" FROM observation_native_events WHERE event_id=${span.eventId}`.pipe(
                        Effect.flatMap(
                          S.decodeUnknownEffect(S.Array(S.Struct({ payloadHash: Sha256Hex, receiptId: Sha256Hex })))
                        )
                      );
                    if (existing[0] !== undefined) {
                      if (existing[0].payloadHash !== payloadHash) conflictIndices = A.append(conflictIndices, index);
                      else {
                        const disposed = yield* base.readDisposition(existing[0].receiptId);
                        if (O.isSome(disposed) && disposed.value.reason === "retention-expired")
                          expiredIndices = A.append(expiredIndices, index);
                        else duplicates += 1;
                      }
                    } else {
                      yield* sql`INSERT INTO observation_native_events(event_id,payload_hash,receipt_id,span_index) VALUES(${span.eventId},${payloadHash},${receiptId},${index})`;
                      newEvents += 1;
                    }
                  }
                  const accepted = newEvents + duplicates;
                  const at = yield* Clock.currentTimeMillis;
                  yield* sql`INSERT INTO observation_intake_pages(receipt_id,source_key,payload,payload_bytes,frames,accepted_at,evidence_epoch)
        VALUES(${receiptId},${`native:${batch.routeId}`},${payload},${payloadBytes},${accepted},${at},${window.epoch})`;
                  const pages =
                    yield* sql`SELECT receipt_id AS "receiptId", sequence, accepted_at AS "acceptedAt", payload_bytes AS "payloadBytes", frames,evidence_epoch AS "evidenceEpoch" FROM observation_intake_pages WHERE receipt_id=${receiptId}`.pipe(
                      Effect.flatMap(S.decodeUnknownEffect(S.Tuple([TranscriptAcceptance])))
                    );
                  const acceptedReceipt = NativeIntakeReceipt.make({
                    page: pages[0],
                    accepted,
                    rejected: batch.rejections.length + conflictIndices.length + expiredIndices.length,
                    newEvents,
                    duplicates,
                    conflictIndices,
                    expiredIndices,
                  });
                  const receiptPayload = yield* encodeReceipt(acceptedReceipt);
                  const receiptHash = yield* hashPublicTextSha256(receiptPayload);
                  yield* sql`INSERT INTO observation_native_receipts(receipt_id,payload,payload_hash) VALUES(${receiptId},${receiptPayload},${receiptHash})`;
                  return acceptedReceipt;
                })
              );
            })
          )
        );
        const readNewEvents = Effect.fn("AiMetrics.nativeIntake.readNewEvents")((receiptId: Sha256Hex) =>
          safe(
            Effect.gen(function* () {
              const storedReceipt = yield* receipt(receiptId);
              if (O.isNone(storedReceipt)) return O.none<ReadonlyArray<NativeTraceMetadata>>();
              const batch = yield* readBatch(receiptId);
              if (O.isNone(batch)) return yield* failure("storage");
              const rows =
                yield* sql`SELECT event_id AS "eventId", payload_hash AS "payloadHash", span_index AS "spanIndex" FROM observation_native_events WHERE receipt_id=${receiptId} ORDER BY span_index LIMIT 1025`.pipe(
                  Effect.flatMap(
                    S.decodeUnknownEffect(
                      S.Array(S.Struct({ eventId: Sha256Hex, payloadHash: Sha256Hex, spanIndex: S.Natural }))
                    )
                  )
                );
              if (rows.length !== storedReceipt.value.newEvents) return yield* failure("storage");
              const events = yield* Effect.forEach(rows, (row) =>
                Effect.gen(function* () {
                  const span = batch.value.spans[row.spanIndex];
                  if (span === undefined || span.eventId !== row.eventId) return yield* failure("storage");
                  const payload = yield* S.encodeEffect(S.fromJsonString(NativeTraceMetadata))(span);
                  if ((yield* hashPublicTextSha256(payload)) !== row.payloadHash) return yield* failure("storage");
                  return span;
                })
              );
              return O.some(events);
            })
          )
        );
        return {
          acceptBatch,
          receipt,
          readBatch,
          readNewEvents,
          evidenceWindow: base.evidenceWindow,
          stats: base.stats,
        };
      })
    )
);
