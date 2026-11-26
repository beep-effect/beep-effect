/**
 * The in-memory law claim store: proposals partitioned by capture scope and
 * the admission bindings and records opened over them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TrustedClaimBinding } from "@beep/epistemics/Admission";
import { LawClaimAdmissions, LawClaimProposals, LawClaimStoreError } from "@beep/law-practice-use-cases/ClaimStore";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";
import type { ClaimId } from "@beep/epistemics/ClaimCore";
import type { LawAdmission, ScopeRef } from "@beep/law-practice-domain/values/LawClaim";
import type {
  AdmissionBinding,
  LawClaimAdmissionsShape,
  LawClaimProposalsShape,
  ProposedClaimEntry,
} from "@beep/law-practice-use-cases/ClaimStore";

/**
 * Span attribute naming the claim store operation a span records.
 *
 * **Example** (Name the store operation span attribute)
 *
 * ```ts
 * import { LawClaimStoreOperationAttribute } from "@beep/law-practice-server/ClaimStore"
 *
 * console.log(LawClaimStoreOperationAttribute) // "beep.law_practice.claim_store_operation"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LawClaimStoreOperationAttribute = "beep.law_practice.claim_store_operation";

const latestOf = (latest: O.Option<DateTime.Utc>, at: DateTime.Utc): O.Option<DateTime.Utc> =>
  O.some(O.match(latest, { onNone: () => at, onSome: DateTime.max(at) }));

const makeMemoryLawClaimStore = Effect.fnUntraced(function* () {
  const entries = yield* Ref.make(HashMap.empty<ClaimId, ProposedClaimEntry>());
  const partitions = yield* Ref.make(HashMap.empty<ScopeRef, Semaphore.Semaphore>());
  const bindings = yield* Ref.make<ReadonlyArray<AdmissionBinding>>([]);
  const admitted = yield* Ref.make<ReadonlyArray<LawAdmission>>([]);
  const storedEntries = Effect.map(Ref.get(entries), (map) => map.pipe(HashMap.values, A.fromIterable));
  const permitOf = (scope: ScopeRef) =>
    Ref.modify(partitions, (map) =>
      O.match(HashMap.get(map, scope), {
        onNone: () => {
          const permit = Semaphore.makeUnsafe(1);
          return [permit, HashMap.set(map, scope, permit)] as const;
        },
        onSome: (permit) => [permit, map] as const,
      })
    );
  const proposals = LawClaimProposals.of({
    activities: Effect.fn("LawClaimStore.activities")(function* (claim: ClaimId) {
      const map = yield* Ref.get(entries);
      return O.match(HashMap.get(map, claim), { onNone: HashSet.empty, onSome: (entry) => entry.activities });
    }),
    captures: Effect.fn("LawClaimStore.captures")(function* (claim: ClaimId) {
      const map = yield* Ref.get(entries);
      return O.match(HashMap.get(map, claim), { onNone: HashSet.empty, onSome: (entry) => entry.captures });
    }),
    appendProposed: Effect.fn("LawClaimStore.appendProposed")(function* (entry: ProposedClaimEntry) {
      yield* Effect.annotateCurrentSpan(LawClaimStoreOperationAttribute, "append-proposed");
      const conflictsWithStoredGeneration = yield* Ref.modify(entries, (map) =>
        O.match(HashMap.get(map, entry.record.claim), {
          onNone: () => [false, HashMap.set(map, entry.record.claim, entry)] as const,
          onSome: (stored) =>
            Bool.match(Eq.equals(stored.generation.activity, entry.generation.activity), {
              onFalse: () => [true, map] as const,
              onTrue: () => [false, HashMap.set(map, entry.record.claim, entry)] as const,
            }),
        })
      );
      if (conflictsWithStoredGeneration) return yield* LawClaimStoreError.make({ operation: "append-proposed" });
    }),
    findProposed: Effect.fn("LawClaimStore.findProposed")(function* (lookup) {
      const stored = yield* storedEntries;
      return pipe(
        stored,
        A.findFirst(
          (entry) =>
            Eq.equals(entry.record.core.scope, lookup.scope) &&
            Eq.equals(entry.record.core.logicalKey, lookup.logicalKey) &&
            Eq.equals(entry.record.core.supportAtCreation, lookup.supportAtCreation)
        ),
        O.map((entry) => entry.record)
      );
    }),
    generation: Effect.fn("LawClaimStore.generation")(function* (activity) {
      const stored = yield* storedEntries;
      return pipe(
        stored,
        A.findFirst((entry) => Eq.equals(entry.generation.activity, activity)),
        O.map((entry) => entry.generation)
      );
    }),
    get: Effect.fn("LawClaimStore.get")(function* (claim: ClaimId) {
      const map = yield* Ref.get(entries);
      return O.map(HashMap.get(map, claim), (entry) => entry.record);
    }),
    withPartition: (scope, body) =>
      Effect.flatMap(permitOf(scope), (permit) =>
        Semaphore.withPermits(
          permit,
          1,
          Effect.flatMap(storedEntries, (stored) =>
            body(
              pipe(
                stored,
                A.filter((entry) => Eq.equals(entry.record.core.scope, scope)),
                A.map((entry) => entry.record.core.knowledgeStart),
                A.reduce(O.none<DateTime.Utc>(), latestOf)
              )
            )
          )
        )
      ),
  } satisfies LawClaimProposalsShape);
  const admissions = LawClaimAdmissions.of({
    admissions: Effect.fn("LawClaimStore.admissions")(function* (claim: ClaimId) {
      const stored = yield* Ref.get(admitted);
      return A.filter(stored, (admission) => Eq.equals(admission.claim, claim));
    }),
    appendAdmission: Effect.fn("LawClaimStore.appendAdmission")(function* (admission: LawAdmission) {
      yield* Effect.annotateCurrentSpan(LawClaimStoreOperationAttribute, "append-admission");
      yield* Ref.update(admitted, A.append(admission));
    }),
    binding: Effect.fn("LawClaimStore.binding")(function* (request) {
      const opened = yield* Ref.get(bindings);
      return pipe(
        opened,
        A.findLast(
          (binding) =>
            Eq.equals(binding.actor, request.actor) &&
            Eq.equals(binding.action, request.action) &&
            Eq.equals(binding.revision, request.revision) &&
            Eq.equals(binding.scope, request.scope)
        ),
        O.match({
          onNone: () => TrustedClaimBinding.cases.Unavailable.make({ reason: "missing" }),
          onSome: (binding) =>
            TrustedClaimBinding.cases.Claim.make({ claim: binding.claim, clearsRetraction: O.none() }),
        })
      );
    }),
    openAdmission: Effect.fn("LawClaimStore.openAdmission")(function* (binding: AdmissionBinding) {
      yield* Effect.annotateCurrentSpan(LawClaimStoreOperationAttribute, "open-admission");
      yield* Ref.update(bindings, A.append(binding));
    }),
  } satisfies LawClaimAdmissionsShape);
  return Context.make(LawClaimProposals, proposals).pipe(Context.add(LawClaimAdmissions, admissions));
});

/**
 * The in-memory law claim store.
 *
 * **Details**
 *
 * Each capture scope is one partition with one permit: `withPartition` runs
 * its body under that permit with the latest knowledge start stored in the
 * scope, so two proposals in one scope never interleave. Re-appending a claim
 * from another generating activity fails with `append-proposed`. `binding`
 * answers the latest binding opened for the actor, action, revision and scope,
 * or `Unavailable` with reason `missing`.
 *
 * **Example** (Provide the memory store)
 *
 * ```ts
 * import { LawClaimStoreMemory } from "@beep/law-practice-server/ClaimStore"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(LawClaimStoreMemory)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LawClaimStoreMemory: Layer.Layer<LawClaimProposals | LawClaimAdmissions> = Layer.effectContext(
  makeMemoryLawClaimStore()
);
