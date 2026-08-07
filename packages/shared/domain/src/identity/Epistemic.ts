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
 * **Example** (Log entity type)
 *
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
 * **Example** (Decode CandidateClaimId value)
 *
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
 * **Example** (Log entity type)
 *
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
 * **Example** (Decode EvidenceId value)
 *
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
 * **Example** (Log entity type)
 *
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
 * **Example** (Decode ActivityId value)
 *
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
 * **Example** (Log entity type)
 *
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
 * **Example** (Decode UsageRecordId value)
 *
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

/**
 * Bitemporal epistemic edge version entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.EdgeVersionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EdgeVersionId = make("edge_version", {
  description: "Identifier for a bitemporal epistemic edge version entity.",
});

/**
 * Runtime type for {@link EdgeVersionId}.
 *
 * **Example** (Decode EdgeVersionId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.EdgeVersionId = yield* S.decodeUnknownEffect(Epistemic.EdgeVersionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EdgeVersionId = typeof EdgeVersionId.Type;

/**
 * Durable claim disposition entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.ClaimDispositionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ClaimDispositionId = make("claim_disposition", {
  description: "Identifier for a durable claim disposition entity.",
});

/**
 * Runtime type for {@link ClaimDispositionId}.
 *
 * **Example** (Decode ClaimDispositionId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.ClaimDispositionId = yield* S.decodeUnknownEffect(Epistemic.ClaimDispositionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ClaimDispositionId = typeof ClaimDispositionId.Type;
