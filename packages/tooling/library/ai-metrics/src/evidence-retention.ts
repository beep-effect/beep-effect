/**
 * Atomic retirement of a drained local evidence window into bounded accounting.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { makeDeliveryLedger } from "./delivery-ledger.ts";
import { EvidenceRetirement, EvidenceWindow, RetiredEvidenceTotals } from "./evidence-window.ts";
import { makeEvidenceRecovery } from "./internal/evidence-recovery.ts";
import { readEnrolledOwnership, readUnenrolledNativeOwnership } from "./internal/unenrolled-evidence.ts";
import { makeNativeIntakeJournal } from "./native-intake.ts";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchReceipt,
} from "./observation-launch-facts.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { makeTranscriptIntakeJournal } from "./transcript-intake.ts";
import type { DeliveryEventState, DeliveryLedgerConfig } from "./delivery-ledger.ts";
import type { PageDisposition, TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("evidence-retention");
/**
 * Explicit observation-window lifetime and bounded retirement work.
 *
 * **Details**
 *
 * minEpochMillis is the minimum window duration, not a minimum age for every fact. Retirement requires every payload disposed and a quiet interval after sends. It erases per-event local detail, preserves aggregate uncertainty and source cursors, and ends that epoch's duplicate-detection guarantee. maxRecoveryRows and maxRecoveryBytes bound a single logical recovery generation (encoded row payload bytes; database overhead also remains under the journal page ceiling). No production policy is selected by this API.
 *
 * **Example** (Inspect the evidence retention policy constructor)
 *
 * ```ts
 * import { EvidenceRetentionPolicy } from "@beep/repo-ai-metrics/evidence-retention"
 * console.log(typeof EvidenceRetentionPolicy.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceRetentionPolicy extends S.Opaque<EvidenceRetentionPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("evidence-retention/v2"),
    minEpochMillis: S.Int.check(S.isBetween({ minimum: 60_000, maximum: 2_592_000_000 })),
    minAttemptQuietMillis: S.Int.check(S.isBetween({ minimum: 60_000, maximum: 86_400_000 })),
    maxRecords: S.Int.check(S.isBetween({ minimum: 1, maximum: 262144 })),
    maxRecoveryRows: S.Int.check(S.isBetween({ minimum: 1, maximum: 262144 })).pipe(
      S.withConstructorDefault(Effect.succeed(4096))
    ),
    maxRecoveryBytes: S.Int.check(S.isBetween({ minimum: 4096, maximum: 134217728 })).pipe(
      S.withConstructorDefault(Effect.succeed(16777216))
    ),
    deadlineMillis: S.Int.check(S.isBetween({ minimum: 1000, maximum: 60000 })),
  }).pipe(
    $I.annoteSchema("EvidenceRetentionPolicy", {
      description: "Bounded explicit local evidence-window retirement policy.",
    })
  )
) {}
/**
 * Safe refusal of evidence retirement without deleting facts.
 * **Example** (Inspecting a failure)
 * ```ts
 * import { EvidenceRetentionError } from "@beep/repo-ai-metrics/evidence-retention"
 * console.log(EvidenceRetentionError.make({reason:"conflict"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class EvidenceRetentionError extends S.TaggedError<EvidenceRetentionError, { readonly brand: unique symbol }>(
  $I`EvidenceRetentionError`
)(
  "EvidenceRetentionError",
  { reason: S.Literals(["configuration", "capacity", "conflict", "deadline", "storage"]) },
  $I.annote("EvidenceRetentionError", { description: "Content-free evidence retirement refusal." })
) {}
const failure = (reason: EvidenceRetentionError["reason"]) => EvidenceRetentionError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(EvidenceRetentionError)(error) ? error : failure("storage"))));
const isLiteralValue = S.is(S.Literals(["capacity", "conflict"]));

const recoveryFailure = (error: unknown) => failure(isLiteralValue(error) ? error : "storage");
const Count = S.Tuple([S.Struct({ n: S.Natural })]);
const encodeEvidenceRetentionPolicyJson = S.encodeEffect(S.fromJsonString(EvidenceRetentionPolicy));
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })]));
const decodeArguments2 = S.decodeUnknownEffect(S.Tuple([S.Struct({ latest: S.NullOr(S.Natural) })]));
const decodeIdRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ id: Sha256Hex })));
// The two readers below supply ordered, bounded keyset queries. This visitor
// stays in the caller's transaction and never stores a cursor independently.
const visitRetirementIds = Effect.fnUntraced(function* <E1, R1, E2, R2>(
  read: (after: string) => Effect.Effect<Effect.Success<ReturnType<typeof decodeIdRecordRows>>, E1, R1>,
  visit: (id: Sha256Hex) => Effect.Effect<void, E2, R2>
) {
  let after = "";
  while (true) {
    const rows = yield* read(after);
    if (rows.length === 0) return;
    for (const row of rows) {
      yield* visit(row.id);
      after = row.id;
    }
  }
});
const encodeObservationLaunchReceiptJson = S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt));
const decodeEventsRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ events: S.Natural })));
const encodeEvidenceRetirementJson = S.encodeEffect(S.fromJsonString(EvidenceRetirement));
const encodeEvidenceWindowJson = S.encodeEffect(S.fromJsonString(EvidenceWindow));

const emptyTotals = () => ({ ...R.map(RetiredEvidenceTotals.fields, () => 0) });
const unenrolledReferenceCount = (page: PageDisposition) =>
  page.reason === "retention-expired" ? (page.unenrolledReferences ?? 0) : 0;
const requireCount = Effect.fnUntraced(function* (actual: number, expected: number) {
  if (actual !== expected) return yield* failure("storage");
});

const launchCountKey = ObservationLaunchFact.match({
  Prepared: (): "launchPreparations" => "launchPreparations",
  Started: (): "launchStarts" => "launchStarts",
  SessionBound: (): "launchSessionBindings" => "launchSessionBindings",
  Finished: (): "launchFinishes" => "launchFinishes",
});
const eventCountKey = Match.type<DeliveryEventState["state"]>().pipe(
  Match.when("accepted-unverified", (): "acceptedUnverified" => "acceptedUnverified"),
  Match.orElse((state) => state)
);

/**
 * Retire a fully disposed epoch and preserve a bounded checksummed summary.
 *
 * **Details**
 *
 * seal(expectedEpoch) is an atomic compare-and-swap. None means the epoch is empty, young, has retained payloads, or has recent send reservations. Exact replay of the latest successful seal returns its summary. Older/conflicting requests fail. Bounded pages of checksummed receipts and ledger states feed cumulative observation counts; overflow fails before deletion. A checksummed bounded recovery generation is copied before deletion in the same transaction. Copy failure preserves current facts and the previous generation. restore(retirementDigest) restores compact facts and the predecessor window only while the exact successor is empty and admission/attempt sequences are unchanged; it preserves source cursors. Exact replay returns already-restored. The next seal replaces the recovery generation. This is logical rollback, not an independent database/disaster backup. Deletion and epoch advancement commit together. Earlier details cannot be reconstructed from the summary alone; current-window absence is not lifetime absence. Source files, cursors and held services are untouched.
 *
 * **Example** (Inspect the factory for evidence retention)
 *
 * ```ts
 * import { makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention"
 * console.log(typeof makeEvidenceRetention)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeEvidenceRetention = Effect.fn("AiMetrics.makeEvidenceRetention")(
  (intakeConfig: TranscriptIntakeConfig, ledgerConfig: DeliveryLedgerConfig, policy: EvidenceRetentionPolicy) =>
    safe(
      Effect.gen(function* () {
        const base = yield* makeTranscriptIntakeJournal(intakeConfig);
        const native = yield* makeNativeIntakeJournal(intakeConfig);
        const ledger = yield* makeDeliveryLedger(intakeConfig, ledgerConfig);
        const launchFacts = yield* makeObservationLaunchFacts(intakeConfig);
        const sql = yield* SqlClient.SqlClient;
        const encodedPolicy = yield* encodeEvidenceRetentionPolicyJson(policy);
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`CREATE TABLE IF NOT EXISTS observation_evidence_policy(singleton INTEGER PRIMARY KEY CHECK(singleton=1),payload TEXT NOT NULL)`;
            yield* sql`INSERT OR IGNORE INTO observation_evidence_policy(singleton,payload) VALUES(1,${encodedPolicy})`;
            const rows =
              yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_evidence_policy WHERE singleton=1`.pipe(
                Effect.flatMap(decodeArguments)
              );
            if (rows[0].payload !== encodedPolicy) return yield* failure("configuration");
          })
        );
        const recovery = yield* makeEvidenceRecovery(policy.maxRecoveryRows, policy.maxRecoveryBytes);

        // These phases run only inside seal's existing transaction. No helper
        // commits independently; every validation still precedes recovery/deletion.
        const collectLaunch = Effect.fnUntraced(function* (
          id: Sha256Hex,
          epoch: number,
          totals: ReturnType<typeof emptyTotals>
        ) {
          const facts = yield* launchFacts.read(id, epoch);
          if (!A.some(facts, (fact) => fact.fact._tag === "Finished")) return O.none<number>();
          for (const receipt of facts) {
            totals[launchCountKey(receipt.fact)] += 1;
            const encoded = yield* encodeObservationLaunchReceiptJson(receipt);
            totals.launchPayloadBytes += new TextEncoder().encode(encoded).byteLength;
          }
          return O.some(facts.length);
        });
        const collectLaunchEvidence = Effect.fnUntraced(function* (
          epoch: number,
          totals: ReturnType<typeof emptyTotals>,
          expectedRows: number
        ) {
          let launchAfter = "";
          let launchRows = 0;
          while (true) {
            const rows =
              yield* sql`SELECT launch_id AS id FROM observation_launch_facts WHERE phase=0 AND launch_id>${launchAfter} ORDER BY launch_id LIMIT 32`.pipe(
                Effect.flatMap(decodeIdRecordRows)
              );
            if (rows.length === 0) break;
            for (const row of rows) {
              const count = yield* collectLaunch(row.id, epoch, totals);
              if (O.isNone(count)) return false;
              launchRows += count.value;
              launchAfter = row.id;
            }
          }
          yield* requireCount(launchRows, expectedRows);
          return true;
        });
        const verifyEnrolledOwnership = Effect.fnUntraced(function* (id: Sha256Hex, page: PageDisposition) {
          // Earlier dispositions remain readable, but cannot prove that
          // pending membership survived disposal. Preserve them for migration.
          if (page.enrolledOwnership === undefined) return yield* failure("configuration");
          const owned = yield* readEnrolledOwnership(id).pipe(Effect.provideService(SqlClient.SqlClient, sql));
          if (owned.count !== page.enrolledOwnership.count || owned.digest !== page.enrolledOwnership.digest)
            return yield* failure("storage");
        });
        const verifyUnenrolledOwnership = Effect.fnUntraced(function* (id: Sha256Hex, page: PageDisposition) {
          const missing = yield* readUnenrolledNativeOwnership(id).pipe(
            Effect.provideService(SqlClient.SqlClient, sql)
          );
          const summary = page.reason === "retention-expired" ? page.unenrolledNativeOwnership : undefined;
          if (missing.count !== (summary?.count ?? 0) || (summary !== undefined && summary.digest !== missing.digest))
            return yield* failure("storage");
          return missing.count;
        });
        const countPageOccurrences = Effect.fnUntraced(function* (
          id: Sha256Hex,
          page: PageDisposition,
          membershipCount: number,
          totals: ReturnType<typeof emptyTotals>
        ) {
          const receipt = yield* native.receipt(id);
          if (O.isSome(receipt)) {
            totals.nativeAcceptedOccurrences += receipt.value.accepted;
            totals.nativeRejectedOccurrences += receipt.value.rejected;
          } else {
            if (membershipCount > 0 && unenrolledReferenceCount(page) > 0) return yield* failure("storage");
            totals.transcriptFrameOccurrences += page.page.frames;
          }
        });
        const collectPage = Effect.fnUntraced(function* (
          id: Sha256Hex,
          epoch: number,
          totals: ReturnType<typeof emptyTotals>
        ) {
          const disposition = yield* base.readDisposition(id);
          if (O.isNone(disposition) || disposition.value.page.evidenceEpoch !== epoch) return yield* failure("storage");
          yield* verifyEnrolledOwnership(id, disposition.value);
          const memberships = yield* sql`SELECT events FROM observation_delivery_pages WHERE receipt_id=${id}`.pipe(
            Effect.flatMap(decodeEventsRecordRows)
          );
          const references = unenrolledReferenceCount(disposition.value);
          if (memberships.length === 0 && references <= 0) return yield* failure("storage");
          const missingCount = yield* verifyUnenrolledOwnership(id, disposition.value);
          totals.unenrolledNativeEvents += missingCount;
          totals.unenrolledReferences += references;
          totals.pages += 1;
          totals.payloadBytes += disposition.value.page.payloadBytes;
          if (disposition.value.reason === "backend-verified") totals.verifiedPages += 1;
          else totals.expiredPages += 1;
          yield* countPageOccurrences(id, disposition.value, memberships.length, totals);
        });
        const collectPageEvidence = Effect.fnUntraced(function* (
          epoch: number,
          totals: ReturnType<typeof emptyTotals>
        ) {
          yield* visitRetirementIds(
            (after) =>
              sql`SELECT receipt_id AS id FROM observation_page_dispositions WHERE receipt_id>${after} ORDER BY receipt_id LIMIT 32`.pipe(
                Effect.flatMap(decodeIdRecordRows)
              ),
            (id) => collectPage(id, epoch, totals)
          );
        });
        const collectEvent = Effect.fnUntraced(function* (id: Sha256Hex, totals: ReturnType<typeof emptyTotals>) {
          const state = yield* ledger.state(id);
          if (O.isNone(state)) return yield* failure("storage");
          totals.eventObservations += 1;
          totals[eventCountKey(state.value.state)] += 1;
        });
        const collectEventEvidence = Effect.fnUntraced(function* (totals: ReturnType<typeof emptyTotals>) {
          yield* visitRetirementIds(
            (after) =>
              sql`SELECT event_id AS id FROM observation_delivery_events WHERE event_id>${after} ORDER BY event_id LIMIT 32`.pipe(
                Effect.flatMap(decodeIdRecordRows)
              ),
            (id) => collectEvent(id, totals)
          );
        });
        const commitRetirement = Effect.fnUntraced(function* (
          current: EvidenceWindow,
          totals: ReturnType<typeof emptyTotals>,
          now: number
        ) {
          const snapshot = RetiredEvidenceTotals.make(totals);
          const cumulative = yield* S.decodeEffect(RetiredEvidenceTotals)(
            R.map(totals, (value, key) => value + (current.totals[key] ?? 0))
          );
          const record = EvidenceRetirement.make({
            epoch: current.epoch,
            openedAt: current.openedAt,
            closedAt: now,
            totals: snapshot,
            previousDigest: O.map(current.latest, (v) => v.digest),
          });
          const recordPayload = yield* encodeEvidenceRetirementJson(record);
          const digest = yield* hashPublicTextSha256(recordPayload);
          if (current.epoch >= Number.MAX_SAFE_INTEGER) return yield* failure("capacity");
          const next = EvidenceWindow.make({
            version: "evidence-window/v1",
            epoch: current.epoch + 1,
            openedAt: now,
            totals: cumulative,
            latest: O.some({ record, digest }),
          });
          const payload = yield* encodeEvidenceWindowJson(next);
          const windowDigest = yield* hashPublicTextSha256(payload);
          yield* recovery.capture(current, windowDigest, digest).pipe(Effect.mapError(recoveryFailure));
          yield* sql`DELETE FROM observation_launch_facts`;
          yield* sql`DELETE FROM observation_delivery_visibility`;
          yield* sql`DELETE FROM observation_delivery_results`;
          yield* sql`DELETE FROM observation_delivery_attempt_events`;
          yield* sql`DELETE FROM observation_delivery_attempts`;
          yield* sql`DELETE FROM observation_delivery_queries`;
          yield* sql`DELETE FROM observation_delivery_events`;
          yield* sql`DELETE FROM observation_delivery_pages`;
          yield* sql`DELETE FROM observation_native_events`;
          yield* sql`DELETE FROM observation_native_receipts`;
          yield* sql`DELETE FROM observation_page_dispositions`;
          yield* sql`UPDATE observation_evidence_window SET payload=${payload},digest=${windowDigest} WHERE singleton=1`;
          return next.latest;
        });
        const replaySeal = Effect.fnUntraced(function* (current: EvidenceWindow, expectedEpoch: number) {
          if (O.isSome(current.latest) && current.latest.value.record.epoch === expectedEpoch) return current.latest;
          return yield* failure("conflict");
        });
        const windowCannotRetire = Effect.fnUntraced(function* (current: EvidenceWindow, now: number) {
          if (now - current.openedAt < policy.minEpochMillis) return true;
          return (yield* base.stats).pages !== 0;
        });
        const checkWorkBounds = Effect.fnUntraced(function* (populations: ReadonlyArray<number>) {
          if (A.some(populations, (count) => count > policy.maxRecords)) return yield* failure("capacity");
        });
        const hasRecentSend = Effect.fnUntraced(function* (now: number) {
          const recent = yield* sql`SELECT MAX(recorded_at) AS latest FROM observation_delivery_attempts`.pipe(
            Effect.flatMap(decodeArguments2)
          );
          return recent[0].latest !== null && now - recent[0].latest < policy.minAttemptQuietMillis;
        });
        const verifyEvidenceLinks = Effect.fnUntraced(function* () {
          const orphan = yield* sql`SELECT (
           (SELECT count(*) FROM observation_delivery_pages p LEFT JOIN observation_page_dispositions d ON d.receipt_id=p.receipt_id WHERE d.receipt_id IS NULL) +
           (SELECT count(*) FROM observation_native_receipts r LEFT JOIN observation_page_dispositions d ON d.receipt_id=r.receipt_id WHERE d.receipt_id IS NULL) +
           (SELECT count(*) FROM observation_native_events n LEFT JOIN observation_native_receipts r ON r.receipt_id=n.receipt_id WHERE r.receipt_id IS NULL) +
           (SELECT count(*) FROM observation_native_events n LEFT JOIN observation_delivery_events e ON e.event_id=n.event_id WHERE e.event_id IS NOT NULL AND e.payload_hash!=n.payload_hash) +
           (SELECT count(*) FROM observation_delivery_attempt_events a LEFT JOIN observation_delivery_events e ON e.event_id=a.event_id WHERE e.event_id IS NULL) +
           (SELECT count(*) FROM observation_delivery_visibility v LEFT JOIN observation_delivery_events e ON e.event_id=v.event_id WHERE e.event_id IS NULL) +
           (SELECT count(*) FROM observation_delivery_queries q LEFT JOIN observation_delivery_events e ON e.event_id=q.event_id WHERE e.event_id IS NULL) +
           (SELECT count(*) FROM observation_native_events n JOIN observation_delivery_pages p ON p.receipt_id=n.receipt_id LEFT JOIN observation_delivery_events e ON e.event_id=n.event_id WHERE e.event_id IS NULL) +
           (SELECT count(*) FROM observation_delivery_attempts a WHERE NOT EXISTS(SELECT 1 FROM observation_delivery_attempt_events e WHERE e.attempt_id=a.attempt_id))
          ) AS n`.pipe(Effect.flatMap(S.decodeUnknownEffect(Count)));
          if (orphan[0].n !== 0) return yield* failure("storage");
        });
        const seal = Effect.fn("AiMetrics.evidence.seal")((expectedEpoch: number) =>
          safe(
            sql
              .withTransaction(
                Effect.gen(function* () {
                  yield* S.decodeEffect(S.Natural)(expectedEpoch);
                  const current = yield* base.evidenceWindow;
                  if (current.epoch !== expectedEpoch) return yield* replaySeal(current, expectedEpoch);
                  const now = yield* Clock.currentTimeMillis;
                  if (yield* windowCannotRetire(current, now))
                    return O.none<{ readonly record: EvidenceRetirement; readonly digest: Sha256Hex }>();
                  const pages = yield* sql`SELECT count(*) AS n FROM observation_page_dispositions`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(Count))
                  );
                  const launches = yield* sql`SELECT count(*) AS n FROM observation_launch_facts`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(Count))
                  );
                  if (pages[0].n === 0 && launches[0].n === 0)
                    return O.none<{ readonly record: EvidenceRetirement; readonly digest: Sha256Hex }>();
                  const events = yield* sql`SELECT count(*) AS n FROM observation_delivery_events`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(Count))
                  );
                  const attempts = yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(Count))
                  );
                  yield* checkWorkBounds([launches[0].n, pages[0].n, events[0].n, attempts[0].n]);
                  if (yield* hasRecentSend(now))
                    return O.none<{ readonly record: EvidenceRetirement; readonly digest: Sha256Hex }>();
                  yield* verifyEvidenceLinks();
                  const totals = emptyTotals();
                  if (!(yield* collectLaunchEvidence(current.epoch, totals, launches[0].n))) return O.none();
                  yield* collectPageEvidence(current.epoch, totals);
                  yield* collectEventEvidence(totals);
                  totals.attempts = attempts[0].n;
                  yield* requireCount(totals.pages, pages[0].n);
                  yield* requireCount(totals.eventObservations, events[0].n);
                  return yield* commitRetirement(current, totals, now);
                })
              )
              .pipe(
                Effect.timeoutOrElse({
                  duration: policy.deadlineMillis,
                  orElse: () => Effect.fail(failure("deadline")),
                })
              )
          )
        );
        const restore = Effect.fn("AiMetrics.evidence.restore")((expectedRetirementDigest: Sha256Hex) =>
          safe(
            sql
              .withTransaction(
                Effect.gen(function* () {
                  yield* S.decodeEffect(Sha256Hex)(expectedRetirementDigest);
                  return yield* recovery
                    .restore(expectedRetirementDigest, yield* base.evidenceWindow)
                    .pipe(Effect.mapError(recoveryFailure));
                })
              )
              .pipe(
                Effect.timeoutOrElse({
                  duration: policy.deadlineMillis,
                  orElse: () => Effect.fail(failure("deadline")),
                })
              )
          )
        );
        return { seal, restore, window: base.evidenceWindow };
      })
    )
);
