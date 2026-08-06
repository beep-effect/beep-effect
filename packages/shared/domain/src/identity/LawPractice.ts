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
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link LegalClientId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalClientId = typeof LegalClientId.Type;

/**
 * Legal contact entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link LegalContactId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalContactId = typeof LegalContactId.Type;

/**
 * Matter entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link MatterId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type MatterId = typeof MatterId.Type;

/**
 * Patent asset entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link PatentAssetId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PatentAssetId = typeof PatentAssetId.Type;

/**
 * Office action entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link OfficeActionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type OfficeActionId = typeof OfficeActionId.Type;

/**
 * Claim entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link ClaimId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;

/**
 * Rejection entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link RejectionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type RejectionId = typeof RejectionId.Type;

/**
 * Prior art reference entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link PriorArtReferenceId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PriorArtReferenceId = typeof PriorArtReferenceId.Type;

/**
 * Distinction entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link DistinctionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type DistinctionId = typeof DistinctionId.Type;

/**
 * Citation entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
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
 * @see {@link CitationId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type CitationId = typeof CitationId.Type;

/**
 * Patent citation event entity identifier.
 *
 * **Details**
 *
 * A patent citation event records one observed occurrence of a patent
 * reference against a filing. Events are append-only, so an id always names
 * one exact observation rather than a mutable current state.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PatentCitationEventId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PatentCitationEventId = make("patent_citation_event", {
  description: "Identifier for a law-practice patent citation event entity.",
});

/**
 * Runtime type for {@link PatentCitationEventId}.
 *
 * @see {@link PatentCitationEventId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PatentCitationEventId = typeof PatentCitationEventId.Type;

/**
 * Candor disposition entity identifier.
 *
 * **Details**
 *
 * A candor disposition records one dated attorney judgment about one exact
 * patent citation event. Dispositions are append-only, so revision and
 * withdrawal append a new record that names the prior id rather than editing
 * what was decided at filing time.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.CandorDispositionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandorDispositionId = make("candor_disposition", {
  description: "Identifier for a law-practice candor disposition entity.",
});

/**
 * Runtime type for {@link CandorDispositionId}.
 *
 * @see {@link CandorDispositionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type CandorDispositionId = typeof CandorDispositionId.Type;

/**
 * Information-disclosure submission fact entity identifier.
 *
 * **Details**
 *
 * Each submission act is its own append-only record with its own operative
 * date, so an id names one act rather than a running state of "the IDS".
 * Supplemental and correcting submissions take fresh ids.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.IdsSubmissionFactId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const IdsSubmissionFactId = make("ids_submission_fact", {
  description: "Identifier for a law-practice information-disclosure submission fact entity.",
});

/**
 * Runtime type for {@link IdsSubmissionFactId}.
 *
 * @see {@link IdsSubmissionFactId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type IdsSubmissionFactId = typeof IdsSubmissionFactId.Type;
