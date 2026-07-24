/**
 * Law-practice slice entity-id registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntityId from "../entity/EntityId.ts";

const $I = $LawPracticeDomainId.create("identity/LawPractice");
const make = EntityId.factory("law_practice", $I);

/**
 * Legal client entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalClientId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LegalClientId = make("legal_client", {
  description: "Identifier for a law-practice legal client entity.",
});

/**
 * Runtime type for {@link LegalClientId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.LegalClientId = yield* S.decodeUnknownEffect(LawPractice.LegalClientId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalClientId = typeof LegalClientId.Type;

/**
 * Legal contact entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalContactId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LegalContactId = make("legal_contact", {
  description: "Identifier for a law-practice legal contact entity.",
});

/**
 * Runtime type for {@link LegalContactId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.LegalContactId = yield* S.decodeUnknownEffect(LawPractice.LegalContactId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalContactId = typeof LegalContactId.Type;

/**
 * Matter entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.MatterId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const MatterId = make("matter", {
  description: "Identifier for a law-practice matter entity.",
});

/**
 * Runtime type for {@link MatterId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.MatterId = yield* S.decodeUnknownEffect(LawPractice.MatterId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type MatterId = typeof MatterId.Type;

/**
 * Patent asset entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PatentAssetId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PatentAssetId = make("patent_asset", {
  description: "Identifier for a law-practice patent asset entity.",
});

/**
 * Runtime type for {@link PatentAssetId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.PatentAssetId = yield* S.decodeUnknownEffect(LawPractice.PatentAssetId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type PatentAssetId = typeof PatentAssetId.Type;

/**
 * Office action entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.OfficeActionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const OfficeActionId = make("office_action", {
  description: "Identifier for a law-practice office action entity.",
});

/**
 * Runtime type for {@link OfficeActionId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.OfficeActionId = yield* S.decodeUnknownEffect(LawPractice.OfficeActionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type OfficeActionId = typeof OfficeActionId.Type;

/**
 * Claim entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.ClaimId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ClaimId = make("claim", {
  description: "Identifier for a law-practice patent claim entity.",
});

/**
 * Runtime type for {@link ClaimId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.ClaimId = yield* S.decodeUnknownEffect(LawPractice.ClaimId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;

/**
 * Rejection entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.RejectionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const RejectionId = make("rejection", {
  description: "Identifier for a law-practice rejection entity.",
});

/**
 * Runtime type for {@link RejectionId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.RejectionId = yield* S.decodeUnknownEffect(LawPractice.RejectionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type RejectionId = typeof RejectionId.Type;

/**
 * Prior art reference entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PriorArtReferenceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PriorArtReferenceId = make("prior_art_reference", {
  description: "Identifier for a law-practice prior art reference entity.",
});

/**
 * Runtime type for {@link PriorArtReferenceId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.PriorArtReferenceId = yield* S.decodeUnknownEffect(LawPractice.PriorArtReferenceId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type PriorArtReferenceId = typeof PriorArtReferenceId.Type;

/**
 * Distinction entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.DistinctionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const DistinctionId = make("distinction", {
  description: "Identifier for a law-practice distinction entity.",
});

/**
 * Runtime type for {@link DistinctionId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.DistinctionId = yield* S.decodeUnknownEffect(LawPractice.DistinctionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type DistinctionId = typeof DistinctionId.Type;

/**
 * Citation entity identifier.
 *
 * @example
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.CitationId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CitationId = make("citation", {
  description: "Identifier for a law-practice citation entity.",
});

/**
 * Runtime type for {@link CitationId}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: LawPractice.CitationId = yield* S.decodeUnknownEffect(LawPractice.CitationId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CitationId = typeof CitationId.Type;
