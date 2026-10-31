/**
 * Bounded append-only local delivery facts and exclusive per-event state.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import {
  decodeTranscriptPageJson,
  encodeNativeTraceMetadataJson,
  encodeTranscriptFrameJson,
} from "./internal/observation-metadata-codecs.ts";
import { makeNativeIntakeJournal } from "./native-intake.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("delivery-ledger");
const count = (maximum: number) => S.Int.check(S.isBetween({ minimum: 1, maximum }));
const events = S.Array(Sha256Hex).check(
  S.isMinLength(1),
  S.isMaxLength(512),
  S.makeFilter((ids) => A.dedupe(ids).length === ids.length, {
    identifier: "UniqueDeliveryEvents",
    message: "Attempt event identities must be unique",
  })
);
/**
 * Immutable destination identity and bounded ledger populations.
 * **Example** (Inspecting the configuration)
 * ```ts
 * import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(typeof DeliveryLedgerConfig.make)
 * ```
 * **Details** One owned journal has one declared target, including backend/project/projection version. Changing it requires a migration. The shared SQLite physical ceiling still applies to all indexes and facts. Exhaustion refuses new work; it never silently deletes evidence.
 * @category models
 * @since 0.0.0
 */
export class DeliveryLedgerConfig extends S.Opaque<DeliveryLedgerConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    targetId: Sha256Hex,
    maxEvents: count(262144),
    maxAttempts: count(262144),
    maxAttemptsPerEvent: count(128),
  }).pipe($I.annoteSchema("DeliveryLedgerConfig", { description: "Owned delivery target and hard population limits." }))
) {}
/**
 * A caller-owned send identity and exact serialized-request digest.
 * **Example** (Inspecting an attempt)
 * ```ts
 * import { DeliveryAttempt } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(typeof DeliveryAttempt.make)
 * ```
 * **Details** Commit this fact before network I/O. Reusing its ID is an idempotent local operation, not permission to send again. Every actual retry needs a new attempt ID. Event IDs refer to canonical, locally accepted metadata; payloadDigest identifies the exact outgoing request bytes.
 * @category models
 * @since 0.0.0
 */
export class DeliveryAttempt extends S.Opaque<DeliveryAttempt, { readonly brand: unique symbol }>()(
  S.Struct({ attemptId: Sha256Hex, eventIds: events, payloadDigest: Sha256Hex }).pipe(
    $I.annoteSchema("DeliveryAttempt", { description: "Pre-send durable attempt fact." })
  )
) {}
/**
 * Safe protocol evidence for one send attempt.
 * **Example** (Inspecting outcome constructors)
 * ```ts
 * import { DeliveryOutcome } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(DeliveryOutcome.cases.Accepted)
 * ```
 * **Details** Accepted means a parsed complete hop acknowledgment, never durable backend storage. Partial carries counts only; no rejected subset is invented. Unknown includes lost/invalid replies. Retryable and Rejected require explicit HTTP responses, not network guesses. Raw server messages are excluded.
 * @category models
 * @since 0.0.0
 */
export const DeliveryOutcome = S.TaggedUnion({
  Accepted: {},
  Partial: { rejectedCount: count(512) },
  Retryable: { status: S.Literals([429, 502, 503, 504]) },
  Rejected: {
    status: S.Int.check(
      S.isBetween({ minimum: 400, maximum: 599 }),
      S.makeFilter((status) => !A.contains([429, 502, 503, 504], status), {
        identifier: "NonRetryableStatus",
        message: "Retryable status is not a permanent refusal",
      })
    ),
  },
  Unknown: { reason: S.Literals(["connection-lost", "timed-out", "invalid-response", "interrupted"]) },
}).pipe(
  $I.annoteSchema("DeliveryOutcome", { description: "Content-free terminal observation for one network attempt." })
);
/**
 * One derived state, with evidence populations kept separate.
 * **Example** (Inspecting the state schema)
 * ```ts
 * import { DeliveryEventState } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(typeof DeliveryEventState.make)
 * ```
 * **Details** Visibility is historical positive read-back evidence, not a promise of perpetual retention. Accepted-unverified survives a later failed retry. Ambiguous attempts prevent a later refusal from falsely proving non-delivery. Unknown source populations and policy exclusions are outside this enrolled-event ledger. After explicit window retirement, absence refers only to the current window; query evidenceWindow for retained aggregate history.
 * @category models
 * @since 0.0.0
 */
export class DeliveryEventState extends S.Opaque<DeliveryEventState, { readonly brand: unique symbol }>()(
  S.Struct({
    eventId: Sha256Hex,
    targetId: Sha256Hex,
    state: S.Literals(["pending", "accepted-unverified", "visible", "rejected", "unresolved"]),
    attempts: S.Natural,
    acknowledgedAttempts: S.Natural,
    ambiguousAttempts: S.Natural,
  }).pipe(
    $I.annoteSchema("DeliveryEventState", { description: "Exclusive state derived from immutable delivery evidence." })
  )
) {}
/**
 * Bounded positive backend read-back linked to a specific sent payload.
 * **Example** (Inspecting visibility evidence)
 * ```ts
 * import { DeliveryVisibility } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(typeof DeliveryVisibility.make)
 * ```
 * **Details** The backend adapter must verify the expected identity and metadata before calling recordVisibility. Merely receiving a query response or finding any span is insufficient. This API validates enrollment, attempt membership and the exact request digest; it does not perform a backend query itself.
 * @category models
 * @since 0.0.0
 */
export class DeliveryVisibility extends S.Opaque<DeliveryVisibility, { readonly brand: unique symbol }>()(
  S.Struct({ eventId: Sha256Hex, attemptId: Sha256Hex, payloadDigest: Sha256Hex, observedAt: S.Natural }).pipe(
    $I.annoteSchema("DeliveryVisibility", { description: "Caller-verified positive backend observation." })
  )
) {}
/**
 * Safe ledger failure without SQL, source or response content.
 * **Example** (Inspecting a failure)
 * ```ts
 * import { DeliveryLedgerError } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(DeliveryLedgerError.make({ reason: "capacity" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class DeliveryLedgerError extends S.TaggedError<DeliveryLedgerError, { readonly brand: unique symbol }>(
  $I`DeliveryLedgerError`
)(
  "DeliveryLedgerError",
  {
    reason: S.Literals([
      "capacity",
      "configuration",
      "unknown-page",
      "unknown-event",
      "reclaimed",
      "unknown-attempt",
      "conflict",
      "invalid-outcome",
      "storage",
    ]),
  },
  $I.annote("DeliveryLedgerError", { description: "Bounded receipt-ledger refusal." })
) {}
const AttemptEvidence = S.Struct({ acknowledged: S.Natural, ambiguous: S.Natural, lastRejected: S.Boolean }).pipe(
  $I.annoteSchema("AttemptEvidence", {
    description: "Ordered attempt-history counters without discarding prior acceptance or ambiguity.",
  })
);
const stateFromEvidence = (visible: boolean, history: typeof AttemptEvidence.Type): DeliveryEventState["state"] => {
  if (visible) return "visible";
  if (history.acknowledged > 0) return "accepted-unverified";
  if (history.ambiguous > 0) return "unresolved";
  return history.lastRejected ? "rejected" : "pending";
};
const failure = (reason: DeliveryLedgerError["reason"]) => DeliveryLedgerError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(DeliveryLedgerError)(error) ? error : failure("storage"))));
const PayloadRows = S.Array(S.Struct({ payload: S.String, digest: Sha256Hex }));
const Count = S.Tuple([S.Struct({ n: S.Natural })]);
const decodeAttempt = S.decodeEffect(S.fromJsonString(DeliveryAttempt), { onExcessProperty: "error" });
const decodeOutcome = S.decodeEffect(S.fromJsonString(DeliveryOutcome), { onExcessProperty: "error" });
const decodeVisibility = S.decodeEffect(S.fromJsonString(DeliveryVisibility), { onExcessProperty: "error" });
const checkedPayload = Effect.fn("AiMetrics.delivery.checkedPayload")(function* (rows: typeof PayloadRows.Type) {
  if (rows[0] === undefined) return O.none<string>();
  if ((yield* hashPublicTextSha256(rows[0].payload)) !== rows[0].digest) return yield* failure("storage");
  return O.some(rows[0].payload);
});
const encodeDeliveryLedgerConfigJson = S.encodeEffect(S.fromJsonString(DeliveryLedgerConfig));
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })]));
const decodeEventsRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ events: S.Natural })));
const decodePayloadSourceKeyRecordRows = S.decodeUnknownEffect(
  S.Array(S.Struct({ payload: S.String, sourceKey: S.String, evidenceEpoch: S.Natural }))
);
const decodeDigestRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ digest: Sha256Hex })));
const encodeDeliveryAttemptJson = S.encodeEffect(S.fromJsonString(DeliveryAttempt));
const encodeDeliveryOutcomeJson = S.encodeEffect(S.fromJsonString(DeliveryOutcome));
const encodeDeliveryVisibilityJson = S.encodeEffect(S.fromJsonString(DeliveryVisibility));
const decodeAttemptIdRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ attemptId: Sha256Hex })));
const decodeReceiptIdRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ receiptId: Sha256Hex })));

/**
 * Open append-only delivery accounting over the owned local intake database.
 * **Example** (Inspecting the factory)
 * ```ts
 * import { makeDeliveryLedger } from "@beep/repo-ai-metrics/delivery-ledger"
 * console.log(typeof makeDeliveryLedger)
 * ```
 * **Details** Registration verifies durable native/transcript pages before indexing their canonical accepted events. Page registration and event indexing commit together, independently of source cursor advancement. Attempts commit before sends; results and positive visibility append idempotently. No method deletes facts or reclaims a page. Missing results after restart remain unresolved. All queries and populations are bounded; the caller supplies hard process limits and backend verification.
 * @category services
 * @since 0.0.0
 */
export const makeDeliveryLedger = Effect.fn("AiMetrics.makeDeliveryLedger")(
  (intakeConfig: TranscriptIntakeConfig, config: DeliveryLedgerConfig) =>
    safe(
      Effect.gen(function* () {
        const native = yield* makeNativeIntakeJournal(intakeConfig);
        const sql = yield* SqlClient.SqlClient;
        const configJson = yield* encodeDeliveryLedgerConfigJson(config);
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_config(singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL)`;
            yield* sql`INSERT OR IGNORE INTO observation_delivery_config(singleton,payload) VALUES(1,${configJson})`;
            const existing =
              yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_delivery_config WHERE singleton=1`.pipe(
                Effect.flatMap(decodeArguments)
              );
            if (existing[0].payload !== configJson) return yield* failure("configuration");
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_pages(receipt_id TEXT PRIMARY KEY, events INTEGER NOT NULL)`;
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_events(event_id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL, payload_hash TEXT NOT NULL)`;
            // One replaceable scheduling reservation per bounded delivery event.
            // Initialized here so evidence retirement can clear it without a scheduler.
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_queries(event_id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,query_count INTEGER NOT NULL,recorded_at INTEGER NOT NULL,digest TEXT NOT NULL)`;
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_attempts(sequence INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, digest TEXT NOT NULL, recorded_at INTEGER NOT NULL)`;
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_attempt_events(attempt_id TEXT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(attempt_id,event_id))`;
            yield* sql`CREATE INDEX IF NOT EXISTS observation_delivery_by_event ON observation_delivery_attempt_events(event_id,attempt_id)`;
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_results(attempt_id TEXT PRIMARY KEY,payload TEXT NOT NULL,digest TEXT NOT NULL,recorded_at INTEGER NOT NULL)`;
            yield* sql`CREATE TABLE IF NOT EXISTS observation_delivery_visibility(event_id TEXT PRIMARY KEY,payload TEXT NOT NULL,digest TEXT NOT NULL)`;
          })
        );
        const attempt = Effect.fn("AiMetrics.delivery.attempt")((attemptId: Sha256Hex) =>
          safe(
            Effect.gen(function* () {
              const payload =
                yield* sql`SELECT substr(payload,1,65537) AS payload,digest FROM observation_delivery_attempts WHERE attempt_id=${attemptId}`.pipe(
                  Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
                  Effect.flatMap(checkedPayload)
                );
              if (O.isNone(payload)) return O.none<DeliveryAttempt>();
              const decoded = yield* decodeAttempt(payload.value);
              if (decoded.attemptId !== attemptId) return yield* failure("storage");
              return O.some(decoded);
            })
          )
        );
        const readPageCandidates = Effect.fnUntraced(function* (receiptId: Sha256Hex) {
          const rows =
            yield* sql`SELECT substr(payload,1,4194305) AS payload,source_key AS "sourceKey",evidence_epoch AS "evidenceEpoch" FROM observation_intake_pages WHERE receipt_id=${receiptId}`.pipe(
              Effect.flatMap(decodePayloadSourceKeyRecordRows)
            );
          if (rows[0] === undefined) return yield* failure("unknown-page");
          if (Str.startsWith("native:")(rows[0].sourceKey)) {
            const events = yield* native.readNewEvents(receiptId);
            if (O.isNone(events)) return yield* failure("storage");
            return yield* Effect.forEach(events.value, (span) =>
              encodeNativeTraceMetadataJson(span).pipe(
                Effect.flatMap(hashPublicTextSha256),
                Effect.map((digest) => ({ eventId: span.eventId, digest }))
              )
            );
          }
          if (
            (yield* hashPublicTextSha256(
              rows[0].evidenceEpoch === 0
                ? `transcript-acceptance/v1:${intakeConfig.hostId}:${intakeConfig.namespaceId}:${rows[0].payload}`
                : `transcript-acceptance/v2:${intakeConfig.hostId}:${intakeConfig.namespaceId}:${rows[0].evidenceEpoch}:${rows[0].payload}`
            )) !== receiptId
          )
            return yield* failure("storage");
          const page = yield* decodeTranscriptPageJson(rows[0].payload);
          if (page.cursor.namespaceId !== intakeConfig.namespaceId) return yield* failure("storage");
          return yield* Effect.forEach(
            A.filter(page.frames, (frame) => frame._tag === "Accepted"),
            (frame) =>
              encodeTranscriptFrameJson(frame).pipe(
                Effect.flatMap(hashPublicTextSha256),
                Effect.map((digest) => ({ eventId: frame.occurrenceId, digest }))
              )
          );
        });
        const registerCandidate = Effect.fnUntraced(function* (
          candidate: { readonly eventId: Sha256Hex; readonly digest: Sha256Hex },
          receiptId: Sha256Hex,
          population: number
        ) {
          const prior =
            yield* sql`SELECT payload_hash AS digest FROM observation_delivery_events WHERE event_id=${candidate.eventId}`.pipe(
              Effect.flatMap(decodeDigestRecordRows)
            );
          if (prior[0] !== undefined) {
            if (prior[0].digest !== candidate.digest) return yield* failure("conflict");
            return 0;
          }
          if (population >= config.maxEvents) return yield* failure("capacity");
          yield* sql`INSERT INTO observation_delivery_events(event_id,receipt_id,payload_hash) VALUES(${candidate.eventId},${receiptId},${candidate.digest})`;
          return 1;
        });
        const registerPage = Effect.fn("AiMetrics.delivery.registerPage")((receiptId: Sha256Hex) =>
          safe(
            sql.withTransaction(
              Effect.gen(function* () {
                const done =
                  yield* sql`SELECT events FROM observation_delivery_pages WHERE receipt_id=${receiptId}`.pipe(
                    Effect.flatMap(decodeEventsRecordRows)
                  );
                if (done[0] !== undefined) return done[0].events;
                const candidates = yield* readPageCandidates(receiptId);
                const total = yield* sql`SELECT count(*) AS n FROM observation_delivery_events`.pipe(
                  Effect.flatMap(S.decodeUnknownEffect(Count))
                );
                let added = 0;
                for (const candidate of candidates)
                  added += yield* registerCandidate(candidate, receiptId, total[0].n + added);
                yield* sql`INSERT INTO observation_delivery_pages(receipt_id,events) VALUES(${receiptId},${candidates.length})`;
                return candidates.length;
              })
            )
          )
        );
        const requireSendableEvent = Effect.fnUntraced(function* (eventId: Sha256Hex) {
          const enrolled =
            yield* sql`SELECT count(*) AS n FROM observation_delivery_events WHERE event_id=${eventId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(Count))
            );
          if (enrolled[0].n !== 1) return yield* failure("unknown-event");
          const disposed =
            yield* sql`SELECT count(*) AS n FROM observation_delivery_events e JOIN observation_page_dispositions d ON d.receipt_id=e.receipt_id WHERE e.event_id=${eventId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(Count))
            );
          if (disposed[0].n !== 0) return yield* failure("reclaimed");
          const count =
            yield* sql`SELECT count(*) AS n FROM observation_delivery_attempt_events WHERE event_id=${eventId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(Count))
            );
          if (count[0].n >= config.maxAttemptsPerEvent) return yield* failure("capacity");
        });
        const prepareAttempt = Effect.fn("AiMetrics.delivery.prepareAttempt")((input: DeliveryAttempt) =>
          safe(
            sql.withTransaction(
              Effect.gen(function* () {
                const normalized = DeliveryAttempt.make({ ...input, eventIds: A.sort(input.eventIds, Order.String) });
                const payload = yield* encodeDeliveryAttemptJson(normalized);
                const prior = yield* attempt(input.attemptId);
                if (O.isSome(prior)) {
                  if ((yield* encodeDeliveryAttemptJson(prior.value)) !== payload) return yield* failure("conflict");
                  return prior.value;
                }
                const count = yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`.pipe(
                  Effect.flatMap(S.decodeUnknownEffect(Count))
                );
                if (count[0].n >= config.maxAttempts) return yield* failure("capacity");
                for (const eventId of normalized.eventIds) yield* requireSendableEvent(eventId);
                const digest = yield* hashPublicTextSha256(payload);
                const now = yield* Clock.currentTimeMillis;
                yield* sql`INSERT INTO observation_delivery_attempts(attempt_id,payload,digest,recorded_at) VALUES(${input.attemptId},${payload},${digest},${now})`;
                for (const eventId of normalized.eventIds)
                  yield* sql`INSERT INTO observation_delivery_attempt_events(attempt_id,event_id) VALUES(${input.attemptId},${eventId})`;
                return normalized;
              })
            )
          )
        );
        // The same serialized transaction decides whether this caller owns the send.
        // An existing attempt is evidence, never a fresh network-send permission.
        const reserveSend = Effect.fn("AiMetrics.delivery.reserveSend")((input: DeliveryAttempt) =>
          safe(
            sql.withTransaction(
              Effect.gen(function* () {
                const prior = yield* attempt(input.attemptId);
                yield* prepareAttempt(input);
                return O.isNone(prior);
              })
            )
          )
        );
        const readOutcomePayload = Effect.fnUntraced(function* (attemptId: Sha256Hex) {
          return yield* sql`SELECT substr(payload,1,4097) AS payload,digest FROM observation_delivery_results WHERE attempt_id=${attemptId}`.pipe(
            Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
            Effect.flatMap(checkedPayload)
          );
        });
        const readStoredOutcome = Effect.fnUntraced(function* (attemptId: Sha256Hex) {
          const payload = yield* readOutcomePayload(attemptId);
          return O.isSome(payload) ? O.some(yield* decodeOutcome(payload.value)) : O.none();
        });
        const readOutcome = Effect.fn("AiMetrics.delivery.readOutcome")((attemptId: Sha256Hex) =>
          safe(
            Effect.gen(function* () {
              if (O.isNone(yield* attempt(attemptId))) return yield* failure("unknown-attempt");
              return yield* readStoredOutcome(attemptId);
            })
          )
        );
        const recordOutcome = Effect.fn("AiMetrics.delivery.recordOutcome")(
          (attemptId: Sha256Hex, outcome: typeof DeliveryOutcome.Type) =>
            safe(
              sql.withTransaction(
                Effect.gen(function* () {
                  const parent = yield* attempt(attemptId);
                  if (O.isNone(parent)) return yield* failure("unknown-attempt");
                  if (outcome._tag === "Partial" && outcome.rejectedCount > parent.value.eventIds.length)
                    return yield* failure("invalid-outcome");
                  const payload = yield* encodeDeliveryOutcomeJson(outcome);
                  const prior = yield* readOutcomePayload(attemptId);
                  if (O.isSome(prior)) {
                    if (prior.value !== payload) return yield* failure("conflict");
                    return;
                  }
                  const digest = yield* hashPublicTextSha256(payload);
                  const now = yield* Clock.currentTimeMillis;
                  yield* sql`INSERT INTO observation_delivery_results(attempt_id,payload,digest,recorded_at) VALUES(${attemptId},${payload},${digest},${now})`;
                })
              )
            )
        );
        const recordVisibility = Effect.fn("AiMetrics.delivery.recordVisibility")((proof: DeliveryVisibility) =>
          safe(
            sql.withTransaction(
              Effect.gen(function* () {
                const parent = yield* attempt(proof.attemptId);
                if (O.isNone(parent)) return yield* failure("unknown-attempt");
                if (
                  !A.contains(parent.value.eventIds, proof.eventId) ||
                  parent.value.payloadDigest !== proof.payloadDigest
                )
                  return yield* failure("conflict");
                const prior =
                  yield* sql`SELECT substr(payload,1,4097) AS payload,digest FROM observation_delivery_visibility WHERE event_id=${proof.eventId}`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
                    Effect.flatMap(checkedPayload)
                  );
                if (O.isSome(prior)) return yield* decodeVisibility(prior.value);
                const payload = yield* encodeDeliveryVisibilityJson(proof);
                const digest = yield* hashPublicTextSha256(payload);
                yield* sql`INSERT INTO observation_delivery_visibility(event_id,payload,digest) VALUES(${proof.eventId},${payload},${digest})`;
                return proof;
              })
            )
          )
        );
        const readEventOutcome = Effect.fnUntraced(function* (eventId: Sha256Hex, attemptId: Sha256Hex) {
          const parent = yield* attempt(attemptId);
          if (O.isNone(parent) || !A.contains(parent.value.eventIds, eventId)) return yield* failure("storage");
          return yield* readStoredOutcome(attemptId);
        });
        const readEventHistory = Effect.fnUntraced(function* (
          eventId: Sha256Hex,
          rows: ReadonlyArray<{ readonly attemptId: Sha256Hex }>
        ) {
          let acknowledged = 0;
          let ambiguous = 0;
          let lastRejected = false;
          for (const row of rows) {
            const outcome = yield* readEventOutcome(eventId, row.attemptId);
            if (O.isNone(outcome)) {
              ambiguous += 1;
              lastRejected = false;
              continue;
            }
            if (outcome.value._tag === "Accepted") acknowledged += 1;
            if (outcome.value._tag === "Partial" || outcome.value._tag === "Unknown") ambiguous += 1;
            lastRejected = outcome.value._tag === "Rejected";
          }
          return AttemptEvidence.make({ acknowledged, ambiguous, lastRejected });
        });
        const readEventVisibility = Effect.fnUntraced(function* (eventId: Sha256Hex) {
          const visibility =
            yield* sql`SELECT substr(payload,1,4097) AS payload,digest FROM observation_delivery_visibility WHERE event_id=${eventId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
              Effect.flatMap(checkedPayload)
            );
          if (O.isNone(visibility)) return false;
          const proof = yield* decodeVisibility(visibility.value);
          const parent = yield* attempt(proof.attemptId);
          if (
            proof.eventId !== eventId ||
            O.isNone(parent) ||
            !A.contains(parent.value.eventIds, eventId) ||
            parent.value.payloadDigest !== proof.payloadDigest
          )
            return yield* failure("storage");
          return true;
        });
        const state = Effect.fn("AiMetrics.delivery.state")((eventId: Sha256Hex) =>
          safe(
            sql.withTransaction(
              Effect.gen(function* () {
                const enrolled =
                  yield* sql`SELECT count(*) AS n FROM observation_delivery_events WHERE event_id=${eventId}`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(Count))
                  );
                if (enrolled[0].n === 0) return O.none<DeliveryEventState>();
                const rows =
                  yield* sql`SELECT e.attempt_id AS "attemptId" FROM observation_delivery_attempt_events e LEFT JOIN observation_delivery_attempts a ON a.attempt_id=e.attempt_id WHERE e.event_id=${eventId} ORDER BY a.sequence LIMIT 129`.pipe(
                    Effect.flatMap(decodeAttemptIdRecordRows)
                  );
                if (rows.length > config.maxAttemptsPerEvent) return yield* failure("storage");
                const history = yield* readEventHistory(eventId, rows);
                const visible = yield* readEventVisibility(eventId);
                return O.some(
                  DeliveryEventState.make({
                    eventId,
                    targetId: config.targetId,
                    attempts: rows.length,
                    acknowledgedAttempts: history.acknowledged,
                    ambiguousAttempts: history.ambiguous,
                    state: stateFromEvidence(visible, history),
                  })
                );
              })
            )
          )
        );
        const unregisteredPages = safe(
          sql`SELECT p.receipt_id AS "receiptId" FROM observation_intake_pages p LEFT JOIN observation_delivery_pages d ON d.receipt_id=p.receipt_id WHERE d.receipt_id IS NULL ORDER BY p.sequence LIMIT 32`.pipe(
            Effect.flatMap(decodeReceiptIdRecordRows),
            Effect.map((rows) => A.map(rows, (row) => row.receiptId))
          )
        );
        return {
          registerPage,
          evidenceWindow: native.evidenceWindow,
          unregisteredPages,
          prepareAttempt,
          reserveSend,
          recordOutcome,
          readOutcome,
          recordVisibility,
          state,
          attempt,
        };
      })
    )
);
