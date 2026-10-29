/**
 * Transactional reclamation of verified metadata payloads with retained receipts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { DeliveryLedgerError, makeDeliveryLedger } from "./delivery-ledger.ts";
import { readEnrolledOwnership, readUnenrolledNativeOwnership } from "./internal/unenrolled-evidence.ts";
import { makeNativeIntakeJournal } from "./native-intake.ts";
import { NativeTraceMetadata } from "./native-trace.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import {
  ExpiredPageDisposition,
  makeTranscriptIntakeJournal,
  PageDisposition,
  TranscriptAcceptance,
  VerifiedPageDisposition,
} from "./transcript-intake.ts";
import { TranscriptFrame, TranscriptPage } from "./transcript-page.ts";
import type { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("payload-reclamation");
/**
 * Immutable bounds for verified payload retention and compact dispositions.
 * **Example** (Inspecting the policy)
 * ```ts
 * import { PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation"
 * console.log(typeof PayloadRetentionPolicy.make)
 * ```
 * **Details** Ages are wall-clock differences from local acceptance and latest send reservation; they are not monotonic elapsed-time measurements. A clock rollback delays reclamation. Expiry is disabled unless explicitly configured. Enabled expiry preserves delivery-state counts and never promotes delivery. The policy does not delete compact facts. Exhaustion requires an explicit epoch/retention migration; payload reclamation alone does not make the journal indefinitely renewable.
 * @category models
 * @since 0.0.0
 */
export class PayloadRetentionPolicy extends S.Opaque<PayloadRetentionPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("payload-retention/v1"),
    minAgeMillis: S.Int.check(S.isBetween({ minimum: 60_000, maximum: 604_800_000 })),
    minAttemptQuietMillis: S.Int.check(S.isBetween({ minimum: 60_000, maximum: 86_400_000 })),
    maxDispositions: S.Int.check(S.isBetween({ minimum: 1, maximum: 262144 })),
    expireAfterMillis: S.OptionFromOptionalKey(
      S.Int.check(S.isBetween({ minimum: 86_400_000, maximum: 2_592_000_000 }))
    ).pipe(S.withConstructorDefault(Effect.succeedNone)),
  })
    .check(
      S.makeFilter((value) => O.isNone(value.expireAfterMillis) || value.expireAfterMillis.value > value.minAgeMillis, {
        identifier: "RetentionOrder",
        message: "Expiry must be later than verified reclamation age",
      })
    )
    .pipe($I.annoteSchema("PayloadRetentionPolicy", { description: "Explicit verified payload retention bounds." }))
) {}
/**
 * Content-free refusal to reclaim an owned metadata page.
 * **Example** (Inspecting a refusal)
 * ```ts
 * import { PayloadReclamationError } from "@beep/repo-ai-metrics/payload-reclamation"
 * console.log(PayloadReclamationError.make({ reason: "capacity" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class PayloadReclamationError extends S.TaggedError<PayloadReclamationError, { readonly brand: unique symbol }>(
  $I`PayloadReclamationError`
)(
  "PayloadReclamationError",
  {
    reason: S.Literals(["configuration", "capacity", "unknown-page", "storage"]),
  },
  $I.annote("PayloadReclamationError", { description: "Bounded payload reclamation failure." })
) {}
const failure = (reason: PayloadReclamationError["reason"]) => PayloadReclamationError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(PayloadReclamationError)(error) ? error : failure("storage"))));
/**
 * Open a bounded reclaimer that preserves identities, cursors and delivery facts.
 * **Example** (Inspecting the service)
 * ```ts
 * import { makePayloadReclaimer } from "@beep/repo-ai-metrics/payload-reclamation"
 * console.log(typeof makePayloadReclaimer)
 * ```
 * **Details** Reclaim and expire each check one explicitly selected page in a serialized transaction. Expire requires an explicit deadline and preserves state populations; it never creates visibility or send-result facts. None means it is too young or recently attempted; verified reclamation also waits for every accepted event's visibility. Native duplicate occurrences require the original event's visibility for verified reclamation. Deletion and a checksummed disposition commit together; failures restore the payload. SQLite reuses free pages internally without VACUUM or source-file deletion. The caller still owns disk headroom, scheduling and process limits.
 * @category services
 * @since 0.0.0
 */
export const makePayloadReclaimer = Effect.fn("AiMetrics.makePayloadReclaimer")(
  (intakeConfig: TranscriptIntakeConfig, ledgerConfig: DeliveryLedgerConfig, policy: PayloadRetentionPolicy) =>
    safe(
      Effect.gen(function* () {
        const base = yield* makeTranscriptIntakeJournal(intakeConfig);
        const native = yield* makeNativeIntakeJournal(intakeConfig);
        const ledger = yield* makeDeliveryLedger(intakeConfig, ledgerConfig);
        const sql = yield* SqlClient.SqlClient;
        const policyJson = yield* S.encodeEffect(S.fromJsonString(PayloadRetentionPolicy))(policy);
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`CREATE TABLE IF NOT EXISTS observation_reclamation_config(singleton INTEGER PRIMARY KEY CHECK(singleton=1),payload TEXT NOT NULL)`;
            yield* sql`INSERT OR IGNORE INTO observation_reclamation_config(singleton,payload) VALUES(1,${policyJson})`;
            const rows =
              yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_reclamation_config WHERE singleton=1`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })])))
              );
            if (rows[0].payload !== policyJson) return yield* failure("configuration");
            const [reserved] =
              yield* sql`SELECT ((SELECT COUNT(*) FROM observation_intake_pages)+(SELECT COUNT(*) FROM observation_page_dispositions)) AS n`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ n: S.Natural })])))
              );
            if (reserved.n > policy.maxDispositions) return yield* failure("capacity");
          })
        );
        const enroll = Effect.fn("AiMetrics.reclamation.enroll")(function* (receiptId: Sha256Hex, expiry: boolean) {
          const result = yield* ledger.registerPage(receiptId).pipe(Effect.result);
          if (
            Result.isFailure(result) &&
            !(expiry && S.is(DeliveryLedgerError)(result.failure) && result.failure.reason === "capacity")
          )
            return yield* result.failure;
        });
        const verifyMember = Effect.fn("AiMetrics.reclamation.verifyMember")(function* (
          eventId: Sha256Hex,
          digest: Sha256Hex,
          native: boolean
        ) {
          const rows =
            yield* sql`SELECT payload_hash AS digest FROM observation_delivery_events WHERE event_id=${eventId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ digest: Sha256Hex }))))
            );
          if (rows[0] !== undefined && rows[0].digest !== digest) return yield* failure("storage");
          if (rows[0] === undefined) {
            const [orphans] =
              yield* sql`SELECT ((SELECT COUNT(*) FROM observation_delivery_attempt_events WHERE event_id=${eventId})+(SELECT COUNT(*) FROM observation_delivery_visibility WHERE event_id=${eventId})+(SELECT COUNT(*) FROM observation_delivery_queries WHERE event_id=${eventId})) AS n`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ n: S.Natural })])))
              );
            if (orphans.n > 0) return yield* failure("storage");
          }
          if (native) {
            const original =
              yield* sql`SELECT n.payload_hash AS digest,p.receipt_id AS "registeredOwner" FROM observation_native_events n LEFT JOIN observation_delivery_pages p ON p.receipt_id=n.receipt_id WHERE n.event_id=${eventId}`.pipe(
                Effect.flatMap(
                  S.decodeUnknownEffect(
                    S.Tuple([S.Struct({ digest: Sha256Hex, registeredOwner: S.NullOr(Sha256Hex) })])
                  )
                )
              );
            if (original[0].digest !== digest || (original[0].registeredOwner !== null && rows[0] === undefined))
              return yield* failure("storage");
          }
        });
        const dispose = Effect.fn("AiMetrics.reclamation.dispose")(
          (receiptId: Sha256Hex, mode: "verified" | "expiry") =>
            safe(
              sql.withTransaction(
                Effect.gen(function* () {
                  if (mode === "expiry" && O.isNone(policy.expireAfterMillis)) return yield* failure("configuration");
                  const prior = yield* base.readDisposition(receiptId);
                  if (O.isSome(prior)) return prior;
                  const rows =
                    yield* sql`SELECT receipt_id AS "receiptId",sequence,accepted_at AS "acceptedAt",payload_bytes AS "payloadBytes",frames,evidence_epoch AS "evidenceEpoch",source_key AS "sourceKey",substr(payload,1,4194305) AS payload FROM observation_intake_pages WHERE receipt_id=${receiptId}`.pipe(
                      Effect.flatMap(
                        S.decodeUnknownEffect(
                          S.Array(
                            S.Struct({
                              ...TranscriptAcceptance.fields,
                              sourceKey: S.String,
                              payload: S.String,
                            })
                          )
                        )
                      )
                    );
                  const row = rows[0];
                  if (row === undefined) return yield* failure("unknown-page");
                  const now = yield* Clock.currentTimeMillis;
                  const minAge =
                    mode === "expiry"
                      ? O.getOrElse(policy.expireAfterMillis, () => policy.minAgeMillis)
                      : policy.minAgeMillis;
                  if (now - row.acceptedAt < minAge) return O.none<typeof PageDisposition.Type>();
                  yield* enroll(receiptId, mode === "expiry");
                  let attemptedOwners = HashSet.make(receiptId);
                  const registeredPages =
                    yield* sql`SELECT events FROM observation_delivery_pages WHERE receipt_id=${receiptId}`.pipe(
                      Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ events: S.Natural }))))
                    );

                  let eventIds: ReadonlyArray<Sha256Hex> = [];
                  if (Str.startsWith("native:")(row.sourceKey)) {
                    const receipt = yield* native.receipt(receiptId);
                    const batch = yield* native.readBatch(receiptId);
                    // Revalidate the canonical index even for previously registered pages.
                    yield* native.readNewEvents(receiptId);
                    if (O.isNone(receipt) || O.isNone(batch)) return yield* failure("storage");
                    for (const [index, span] of batch.value.spans.entries()) {
                      if (
                        A.contains(receipt.value.conflictIndices, index) ||
                        A.contains(receipt.value.expiredIndices, index)
                      )
                        continue;
                      const payload = yield* S.encodeEffect(S.fromJsonString(NativeTraceMetadata))(span);
                      yield* verifyMember(span.eventId, yield* hashPublicTextSha256(payload), true);
                    }
                    eventIds = A.dedupe(
                      A.map(
                        A.filter(
                          A.map(batch.value.spans, (span, index) => ({ span, index })),
                          ({ index }) =>
                            !A.contains(receipt.value.conflictIndices, index) &&
                            !A.contains(receipt.value.expiredIndices, index)
                        ),
                        ({ span }) => span.eventId
                      )
                    );
                  } else {
                    if (
                      (yield* hashPublicTextSha256(
                        row.evidenceEpoch === 0
                          ? `transcript-acceptance/v1:${intakeConfig.hostId}:${intakeConfig.namespaceId}:${row.payload}`
                          : `transcript-acceptance/v2:${intakeConfig.hostId}:${intakeConfig.namespaceId}:${row.evidenceEpoch}:${row.payload}`
                      )) !== receiptId
                    )
                      return yield* failure("storage");
                    const page = yield* S.decodeEffect(S.fromJsonString(TranscriptPage), { onExcessProperty: "error" })(
                      row.payload
                    );
                    let identities = HashMap.empty<Sha256Hex, Sha256Hex>();
                    for (const frame of page.frames) {
                      if (frame._tag !== "Accepted") continue;
                      const payload = yield* S.encodeEffect(S.fromJsonString(TranscriptFrame))(frame);
                      const digest = yield* hashPublicTextSha256(payload);
                      const prior = HashMap.get(identities, frame.occurrenceId);
                      if (O.isSome(prior) && prior.value !== digest) return yield* failure("storage");
                      identities = HashMap.set(identities, frame.occurrenceId, digest);
                      yield* verifyMember(frame.occurrenceId, digest, false);
                    }
                    eventIds = A.dedupe(
                      A.map(
                        A.filter(page.frames, (frame) => frame._tag === "Accepted"),
                        (frame) => frame.occurrenceId
                      )
                    );
                  }
                  let unenrolledReferences = 0;
                  const states = { pending: 0, acceptedUnverified: 0, visible: 0, rejected: 0, unresolved: 0 };
                  for (const eventId of eventIds) {
                    // Duplicate occurrences may refer to a page not yet enrolled by the sender.
                    if (mode === "expiry" && Str.startsWith("native:")(row.sourceKey)) {
                      const originals =
                        yield* sql`SELECT receipt_id AS "receiptId" FROM observation_native_events WHERE event_id=${eventId}`.pipe(
                          Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ receiptId: Sha256Hex })])))
                        );
                      const disposed = yield* base.readDisposition(originals[0].receiptId);
                      if (O.isNone(disposed) && !HashSet.has(attemptedOwners, originals[0].receiptId)) {
                        attemptedOwners = HashSet.add(attemptedOwners, originals[0].receiptId);
                        yield* enroll(originals[0].receiptId, true);
                      }
                    }
                    const state = yield* ledger.state(eventId);
                    if (O.isNone(state)) {
                      if (mode === "verified") return O.none<typeof PageDisposition.Type>();
                      if (!Str.startsWith("native:")(row.sourceKey) && registeredPages.length > 0)
                        return yield* failure("storage");
                      unenrolledReferences += 1;
                      continue;
                    }
                    if (mode === "verified" && state.value.state !== "visible")
                      return O.none<typeof PageDisposition.Type>();
                    switch (state.value.state) {
                      case "pending":
                        states.pending += 1;
                        break;
                      case "accepted-unverified":
                        states.acceptedUnverified += 1;
                        break;
                      case "visible":
                        states.visible += 1;
                        break;
                      case "rejected":
                        states.rejected += 1;
                        break;
                      case "unresolved":
                        states.unresolved += 1;
                        break;
                    }
                    const recent =
                      yield* sql`SELECT MAX(a.recorded_at) AS latest FROM observation_delivery_attempts a JOIN observation_delivery_attempt_events e ON e.attempt_id=a.attempt_id WHERE e.event_id=${eventId}`.pipe(
                        Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ latest: S.NullOr(S.Natural) })])))
                      );
                    if (recent[0].latest !== null && now - recent[0].latest < policy.minAttemptQuietMillis)
                      return O.none<typeof PageDisposition.Type>();
                  }
                  const count = yield* sql`SELECT COUNT(*) AS n FROM observation_page_dispositions`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ n: S.Natural })])))
                  );
                  if (count[0].n >= policy.maxDispositions) return yield* failure("capacity");
                  const unenrolledNativeOwnership = Str.startsWith("native:")(row.sourceKey)
                    ? O.some(
                        yield* readUnenrolledNativeOwnership(receiptId).pipe(
                          Effect.provideService(SqlClient.SqlClient, sql)
                        )
                      )
                    : O.none();
                  if (
                    registeredPages.length > 0 &&
                    O.isSome(unenrolledNativeOwnership) &&
                    unenrolledNativeOwnership.value.count > 0
                  )
                    return yield* failure("storage");
                  const page = TranscriptAcceptance.make({
                    receiptId,
                    sequence: row.sequence,
                    acceptedAt: row.acceptedAt,
                    payloadBytes: row.payloadBytes,
                    frames: row.frames,
                    evidenceEpoch: row.evidenceEpoch,
                  });
                  const enrolledOwnership = yield* readEnrolledOwnership(receiptId).pipe(
                    Effect.provideService(SqlClient.SqlClient, sql)
                  );
                  const disposition =
                    mode === "expiry"
                      ? ExpiredPageDisposition.make({
                          reason: "retention-expired",
                          page,
                          disposedAt: now,
                          enrolledOwnership,
                          eventCount: eventIds.length,
                          ...(unenrolledReferences > 0 ? { unenrolledReferences } : {}),
                          ...(O.isSome(unenrolledNativeOwnership) && unenrolledNativeOwnership.value.count > 0
                            ? { unenrolledNativeOwnership: unenrolledNativeOwnership.value }
                            : {}),
                          states,
                        })
                      : VerifiedPageDisposition.make({
                          reason: "backend-verified",
                          page,
                          disposedAt: now,
                          enrolledOwnership,
                          verifiedEvents: eventIds.length,
                        });
                  const payload = yield* S.encodeEffect(S.fromJsonString(PageDisposition))(disposition);
                  const digest = yield* hashPublicTextSha256(payload);
                  // Delete first to allow internal page reuse at the physical ceiling.
                  // A disposition failure rolls both statements back.
                  yield* sql`DELETE FROM observation_intake_pages WHERE receipt_id=${receiptId}`;
                  yield* sql`INSERT INTO observation_page_dispositions(receipt_id,payload,digest) VALUES(${receiptId},${payload},${digest})`;
                  return O.some(disposition);
                })
              )
            )
        );
        return {
          reclaim: (receiptId: Sha256Hex) => dispose(receiptId, "verified"),
          expire: (receiptId: Sha256Hex) => dispose(receiptId, "expiry"),
          readDisposition: base.readDisposition,
        };
      })
    )
);
