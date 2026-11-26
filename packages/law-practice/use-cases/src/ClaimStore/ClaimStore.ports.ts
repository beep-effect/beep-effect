/**
 * Claim store ports: the proposal log, partitioned by scope, and the
 * admission side, which no proposal path can reach.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GenerationFact } from "@beep/epistemics/Admission";
import { ClaimId } from "@beep/epistemics/ClaimCore";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import {
  LawAdmissionAction,
  LawPrincipalId,
  LawProposedClaimRecord,
  LawRevision,
  ScopeRef,
} from "@beep/law-practice-domain/values/LawClaim";
import { OccurrenceId } from "@beep/text/Occurrence";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type { TrustedClaimBinding } from "@beep/epistemics/Admission";
import type { LawAdmission } from "@beep/law-practice-domain/values/LawClaim";
import type { ActivityId } from "@beep/schema/ContentHash";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import type * as HashSet from "effect/HashSet";
import type * as O from "effect/Option";
import type { LawClaimStoreError } from "./ClaimStore.errors.ts";

const $I = $LawPracticeUseCasesId.create("ClaimStore/ClaimStore.ports");

/**
 * One proposal append: the proposed record, its generation fact, the
 * activity records that produced it and the capture identities they used.
 *
 * **Details**
 *
 * `captures` names the source text identity of every capture an activity
 * used, so a traversal can authorize each capture on its own scope.
 *
 * **Example** (Name the entry fields)
 *
 * ```ts
 * import { ProposedClaimEntry } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * console.log(Object.keys(ProposedClaimEntry.fields)) // ["record", "generation", "activities", "captures"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProposedClaimEntry extends S.Opaque<ProposedClaimEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    record: LawProposedClaimRecord,
    generation: GenerationFact,
    activities: S.HashSet(ActivityRecord),
    captures: S.HashSet(SourceTextIdentity),
  }).pipe(
    $I.annoteSchema("ProposedClaimEntry", {
      description: "A proposed record with its generation fact, producing activity records and the captures they used.",
    })
  )
) {}

/**
 * **Example** (Name the lookup fields)
 *
 * ```ts
 * import { ProposedClaimLookup } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * console.log(Object.keys(ProposedClaimLookup.fields).length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProposedClaimLookup extends S.Opaque<ProposedClaimLookup, { readonly brand: unique symbol }>()(
  S.Struct({
    scope: ScopeRef,
    logicalKey: S.String,
    supportAtCreation: S.HashSet(OccurrenceId),
  }).pipe(
    $I.annoteSchema("ProposedClaimLookup", {
      description: "The scope, logical key and creation support a proposal is found by.",
    })
  )
) {}

/**
 * The trusted action state an attorney opens before admitting one claim.
 *
 * **Example** (Name the binding fields)
 *
 * ```ts
 * import { AdmissionBinding } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * console.log(Object.keys(AdmissionBinding.fields).length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionBinding extends S.Opaque<AdmissionBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: ClaimId,
    actor: LawPrincipalId,
    action: LawAdmissionAction,
    revision: LawRevision,
    scope: ScopeRef,
  }).pipe(
    $I.annoteSchema("AdmissionBinding", {
      description: "The claim an authenticated principal opened for admission at one revision.",
    })
  )
) {}

/**
 * Service shape of the proposal side of the claim store.
 *
 * **Details**
 *
 * One claim log per scope. `withPartition` runs its body under that scope's
 * single permit and hands it the partition's last `knowledgeStart`, so a stamp
 * and the append that follows it never interleave with another proposal in
 * the same scope, and one scope never waits on another.
 *
 * **Example** (Name a proposal method)
 *
 * ```ts
 * import type { LawClaimProposalsShape } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * const method: keyof LawClaimProposalsShape = "withPartition"
 * console.log(method) // "withPartition"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface LawClaimProposalsShape {
  /** Every activity record stored with the claim's proposal. */
  readonly activities: (claim: ClaimId) => Effect.Effect<HashSet.HashSet<ActivityRecord>, LawClaimStoreError>;
  /** Append one proposal to its scope's log. */
  readonly appendProposed: (entry: ProposedClaimEntry) => Effect.Effect<void, LawClaimStoreError>;
  /** The capture identities stored with the claim's proposal. */
  readonly captures: (claim: ClaimId) => Effect.Effect<HashSet.HashSet<SourceTextIdentity>, LawClaimStoreError>;
  /** The proposal with this scope, logical key and creation support, if one is stored. */
  readonly findProposed: (
    lookup: ProposedClaimLookup
  ) => Effect.Effect<O.Option<LawProposedClaimRecord>, LawClaimStoreError>;
  /** The generation fact stored for the activity, if any. */
  readonly generation: (activity: ActivityId) => Effect.Effect<O.Option<GenerationFact>, LawClaimStoreError>;
  /** The stored proposal for the claim, if any. */
  readonly get: (claim: ClaimId) => Effect.Effect<O.Option<LawProposedClaimRecord>, LawClaimStoreError>;
  /** Run the body under the scope's one permit with the partition's last knowledge start. */
  readonly withPartition: <A, E, R>(
    scope: ScopeRef,
    body: (lastKnowledgeStart: O.Option<DateTime.Utc>) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | LawClaimStoreError, R>;
}

/**
 * The proposal side of the claim store.
 *
 * **Example** (Reference the proposal port)
 *
 * ```ts
 * import { LawClaimProposals } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * console.log(LawClaimProposals.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LawClaimProposals extends Context.Service<LawClaimProposals, LawClaimProposalsShape>()(
  $I`LawClaimProposals`
) {}

/**
 * Service shape of the admission side of the claim store.
 *
 * **Details**
 *
 * `binding` answers the trusted binding opened for an actor, action, revision
 * and scope, or `Unavailable` with reason `missing` when none was opened.
 *
 * **Example** (Name an admission method)
 *
 * ```ts
 * import type { LawClaimAdmissionsShape } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * const method: keyof LawClaimAdmissionsShape = "appendAdmission"
 * console.log(method) // "appendAdmission"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface LawClaimAdmissionsShape {
  /** Every admission stored for the claim, in append order. */
  readonly admissions: (claim: ClaimId) => Effect.Effect<ReadonlyArray<LawAdmission>, LawClaimStoreError>;
  /** Append one admission. */
  readonly appendAdmission: (admission: LawAdmission) => Effect.Effect<void, LawClaimStoreError>;
  /** The trusted binding opened for the request, or `Unavailable`. */
  readonly binding: (request: {
    readonly actor: LawPrincipalId;
    readonly action: LawAdmissionAction;
    readonly revision: LawRevision;
    readonly scope: ScopeRef;
  }) => Effect.Effect<TrustedClaimBinding, LawClaimStoreError>;
  /** Record the binding an authenticated principal opened. */
  readonly openAdmission: (binding: AdmissionBinding) => Effect.Effect<void, LawClaimStoreError>;
}

/**
 * The admission side of the claim store; provided to the admission layer only.
 *
 * **Example** (Reference the admission port)
 *
 * ```ts
 * import { LawClaimAdmissions } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * console.log(LawClaimAdmissions.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LawClaimAdmissions extends Context.Service<LawClaimAdmissions, LawClaimAdmissionsShape>()(
  $I`LawClaimAdmissions`
) {}
