/**
 * Epistemic slice entity-id registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntityId from "../entity/EntityId.ts";

const $I = $EpistemicDomainId.create("identity/Epistemic");
const make = EntityId.factory("epistemic", $I);

/**
 * Candidate claim entity identifier.
 *
 * @example
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.CandidateClaimId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateClaimId = make("candidate_claim", {
  description: "Identifier for a candidate claim entity.",
});

/**
 * Runtime type for {@link CandidateClaimId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.CandidateClaimId = yield* S.decodeUnknownEffect(Epistemic.CandidateClaimId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateClaimId = typeof CandidateClaimId.Type;

/**
 * Evidence entity identifier.
 *
 * @example
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.EvidenceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EvidenceId = make("evidence", {
  description: "Identifier for an evidence entity.",
});

/**
 * Runtime type for {@link EvidenceId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.EvidenceId = yield* S.decodeUnknownEffect(Epistemic.EvidenceId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EvidenceId = typeof EvidenceId.Type;

/**
 * Activity entity identifier.
 *
 * @example
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.ActivityId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ActivityId = make("activity", {
  description: "Identifier for a provenance activity entity.",
});

/**
 * Runtime type for {@link ActivityId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.ActivityId = yield* S.decodeUnknownEffect(Epistemic.ActivityId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ActivityId = typeof ActivityId.Type;

/**
 * Usage record entity identifier.
 *
 * @example
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.UsageRecordId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const UsageRecordId = make("usage_record", {
  description: "Identifier for a usage attribution record entity.",
});

/**
 * Runtime type for {@link UsageRecordId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.UsageRecordId = yield* S.decodeUnknownEffect(Epistemic.UsageRecordId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type UsageRecordId = typeof UsageRecordId.Type;
