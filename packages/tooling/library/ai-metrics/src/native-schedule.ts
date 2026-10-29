/**
 * Bounded restartable scheduling over durable native and reconstructed receipts and delivery facts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import { makeDeliveryLedger } from "./delivery-ledger.ts";
import { makeObservationExportReader } from "./internal/observation-export-reader.ts";
import { NativeDeliveryRequest, NativeDeliveryResult } from "./native-delivery.ts";
import { NativeReadbackResult } from "./native-readback.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import type { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import type { makeNativeDelivery } from "./native-delivery.ts";
import type { makeNativeReadback } from "./native-readback.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("native-schedule");
const milliseconds = S.Int.check(S.isBetween({ minimum: 100, maximum: 3600000 }));
/**
 * Age observations for unresolved events visited during one bounded pass.
 * **Example** (Inspecting the lag summary)
 * ```ts
 * import { ObservationLagSummary } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(typeof ObservationLagSummary.make)
 * ```
 * **Details** Maxima cover sampled unresolved events before their pass operation,
 * not the oldest event in the journal or fleet. Source age includes historical
 * replay. Missing timestamps and future clocks never become zero lag.
 * @category models
 * @since 0.0.0
 */
export class ObservationLagSummary extends S.Opaque<ObservationLagSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    sampledEvents: S.Natural,
    unknownSourceTimes: S.Natural,
    acceptedClockRegressions: S.Natural,
    sourceClockRegressions: S.Natural,
    maxAcceptedAgeMillis: S.Option(S.Natural),
    maxSourceAgeMillis: S.Option(S.Natural),
  }).pipe(
    $I.annoteSchema("ObservationLagSummary", {
      description: "Bounded unresolved-event age sample with explicit unknowns.",
    })
  )
) {}
const AgeSample = S.Struct({ accepted: S.Int, source: S.Option(S.Int) }).pipe(
  $I.annoteSchema("AgeSample", { description: "Internal acceptance and optional source age observation." })
);
const summarizeAges = (samples: ReadonlyArray<typeof AgeSample.Type>) => {
  const accepted = A.filter(
    A.map(samples, (sample) => sample.accepted),
    (age) => age >= 0
  );
  const source = A.getSomes(A.map(samples, (sample) => sample.source));
  const positiveSource = A.filter(source, (age) => age >= 0);
  return ObservationLagSummary.make({
    sampledEvents: samples.length,
    unknownSourceTimes: samples.length - source.length,
    acceptedClockRegressions: samples.length - accepted.length,
    sourceClockRegressions: source.length - positiveSource.length,
    maxAcceptedAgeMillis: A.isReadonlyArrayNonEmpty(accepted) ? O.some(Math.max(...accepted)) : O.none(),
    maxSourceAgeMillis: A.isReadonlyArrayNonEmpty(positiveSource) ? O.some(Math.max(...positiveSource)) : O.none(),
  });
};
/**
 * Explicit authorization to repeat stable event identities at a qualified target.
 * **Example** (Inspecting the opt-in policy)
 * ```ts
 * import { IdempotentReplayPolicy } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(typeof IdempotentReplayPolicy.make)
 * ```
 * **Details** The owner supplies a retained qualification receipt digest for the
 * target's duplicate behavior; the digest is a reference, not automatically
 * validated proof. A fresh missing read-back is required before retry, but is
 * never treated as proof of loss. The ledger's attempt ceilings still apply.
 * Changing target or qualification requires a new owned scheduling profile.
 * @category models
 * @since 0.0.0
 */
export class IdempotentReplayPolicy extends S.Opaque<IdempotentReplayPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    targetId: Sha256Hex,
    qualificationDigest: Sha256Hex,
    minimumDelayMillis: milliseconds,
  }).pipe(
    $I.annoteSchema("IdempotentReplayPolicy", {
      description: "Owner-declared target-bound idempotent replay qualification.",
    })
  )
) {}
/**
 * Immutable bounded native and reconstructed scheduling policy.
 * **Example** (Inspecting policy construction)
 * ```ts
 * import { NativeSchedulePolicy } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(typeof NativeSchedulePolicy.make)
 * ```
 * **Details** Each pass visits at most 32 durable events. Explicit retryable responses and repeated read-back queries use capped exponential backoff. Query delay starts at reconcileDelayMillis and caps at the greater of reconcileDelayMillis and maxRetryDelayMillis. Accepted and ambiguous attempts are queried before any replay. They remain held unless the owner explicitly qualifies duplicate handling for this target; missing read-back is not proof of non-delivery. The cooperative tick deadline does not replace process limits. This policy does not start a timer or enroll a source.
 * @category models
 * @since 0.0.0
 */
export class NativeSchedulePolicy extends S.Opaque<NativeSchedulePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    maxEvents: S.Int.check(S.isBetween({ minimum: 1, maximum: 32 })),
    retryDelayMillis: milliseconds,
    maxRetryDelayMillis: milliseconds,
    reconcileDelayMillis: milliseconds,
    tickTimeoutMillis: S.Int.check(S.isBetween({ minimum: 100, maximum: 60000 })),
    idempotentReplay: IdempotentReplayPolicy.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
  })
    .check(
      S.makeFilter((p) => p.maxRetryDelayMillis >= p.retryDelayMillis, {
        identifier: "NativeScheduleBackoff",
        message: "Maximum retry delay must cover the initial delay",
      })
    )
    .pipe($I.annoteSchema("NativeSchedulePolicy", { description: "Bounded immutable scheduling policy." }))
) {}
/**
 * Safe evidence from one visited event.
 * **Example** (Inspecting outcome constructors)
 * ```ts
 * import { NativeScheduleOutcome } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(NativeScheduleOutcome.cases.Held)
 * ```
 * **Details** Held reasons are workflow observations, not replacements for the five delivery states. Failed contains no SQL, endpoint, payload or decoder error. Query errors remain distinct from a missing span.
 * @category models
 * @since 0.0.0
 */
export const NativeScheduleOutcome = S.TaggedUnion({
  Sent: { eventId: Sha256Hex, result: NativeDeliveryResult },
  Reconciled: { eventId: Sha256Hex, result: NativeReadbackResult },
  Held: {
    eventId: Sha256Hex,
    reason: S.Literals([
      "visible",
      "permanent-refusal",
      "attempt-limit",
      "retry-delay",
      "query-delay",
      "clock-regression",
    ]),
  },
  Failed: { eventId: Sha256Hex, reason: S.Literals(["storage", "send", "readback"]) },
}).pipe($I.annoteSchema("NativeScheduleOutcome", { description: "Content-free scheduling outcome." }));
/**
 * A bounded pass result or an explicitly incomplete deadline result.
 * **Example** (Inspecting tick constructors)
 * ```ts
 * import { NativeScheduleTick } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(NativeScheduleTick.cases.Deadline)
 * ```
 * **Details** Complete with no outcomes means no retained accepted-event candidates at this observation, not fleet-wide idle. Deadline can follow committed work; the durable ledger remains authoritative. The cursor advances before I/O, so interrupted candidates return on a later wrap.
 * @category models
 * @since 0.0.0
 */
export const NativeScheduleTick = S.TaggedUnion({
  Complete: {
    wrapped: S.Boolean,
    outcomes: S.Array(NativeScheduleOutcome).check(S.isMaxLength(32)),
    lag: S.Option(ObservationLagSummary).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  Deadline: {},
}).pipe($I.annoteSchema("NativeScheduleTick", { description: "Bounded native and reconstructed scheduling pass." }));
/**
 * Safe scheduler configuration, persistence or concurrency refusal.
 * **Example** (Inspecting an error)
 * ```ts
 * import { NativeScheduleError } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(NativeScheduleError.make({ reason: "busy" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class NativeScheduleError extends S.TaggedError<NativeScheduleError, { readonly brand: unique symbol }>(
  $I`NativeScheduleError`
)(
  "NativeScheduleError",
  { reason: S.Literals(["configuration", "storage", "busy"]) },
  $I.annote("NativeScheduleError", { description: "Safe native scheduling refusal." })
) {}
const failure = (reason: NativeScheduleError["reason"]) => NativeScheduleError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(NativeScheduleError)(error) ? error : failure("storage"))));
const Cursor = S.Struct({
  profile: S.String,
  sequence: S.Natural,
  index: S.Int.check(S.isGreaterThanOrEqualTo(-1)),
  digest: Sha256Hex,
});
const Candidate = S.Struct({ receiptId: Sha256Hex, eventId: Sha256Hex, sequence: S.Natural, index: S.Natural });
const PageRef = S.Struct({ receiptId: Sha256Hex, sequence: S.Natural });
const LastAttempt = S.Struct({ attemptId: Sha256Hex, recordedAt: S.Natural });
const QueryReservation = S.Struct({
  attemptId: Sha256Hex,
  count: S.Int.check(S.isBetween({ minimum: 1, maximum: 31 })),
  recordedAt: S.Natural,
  digest: Sha256Hex,
}).pipe($I.annoteSchema("QueryReservation", { description: "Bounded durable pre-query reservation." }));

/**
 * Recover and execute bounded native and reconstructed delivery work from the existing journal.
 * **Example** (Inspecting the factory)
 * ```ts
 * import { makeNativeDeliveryScheduler } from "@beep/repo-ai-metrics/native-schedule"
 * console.log(typeof makeNativeDeliveryScheduler)
 * ```
 * **Details** Captures one owned SQL client and existing sender/read-back capabilities. A checksummed singleton binds policy/host/namespace/target and persists fair traversal independently of delivery success. A replaceable checksummed query reservation per enrolled event is bounded by the delivery ledger and cleared on evidence retirement. It is committed before query I/O, so interruption or reconstruction cannot immediately repeat a query. New transport attempts reset that event's query ordinal. New sends use deterministic epoch-scoped single-event attempt IDs; retries require a fresh ordinal. Existing multi-event attempts are reconstructed exactly for read-back. Source payloads and all send facts remain authoritative. One pass at a time is admitted without waiting; hard single-process ownership is a deployment requirement. Retired/disposed payloads are excluded by the live payload join; this is not proof they were delivered. Qualified replay still requires a fresh Missing result, its minimum delay, capped backoff and remaining attempt capacity. Query errors and mismatches never authorize replay.
 * @category services
 * @since 0.0.0
 */
export const makeNativeDeliveryScheduler = Effect.fn("AiMetrics.makeNativeDeliveryScheduler")(function* (
  intakeConfig: TranscriptIntakeConfig,
  ledgerConfig: DeliveryLedgerConfig,
  policy: NativeSchedulePolicy,
  delivery: Effect.Success<ReturnType<typeof makeNativeDelivery>>,
  readback: Effect.Success<ReturnType<typeof makeNativeReadback>>
) {
  if (O.isSome(policy.idempotentReplay) && policy.idempotentReplay.value.targetId !== ledgerConfig.targetId)
    return yield* failure("configuration");
  const sql = yield* SqlClient.SqlClient;
  const pages = yield* makeObservationExportReader(intakeConfig);
  const ledger = yield* makeDeliveryLedger(intakeConfig, ledgerConfig);
  const permit = yield* Semaphore.make(1);
  const encodedPolicy = yield* S.encodeEffect(S.fromJsonString(NativeSchedulePolicy))(policy);
  const profile = yield* hashPublicTextSha256(
    `observation-schedule/v2:${intakeConfig.hostId}:${intakeConfig.namespaceId}:${ledgerConfig.targetId}:${encodedPolicy}`
  );
  const digest = (sequence: number, index: number) =>
    hashPublicTextSha256(`observation-schedule-cursor/v2:${profile}:${sequence}:${index}`);
  yield* safe(
    sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`CREATE TABLE IF NOT EXISTS observation_native_schedule(singleton INTEGER PRIMARY KEY CHECK(singleton=1), profile TEXT NOT NULL, sequence INTEGER NOT NULL, span_index INTEGER NOT NULL, digest TEXT NOT NULL)`;
        const initialDigest = yield* digest(0, -1);
        yield* sql`INSERT OR IGNORE INTO observation_native_schedule(singleton,profile,sequence,span_index,digest) VALUES(1,${profile},0,-1,${initialDigest})`;
      })
    )
  );
  const readCursor = safe(
    Effect.gen(function* () {
      const [cursor] =
        yield* sql`SELECT profile,sequence,span_index AS "index",digest FROM observation_native_schedule WHERE singleton=1`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(S.Tuple([Cursor])))
        );
      if (cursor.profile !== profile) return yield* failure("configuration");
      if (cursor.digest !== (yield* digest(cursor.sequence, cursor.index))) return yield* failure("storage");
      return cursor;
    })
  );
  yield* readCursor;
  const select = safe(
    sql.withTransaction(
      Effect.gen(function* () {
        const cursor = yield* readCursor;
        let refs =
          yield* sql`SELECT receipt_id AS "receiptId",sequence FROM observation_intake_pages WHERE sequence>=${cursor.sequence} ORDER BY sequence LIMIT 1`.pipe(
            Effect.flatMap(S.decodeUnknownEffect(S.Array(PageRef)))
          );
        let wrapped = false;
        let ref = refs[0];
        let current = ref === undefined ? O.none() : yield* pages.read(ref.receiptId);
        let ids = O.isSome(current) ? pages.eventIds(current.value) : [];
        let index = ref?.sequence === cursor.sequence ? cursor.index + 1 : 0;
        if (ref === undefined || index >= ids.length) {
          // At most one further page is inspected per selection. Empty or
          // rejected-only pages advance the durable cursor without a full scan.
          refs =
            yield* sql`SELECT receipt_id AS "receiptId",sequence FROM observation_intake_pages WHERE sequence>${ref?.sequence ?? cursor.sequence} ORDER BY sequence LIMIT 1`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(S.Array(PageRef)))
            );
          if (refs.length === 0) {
            wrapped = cursor.sequence !== 0 || ref !== undefined;
            refs =
              yield* sql`SELECT receipt_id AS "receiptId",sequence FROM observation_intake_pages ORDER BY sequence LIMIT 1`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(S.Array(PageRef)))
              );
          }
          ref = refs[0];
          current = ref === undefined ? O.none() : yield* pages.read(ref.receiptId);
          ids = O.isSome(current) ? pages.eventIds(current.value) : [];
          index = 0;
        }
        const eventId = ids[index];
        const candidates =
          ref !== undefined && eventId !== undefined
            ? [Candidate.make({ receiptId: ref.receiptId, sequence: ref.sequence, index, eventId })]
            : [];
        if (ref !== undefined) {
          if (O.isNone(current)) return yield* failure("storage");
          const claimed = eventId === undefined ? -1 : index;
          const nextDigest = yield* digest(ref.sequence, claimed);
          yield* sql`UPDATE observation_native_schedule SET sequence=${ref.sequence},span_index=${claimed},digest=${nextDigest} WHERE singleton=1`;
        }
        return { candidates, wrapped };
      })
    )
  );
  const queryDigest = (eventId: Sha256Hex, attemptId: Sha256Hex, count: number, recordedAt: number) =>
    hashPublicTextSha256(`observation-query/v1:${profile}:${eventId}:${attemptId}:${count}:${recordedAt}`);
  const reserveQuery = (eventId: Sha256Hex, attemptId: Sha256Hex, now: number) =>
    safe(
      sql.withTransaction(
        Effect.gen(function* () {
          const rows =
            yield* sql`SELECT attempt_id AS "attemptId",query_count AS count,recorded_at AS "recordedAt",digest FROM observation_delivery_queries WHERE event_id=${eventId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(S.Array(QueryReservation)))
            );
          const previous = rows[0];
          let count = 1;
          if (previous !== undefined) {
            if (
              previous.digest !== (yield* queryDigest(eventId, previous.attemptId, previous.count, previous.recordedAt))
            )
              return yield* failure("storage");
            if (now < previous.recordedAt)
              return O.some<typeof NativeScheduleOutcome.cases.Held.Type.reason>("clock-regression");
            if (previous.attemptId === attemptId) {
              const delay = Math.min(
                Math.max(policy.reconcileDelayMillis, policy.maxRetryDelayMillis),
                policy.reconcileDelayMillis * 2 ** (previous.count - 1)
              );
              if (now - previous.recordedAt < delay)
                return O.some<typeof NativeScheduleOutcome.cases.Held.Type.reason>("query-delay");
              count = Math.min(31, previous.count + 1);
            }
          }
          const checksum = yield* queryDigest(eventId, attemptId, count, now);
          yield* sql`INSERT INTO observation_delivery_queries(event_id,attempt_id,query_count,recorded_at,digest) VALUES(${eventId},${attemptId},${count},${now},${checksum})
        ON CONFLICT(event_id) DO UPDATE SET attempt_id=excluded.attempt_id,query_count=excluded.query_count,recorded_at=excluded.recorded_at,digest=excluded.digest`;
          return O.none<typeof NativeScheduleOutcome.cases.Held.Type.reason>();
        })
      )
    );
  const visit = Effect.fn("AiMetrics.nativeSchedule.visit")(function* (
    candidate: typeof Candidate.Type,
    observeAge: (sample: typeof AgeSample.Type) => void
  ) {
    const held = (reason: typeof NativeScheduleOutcome.cases.Held.Type.reason) =>
      NativeScheduleOutcome.cases.Held.make({ eventId: candidate.eventId, reason });
    const page = yield* pages.read(candidate.receiptId);
    if (O.isNone(page)) return yield* failure("storage");
    const ids = pages.eventIds(page.value);
    const offset = A.findFirstIndex(ids, (id) => id === candidate.eventId);
    if (O.isNone(offset)) return yield* failure("storage");
    yield* ledger.registerPage(candidate.receiptId);
    const state = yield* ledger.state(candidate.eventId);
    if (O.isNone(state)) return yield* failure("storage");
    if (state.value.state === "visible") return held("visible");
    if (state.value.state === "rejected") return held("permanent-refusal");
    const observedAt = yield* Clock.currentTimeMillis;
    observeAge({
      accepted: observedAt - page.value.receipt.acceptedAt,
      source: O.map(pages.sourceTimeMillis(page.value, offset.value), (time) => observedAt - time),
    });
    const rows =
      yield* sql`SELECT a.attempt_id AS "attemptId",a.recorded_at AS "recordedAt" FROM observation_delivery_attempt_events e
      JOIN observation_delivery_attempts a ON a.attempt_id=e.attempt_id WHERE e.event_id=${candidate.eventId}
      ORDER BY a.sequence DESC LIMIT 1`.pipe(Effect.flatMap(S.decodeUnknownEffect(S.Array(LastAttempt))));
    const prior = O.fromUndefinedOr(rows[0]);
    if ((state.value.attempts === 0) !== O.isNone(prior)) return yield* failure("storage");
    const now = yield* Clock.currentTimeMillis;
    const elapsed = O.isSome(prior) ? now - prior.value.recordedAt : 0;
    if (elapsed < 0) return held("clock-regression");
    if (state.value.state === "accepted-unverified" || state.value.state === "unresolved") {
      if (O.isNone(prior)) return yield* failure("storage");
      if (elapsed < policy.reconcileDelayMillis) return held("query-delay");
      const attempt = yield* ledger.attempt(prior.value.attemptId);
      if (O.isNone(attempt)) return yield* failure("storage");
      // The ledger canonicalizes the attempt's ID set; wire bytes retain source
      // order. Recover the original contiguous selection without sorting payloads.
      const first = A.findFirstIndex(ids, (id) => A.contains(attempt.value.eventIds, id));
      if (O.isNone(first)) return yield* failure("storage");
      const selected = A.take(A.drop(ids, first.value), attempt.value.eventIds.length);
      if (
        selected.length !== attempt.value.eventIds.length ||
        !A.every(selected, (id) => A.contains(attempt.value.eventIds, id))
      )
        return yield* failure("storage");
      const queryHold = yield* reserveQuery(candidate.eventId, prior.value.attemptId, now);
      if (O.isSome(queryHold)) return held(queryHold.value);
      const reconciliation = yield* readback
        .reconcile(
          NativeDeliveryRequest.make({
            receiptId: candidate.receiptId,
            attemptId: prior.value.attemptId,
            offset: first.value,
            limit: selected.length,
          }),
          candidate.eventId
        )
        .pipe(Effect.result);
      if (Result.isFailure(reconciliation))
        return NativeScheduleOutcome.cases.Failed.make({ eventId: candidate.eventId, reason: "readback" });
      if (
        !NativeReadbackResult.guards.Missing(reconciliation.success) ||
        O.isNone(policy.idempotentReplay) ||
        elapsed < policy.idempotentReplay.value.minimumDelayMillis
      )
        return NativeScheduleOutcome.cases.Reconciled.make({
          eventId: candidate.eventId,
          result: reconciliation.success,
        });
      // Historical acceptance/ambiguity must remain truthful, but cannot erase
      // the latest transport's instruction that this payload is not retryable.
      const latestOutcome = yield* ledger.readOutcome(prior.value.attemptId);
      if (O.isSome(latestOutcome) && latestOutcome.value._tag === "Rejected") return held("permanent-refusal");
    }
    if (state.value.attempts >= ledgerConfig.maxAttemptsPerEvent) return held("attempt-limit");
    const delay = Math.min(
      policy.maxRetryDelayMillis,
      policy.retryDelayMillis * 2 ** Math.min(30, Math.max(0, state.value.attempts - 1))
    );
    if (O.isSome(prior) && elapsed < delay) return held("retry-delay");
    const attemptId = yield* hashPublicTextSha256(
      `native-schedule-attempt/v1:${ledgerConfig.targetId}:${page.value.receipt.evidenceEpoch}:${candidate.eventId}:${state.value.attempts}`
    );
    return yield* delivery
      .send(NativeDeliveryRequest.make({ receiptId: candidate.receiptId, attemptId, offset: offset.value, limit: 1 }))
      .pipe(
        Effect.map((result) => NativeScheduleOutcome.cases.Sent.make({ eventId: candidate.eventId, result })),
        Effect.orElseSucceed(() =>
          NativeScheduleOutcome.cases.Failed.make({ eventId: candidate.eventId, reason: "send" })
        )
      );
  });
  const tick = Effect.gen(function* () {
    const admitted = yield* permit.withPermitsIfAvailable(1)(
      Effect.gen(function* () {
        let outcomes: ReadonlyArray<typeof NativeScheduleOutcome.Type> = [];
        let ages: ReadonlyArray<typeof AgeSample.Type> = [];
        let wrapped = false;
        const visited = new Set<string>();
        for (let index = 0; index < policy.maxEvents; index++) {
          // Claim only the next event before I/O. Reserving a whole batch here
          // would repeatedly skip its tail when the first event times out.
          const selected = yield* select;
          wrapped = wrapped || selected.wrapped;
          const candidate = selected.candidates[0];
          if (candidate === undefined || visited.has(candidate.eventId)) break;
          visited.add(candidate.eventId);
          const outcome = yield* visit(candidate, (sample) => {
            ages = A.append(ages, sample);
          }).pipe(
            Effect.orElseSucceed(() =>
              NativeScheduleOutcome.cases.Failed.make({ eventId: candidate.eventId, reason: "storage" })
            )
          );
          outcomes = A.append(outcomes, outcome);
        }
        return NativeScheduleTick.cases.Complete.make({ wrapped, outcomes, lag: O.some(summarizeAges(ages)) });
      }).pipe(Effect.timeoutOption(policy.tickTimeoutMillis))
    );
    if (O.isNone(admitted)) return yield* failure("busy");
    return O.getOrElse(admitted.value, () => NativeScheduleTick.cases.Deadline.make({}));
  });
  return { tick };
});
