/**
 * Memory-backed append-only party claim ledger.
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimVersion } from "@beep/party-domain/Claim";
import { LedgerConflict, LedgerSnapshot, PartyLedger } from "@beep/party-use-cases/Ledger";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as SynchronizedRef from "effect/SynchronizedRef";
import * as Tuple from "effect/Tuple";
import type { SourceAssertion } from "@beep/party-domain/Claim";
import type { Observation } from "@beep/party-domain/Communication";
import type { PartyKey } from "@beep/party-domain/PartyKey";

/**
 * Isolated in-memory ledger with atomic writes and derived expiration bounds.
 *
 * **Details**
 * Each evidence batch validates before one atomic state replacement. A successor
 * must name a current version at a later knowledge
 * time. Expiration is computed on reads; no previously appended row is modified.
 *
 * **Example** (Allocate an identity)
 * ```ts
 * import { PartyLedgerMemory } from "@beep/party-server/Ledger"
 * import { PartyLedger } from "@beep/party-use-cases/Ledger"
 * import * as Effect from "effect/Effect"
 * const allocated = Effect.gen(function* () { return yield* (yield* PartyLedger).allocatePartyId }).pipe(Effect.provide(PartyLedgerMemory))
 * ```
 * @category layers
 * @since 0.0.0
 */
export const PartyLedgerMemory = Layer.effect(
  PartyLedger,
  Effect.gen(function* () {
    const rows = yield* SynchronizedRef.make(LedgerSnapshot.make({ observations: [], assertions: [], versions: [] }));
    const nextId = yield* Ref.make(1);
    const anchors = yield* SynchronizedRef.make(HashMap.empty<PartyKey, PartyId>());
    const allocatePartyId = Ref.getAndUpdate(nextId, (id) => id + 1).pipe(Effect.map(PartyId.make));
    const allocateAnchorParty = Effect.fn("PartyLedgerMemory.allocateAnchorParty")((key: PartyKey) =>
      SynchronizedRef.modifyEffect(anchors, (current) =>
        Effect.gen(function* () {
          const existing = HashMap.get(current, key);
          if (O.isSome(existing)) return Tuple.make(existing.value, current);
          const party = yield* allocatePartyId;
          return Tuple.make(party, HashMap.set(current, key, party));
        })
      )
    );
    const appendEvidence = Effect.fn("PartyLedgerMemory.appendEvidence")(function* (batch: LedgerSnapshot) {
      yield* SynchronizedRef.updateEffect(rows, (current) =>
        Effect.gen(function* () {
          let observations = current.observations;
          let assertions = current.assertions;
          let versions = current.versions;
          const fail = (recordId: string, reason: string) => Effect.fail(LedgerConflict.make({ recordId, reason }));
          for (const observation of batch.observations) {
            if (A.some(observations, (row) => row.id === observation.id))
              return yield* fail(observation.id, "duplicate-observation");
            observations = A.append(observations, observation);
          }
          for (const assertion of batch.assertions) {
            if (A.some(assertions, (row) => row.id === assertion.id))
              return yield* fail(assertion.id, "duplicate-assertion");
            assertions = A.append(assertions, assertion);
          }
          for (const version of batch.versions) {
            if (A.some(versions, (row) => row.id === version.id)) return yield* fail(version.id, "duplicate-version");
            if (O.isSome(version.knowledge.expiredAt)) return yield* fail(version.id, "new-version-already-expired");
            if (O.isSome(version.supersedes)) {
              const predecessorId = version.supersedes.value;
              const previous = A.findFirst(versions, (row) => row.id === predecessorId);
              if (O.isNone(previous)) return yield* fail(version.id, "unknown-predecessor");
              if (A.some(versions, (row) => O.contains(row.supersedes, predecessorId)))
                return yield* fail(version.id, "predecessor-already-superseded");
              if (!DateTime.isGreaterThan(version.knowledge.recordedAt, previous.value.knowledge.recordedAt))
                return yield* fail(version.id, "non-increasing-knowledge-time");
            }
            versions = A.append(versions, version);
          }
          return LedgerSnapshot.make({ observations, assertions, versions });
        })
      );
    });
    return PartyLedger.of({
      allocatePartyId,
      allocateAnchorParty,
      appendEvidence,
      append: Effect.fn("PartyLedgerMemory.append")((version: ClaimVersion) =>
        appendEvidence(LedgerSnapshot.make({ observations: [], assertions: [], versions: [version] }))
      ),
      recordObservation: Effect.fn("PartyLedgerMemory.recordObservation")((observation: Observation) =>
        appendEvidence(LedgerSnapshot.make({ observations: [observation], assertions: [], versions: [] }))
      ),
      recordAssertion: Effect.fn("PartyLedgerMemory.recordAssertion")((assertion: SourceAssertion) =>
        appendEvidence(LedgerSnapshot.make({ observations: [], assertions: [assertion], versions: [] }))
      ),
      snapshot: SynchronizedRef.get(rows).pipe(
        Effect.map((current) =>
          LedgerSnapshot.make({
            ...current,
            versions: A.map(current.versions, (version) => {
              const successor = A.findFirst(current.versions, (row) => O.contains(row.supersedes, version.id));
              return O.match(successor, {
                onNone: () => version,
                onSome: (next) =>
                  ClaimVersion.make({
                    ...version,
                    knowledge: { ...version.knowledge, expiredAt: O.some(next.knowledge.recordedAt) },
                  }),
              });
            }),
          })
        )
      ),
    });
  })
);
