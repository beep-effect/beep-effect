/**
 * Atomic in-memory storage for source evidence and independently checked claim records.
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { $PartyServerId } from "@beep/identity/packages";
import { mintActivityId } from "@beep/jsonc/ActivityStart";
import {
  ClaimAdmission,
  ClaimChallenge,
  ClaimCore,
  ClaimEvidenceLinks,
  ClaimGeneration,
  ClaimRecord,
  ClaimRetraction,
  ClaimReviewRecord,
  ClaimSignalRecord,
  ClaimStance,
  claimLog,
  SourceAssertion,
} from "@beep/party-domain/Claim";
import { Observation } from "@beep/party-domain/Communication";
import { LedgerConflict, LedgerSnapshot, PartyLedger } from "@beep/party-use-cases/Ledger";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as SynchronizedRef from "effect/SynchronizedRef";
import * as Tuple from "effect/Tuple";
import type { ClaimLedger } from "@beep/party-domain/Claim";
import type { PartyKey } from "@beep/party-domain/PartyKey";
import type * as Equivalence from "effect/Equivalence";

const arrows = makeClaimArrows({ $I: $PartyServerId.create("values/Ledger/Ledger.memory"), ClaimCore });
const sameClaim = S.toEquivalence(ClaimRecord);
const sameGeneration = S.toEquivalence(ClaimGeneration);
const sameAssertion = S.toEquivalence(SourceAssertion);
const sameObservation = S.toEquivalence(Observation);
const sameEvidence = S.toEquivalence(ClaimEvidenceLinks);
const sameReview = S.toEquivalence(ClaimReviewRecord);
const sameSignal = S.toEquivalence(ClaimSignalRecord);
const sameChallenge = S.toEquivalence(ClaimChallenge);
const sameRetraction = S.toEquivalence(ClaimRetraction);
const sameAdmission = S.toEquivalence(ClaimAdmission);
const sameStance = S.toEquivalence(ClaimStance);
const conflict = (recordId: string, reason: string) => LedgerConflict.make({ recordId, reason });
const byId = (row: { readonly id: string }) => row.id;
const byClaim = (row: { readonly claim: string }) => row.claim;
const timedKey = (row: { readonly claim: string; readonly at: DateTime.Utc }) =>
  `${row.claim}:${DateTime.toEpochMillis(row.at)}`;

const appendRows = Effect.fn("PartyLedgerMemory.appendRows")(function* <R>(
  current: ReadonlyArray<R>,
  incoming: ReadonlyArray<R>,
  key: (row: R) => string,
  same: Equivalence.Equivalence<R>,
  reason: string
) {
  let rows = current;
  for (const row of incoming) {
    const existing = A.findFirst(rows, (value) => key(value) === key(row));
    if (O.isSome(existing)) {
      if (!same(existing.value, row)) return yield* conflict(key(row), reason);
    } else rows = A.append(rows, row);
  }
  return rows;
});

const appendClaims = Effect.fn("PartyLedgerMemory.appendClaims")(function* (
  current: LedgerSnapshot,
  batch: LedgerSnapshot
) {
  let log = claimLog(current);
  let claims = current.claims;
  for (const record of batch.claims) {
    yield* arrows.encodeClaimRecord(record).pipe(Effect.mapError(() => conflict(record.claim, "invalid-core")));
    const generations = A.filter(batch.generations, (row) => Eq.equals(row.claim, record.claim));
    if (!A.isReadonlyArrayNonEmpty(generations) || A.length(generations) !== 1)
      return yield* conflict(record.claim, "generation-required");
    const generation = A.headNonEmpty(generations);
    if (!DateTime.isLessThanOrEqualTo(generation.activity.started, generation.ended))
      return yield* conflict(record.claim, "generation-order");
    const activity = yield* mintActivityId(generation.activity).pipe(
      Effect.mapError(() => conflict(record.claim, "invalid-generation"))
    );
    if (!Eq.equals(activity, record.core.generatedBy)) return yield* conflict(record.claim, "generation-mismatch");
    const existing = A.findFirst(claims, (row) => Eq.equals(row.claim, record.claim));
    if (O.isSome(existing)) {
      if (!sameClaim(existing.value, record)) return yield* conflict(record.claim, "conflicting-core");
    } else {
      const appended = yield* arrows
        .appendClaim(log, record, { activity, at: generation.ended })
        .pipe(Effect.mapError(() => conflict(record.claim, "invalid-core")));
      if (appended._tag === "Refused") return yield* conflict(record.claim, A.headNonEmpty(appended.violations)._tag);
      log = appended.log;
      claims = A.append(claims, record);
    }
  }
  return claims;
});

const applyBatch = Effect.fn("PartyLedgerMemory.applyBatch")(function* (
  current: LedgerSnapshot,
  batch: LedgerSnapshot
) {
  const claims = yield* appendClaims(current, batch);
  for (const row of [
    ...batch.generations,
    ...batch.evidence,
    ...batch.reviews,
    ...batch.signals,
    ...batch.retractions,
    ...batch.admissions,
    ...batch.stances,
    ...A.flatMap(batch.challenges, (row) => [{ claim: row.from }, { claim: row.to }]),
  ]) {
    if (!A.some(claims, (record) => Eq.equals(record.claim, row.claim)))
      return yield* conflict(row.claim, "unknown-claim");
  }
  const observations = yield* appendRows(
    current.observations,
    batch.observations,
    byId,
    sameObservation,
    "conflicting-observation"
  );
  const assertions = yield* appendRows(
    current.assertions,
    batch.assertions,
    byId,
    sameAssertion,
    "conflicting-assertion"
  );
  const generations = yield* appendRows(
    current.generations,
    batch.generations,
    byClaim,
    sameGeneration,
    "conflicting-generation"
  );
  const evidence = yield* appendRows(current.evidence, batch.evidence, timedKey, sameEvidence, "conflicting-evidence");
  const reviews = yield* appendRows(current.reviews, batch.reviews, timedKey, sameReview, "conflicting-review");
  const signals = yield* appendRows(current.signals, batch.signals, timedKey, sameSignal, "conflicting-signals");
  const retractions = yield* appendRows(
    current.retractions,
    batch.retractions,
    timedKey,
    sameRetraction,
    "conflicting-retraction"
  );
  const admissions = yield* appendRows(
    current.admissions,
    batch.admissions,
    timedKey,
    sameAdmission,
    "conflicting-admission"
  );
  const stances = yield* appendRows(current.stances, batch.stances, timedKey, sameStance, "conflicting-stance");
  const challenges = A.appendAll(
    current.challenges,
    A.filter(batch.challenges, (row) => !A.some(current.challenges, (existing) => sameChallenge(existing, row)))
  );
  return LedgerSnapshot.make({
    observations,
    assertions,
    claims,
    generations,
    evidence,
    reviews,
    signals,
    challenges,
    retractions,
    admissions,
    stances,
  });
});

/**
 * Capture hashing infrastructure once and reject a whole batch before replacing ledger state.
 *
 * **Example** (Supply digest infrastructure at composition)
 *
 * ```ts
 * import { PartyLedgerMemory } from "@beep/party-server/Ledger"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Layer from "effect/Layer"
 * const ledger = PartyLedgerMemory.pipe(Layer.provide(Digest.layerWebCrypto))
 * console.log(ledger)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PartyLedgerMemory = Layer.effect(
  PartyLedger,
  Effect.gen(function* () {
    const digest = yield* Digest.Digest;
    const rows = yield* SynchronizedRef.make(LedgerSnapshot.make({ observations: [], assertions: [] }));
    const nextId = yield* Ref.make(1);
    const anchors = yield* SynchronizedRef.make(HashMap.empty<PartyKey, PartyId>());
    const allocatePartyId = Ref.getAndUpdate(nextId, (id) => id + 1).pipe(Effect.map(PartyId.make));
    const allocateAnchorParty = Effect.fn("PartyLedgerMemory.allocateAnchorParty")((key: PartyKey) =>
      SynchronizedRef.modifyEffect(
        anchors,
        Effect.fnUntraced(function* (current: HashMap.HashMap<PartyKey, PartyId>) {
          const existing = HashMap.get(current, key);
          if (O.isSome(existing)) return Tuple.make(existing.value, current);
          const party = yield* allocatePartyId;
          return Tuple.make(party, HashMap.set(current, key, party));
        })
      )
    );
    const appendEvidence = Effect.fn("PartyLedgerMemory.appendEvidence")((batch: LedgerSnapshot) =>
      SynchronizedRef.updateEffect(rows, (current) => applyBatch(current, batch)).pipe(
        Effect.provideService(Digest.Digest, digest)
      )
    );
    return PartyLedger.of({
      allocatePartyId,
      allocateAnchorParty,
      appendEvidence,
      append: Effect.fn("PartyLedgerMemory.append")((batch: ClaimLedger) =>
        appendEvidence(LedgerSnapshot.make({ ...batch, observations: [], assertions: [] }))
      ),
      recordObservation: Effect.fn("PartyLedgerMemory.recordObservation")((observation: Observation) =>
        appendEvidence(LedgerSnapshot.make({ observations: [observation], assertions: [] }))
      ),
      recordAssertion: Effect.fn("PartyLedgerMemory.recordAssertion")((assertion: SourceAssertion) =>
        appendEvidence(LedgerSnapshot.make({ observations: [], assertions: [assertion] }))
      ),
      snapshot: SynchronizedRef.get(rows),
    });
  })
);
