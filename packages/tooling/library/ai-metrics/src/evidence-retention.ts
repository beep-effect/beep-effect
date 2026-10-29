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
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { makeDeliveryLedger } from "./delivery-ledger.ts";
import { EvidenceRetirement, EvidenceWindow, RetiredEvidenceTotals } from "./evidence-window.ts";
import { makeEvidenceRecovery } from "./internal/evidence-recovery.ts";
import { readEnrolledOwnership, readUnenrolledNativeOwnership } from "./internal/unenrolled-evidence.ts";
import { makeNativeIntakeJournal } from "./native-intake.ts";
import { makeObservationLaunchFacts, ObservationLaunchReceipt } from "./observation-launch-facts.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { makeTranscriptIntakeJournal } from "./transcript-intake.ts";
import type { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("evidence-retention");
/**
 * Explicit observation-window lifetime and bounded retirement work.
 * **Example** (Inspecting policy)
 * ```ts
 * import { EvidenceRetentionPolicy } from "@beep/repo-ai-metrics/evidence-retention"
 * console.log(typeof EvidenceRetentionPolicy.make)
 * ```
 * **Details** minEpochMillis is the minimum window duration, not a minimum age for every fact. Retirement requires every payload disposed and a quiet interval after sends. It erases per-event local detail, preserves aggregate uncertainty and source cursors, and ends that epoch's duplicate-detection guarantee. maxRecoveryRows and maxRecoveryBytes bound a single logical recovery generation (encoded row payload bytes; database overhead also remains under the journal page ceiling). No production policy is selected by this API.
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
const recoveryFailure = (error: unknown) =>
  failure(S.is(S.Literals(["capacity", "conflict"]))(error) ? error : "storage");
const Count = S.Tuple([S.Struct({ n: S.Natural })]);
/**
 * Retire a fully disposed epoch and preserve a bounded checksummed summary.
 * **Example** (Inspecting the service)
 * ```ts
 * import { makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention"
 * console.log(typeof makeEvidenceRetention)
 * ```
 * **Details** seal(expectedEpoch) is an atomic compare-and-swap. None means the epoch is empty, young, has retained payloads, or has recent send reservations. Exact replay of the latest successful seal returns its summary. Older/conflicting requests fail. Bounded pages of checksummed receipts and ledger states feed cumulative observation counts; overflow fails before deletion. A checksummed bounded recovery generation is copied before deletion in the same transaction. Copy failure preserves current facts and the previous generation. restore(retirementDigest) restores compact facts and the predecessor window only while the exact successor is empty and admission/attempt sequences are unchanged; it preserves source cursors. Exact replay returns already-restored. The next seal replaces the recovery generation. This is logical rollback, not an independent database/disaster backup. Deletion and epoch advancement commit together. Earlier details cannot be reconstructed from the summary alone; current-window absence is not lifetime absence. Source files, cursors and held services are untouched.
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
        const encodedPolicy = yield* S.encodeEffect(S.fromJsonString(EvidenceRetentionPolicy))(policy);
        yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`CREATE TABLE IF NOT EXISTS observation_evidence_policy(singleton INTEGER PRIMARY KEY CHECK(singleton=1),payload TEXT NOT NULL)`;
            yield* sql`INSERT OR IGNORE INTO observation_evidence_policy(singleton,payload) VALUES(1,${encodedPolicy})`;
            const rows =
              yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_evidence_policy WHERE singleton=1`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })])))
              );
            if (rows[0].payload !== encodedPolicy) return yield* failure("configuration");
          })
        );
        const recovery = yield* makeEvidenceRecovery(policy.maxRecoveryRows, policy.maxRecoveryBytes);
        const seal = Effect.fn("AiMetrics.evidence.seal")((expectedEpoch: number) =>
          safe(
            sql
              .withTransaction(
                Effect.gen(function* () {
                  yield* S.decodeEffect(S.Natural)(expectedEpoch);
                  const current = yield* base.evidenceWindow;
                  if (current.epoch !== expectedEpoch) {
                    if (O.isSome(current.latest) && current.latest.value.record.epoch === expectedEpoch)
                      return current.latest;
                    return yield* failure("conflict");
                  }
                  const now = yield* Clock.currentTimeMillis;
                  if (now - current.openedAt < policy.minEpochMillis || (yield* base.stats).pages !== 0)
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
                  if (
                    launches[0].n > policy.maxRecords ||
                    pages[0].n > policy.maxRecords ||
                    events[0].n > policy.maxRecords ||
                    attempts[0].n > policy.maxRecords
                  )
                    return yield* failure("capacity");
                  const recent = yield* sql`SELECT MAX(recorded_at) AS latest FROM observation_delivery_attempts`.pipe(
                    Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ latest: S.NullOr(S.Natural) })])))
                  );
                  if (recent[0].latest !== null && now - recent[0].latest < policy.minAttemptQuietMillis)
                    return O.none<{ readonly record: EvidenceRetirement; readonly digest: Sha256Hex }>();
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
                  const totals = { ...R.map(RetiredEvidenceTotals.fields, () => 0) };
                  let launchAfter = "";
                  let launchRows = 0;
                  while (true) {
                    const rows =
                      yield* sql`SELECT launch_id AS id FROM observation_launch_facts WHERE phase=0 AND launch_id>${launchAfter} ORDER BY launch_id LIMIT 32`.pipe(
                        Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ id: Sha256Hex }))))
                      );
                    if (rows.length === 0) break;
                    for (const row of rows) {
                      const facts = yield* launchFacts.read(row.id, current.epoch);
                      if (!A.some(facts, (fact) => fact.fact._tag === "Finished"))
                        return O.none<{ readonly record: EvidenceRetirement; readonly digest: Sha256Hex }>();
                      for (const receipt of facts) {
                        launchRows += 1;
                        switch (receipt.fact._tag) {
                          case "Prepared":
                            totals.launchPreparations += 1;
                            break;
                          case "Started":
                            totals.launchStarts += 1;
                            break;
                          case "SessionBound":
                            totals.launchSessionBindings += 1;
                            break;
                          case "Finished":
                            totals.launchFinishes += 1;
                            break;
                        }
                        const encoded = yield* S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt))(receipt);
                        totals.launchPayloadBytes += new TextEncoder().encode(encoded).byteLength;
                      }
                      launchAfter = row.id;
                    }
                  }
                  if (launchRows !== launches[0].n) return yield* failure("storage");
                  let after = "";
                  while (true) {
                    const rows =
                      yield* sql`SELECT receipt_id AS id FROM observation_page_dispositions WHERE receipt_id>${after} ORDER BY receipt_id LIMIT 32`.pipe(
                        Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ id: Sha256Hex }))))
                      );
                    if (rows.length === 0) break;
                    for (const row of rows) {
                      const disposition = yield* base.readDisposition(row.id);
                      if (O.isNone(disposition) || disposition.value.page.evidenceEpoch !== current.epoch)
                        return yield* failure("storage");
                      // Earlier dispositions remain readable, but cannot prove that
                      // pending membership survived disposal. Preserve them for migration.
                      if (disposition.value.enrolledOwnership === undefined) return yield* failure("configuration");
                      const owned = yield* readEnrolledOwnership(row.id).pipe(
                        Effect.provideService(SqlClient.SqlClient, sql)
                      );
                      if (
                        owned.count !== disposition.value.enrolledOwnership.count ||
                        owned.digest !== disposition.value.enrolledOwnership.digest
                      )
                        return yield* failure("storage");
                      const memberships =
                        yield* sql`SELECT events FROM observation_delivery_pages WHERE receipt_id=${row.id}`.pipe(
                          Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ events: S.Natural }))))
                        );
                      const expired =
                        disposition.value.reason === "retention-expired" ? O.some(disposition.value) : O.none();
                      if (
                        memberships.length === 0 &&
                        !(O.isSome(expired) && (expired.value.unenrolledReferences ?? 0) > 0)
                      )
                        return yield* failure("storage");
                      const missing = yield* readUnenrolledNativeOwnership(row.id).pipe(
                        Effect.provideService(SqlClient.SqlClient, sql)
                      );
                      const summary = O.isSome(expired) ? expired.value.unenrolledNativeOwnership : undefined;
                      if (
                        missing.count !== (summary?.count ?? 0) ||
                        (summary !== undefined && summary.digest !== missing.digest)
                      )
                        return yield* failure("storage");
                      totals.unenrolledNativeEvents += missing.count;
                      totals.unenrolledReferences += O.isSome(expired) ? (expired.value.unenrolledReferences ?? 0) : 0;
                      totals.pages += 1;
                      totals.payloadBytes += disposition.value.page.payloadBytes;
                      if (disposition.value.reason === "backend-verified") totals.verifiedPages += 1;
                      else totals.expiredPages += 1;
                      const receipt = yield* native.receipt(row.id);
                      if (O.isSome(receipt)) {
                        totals.nativeAcceptedOccurrences += receipt.value.accepted;
                        totals.nativeRejectedOccurrences += receipt.value.rejected;
                      } else {
                        if (
                          memberships.length > 0 &&
                          O.isSome(expired) &&
                          (expired.value.unenrolledReferences ?? 0) > 0
                        )
                          return yield* failure("storage");
                        totals.transcriptFrameOccurrences += disposition.value.page.frames;
                      }
                      after = row.id;
                    }
                  }
                  after = "";
                  while (true) {
                    const rows =
                      yield* sql`SELECT event_id AS id FROM observation_delivery_events WHERE event_id>${after} ORDER BY event_id LIMIT 32`.pipe(
                        Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ id: Sha256Hex }))))
                      );
                    if (rows.length === 0) break;
                    for (const row of rows) {
                      const state = yield* ledger.state(row.id);
                      if (O.isNone(state)) return yield* failure("storage");
                      totals.eventObservations += 1;
                      switch (state.value.state) {
                        case "pending":
                          totals.pending += 1;
                          break;
                        case "accepted-unverified":
                          totals.acceptedUnverified += 1;
                          break;
                        case "visible":
                          totals.visible += 1;
                          break;
                        case "rejected":
                          totals.rejected += 1;
                          break;
                        case "unresolved":
                          totals.unresolved += 1;
                          break;
                      }
                      after = row.id;
                    }
                  }
                  totals.attempts = attempts[0].n;
                  if (totals.pages !== pages[0].n || totals.eventObservations !== events[0].n)
                    return yield* failure("storage");
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
                  const recordPayload = yield* S.encodeEffect(S.fromJsonString(EvidenceRetirement))(record);
                  const digest = yield* hashPublicTextSha256(recordPayload);
                  if (current.epoch >= Number.MAX_SAFE_INTEGER) return yield* failure("capacity");
                  const next = EvidenceWindow.make({
                    version: "evidence-window/v1",
                    epoch: current.epoch + 1,
                    openedAt: now,
                    totals: cumulative,
                    latest: O.some({ record, digest }),
                  });
                  const payload = yield* S.encodeEffect(S.fromJsonString(EvidenceWindow))(next);
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
