/**
 * Contact ingestion records and log-safe data-quality outcomes.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PartyServerId } from "@beep/identity/packages";
import { GraphContact } from "@beep/m365/M365.schemas";
import { ClaimVersion, SourceAssertion } from "@beep/party-domain/Claim";
import { DirectoryRow } from "@beep/party-domain/Communication";
import { Identifier, IdentifierIssueField, IdentifierIssueReason } from "@beep/party-domain/Identifier";
import { ActivityId, IdentifierId } from "@beep/party-domain/Ids";
import { Party } from "@beep/party-domain/Party";
import { PartyKey } from "@beep/party-domain/PartyKey";
import { ContactCard, PhoneNumberInput } from "@beep/party-use-cases/ContactSource";
import * as S from "effect/Schema";

const $I = $PartyServerId.create("values/ContactEvidence/ContactEvidence.model");

/**
 * An identifier's stable reference and key, retaining source spelling separately.
 * **Example** (Decode an ingestion identifier)
 * ```ts
 * import { IngestIdentifier } from "@beep/party-server/ContactEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(IngestIdentifier)
 * ```
 * @category models
 * @since 0.0.0
 */
export class IngestIdentifier extends S.Opaque<IngestIdentifier, { readonly brand: unique symbol }>()(
  S.Struct({ id: IdentifierId, value: Identifier, key: PartyKey, represents: S.Boolean }).pipe(
    $I.annoteSchema("IngestIdentifier", { description: "Canonical identifier, stable reference and source role." })
  )
) {}

/**
 * A log-safe identifier failure; raw private input is deliberately omitted.
 * **Example** (Report an ambiguous phone)
 * ```ts
 * import { IngestIssue } from "@beep/party-server/ContactEvidence"
 * IngestIssue.make({ field: "country", reason: "ambiguous-phone" })
 * ```
 * @category models
 * @since 0.0.0
 */
export class IngestIssue extends S.Opaque<IngestIssue, { readonly brand: unique symbol }>()(
  S.Struct({ field: IdentifierIssueField, reason: IdentifierIssueReason }).pipe(
    $I.annoteSchema("IngestIssue", { description: "Data-quality issue without raw input." })
  )
) {}

/**
 * Contact evidence plus the activity and time of this extraction.
 * **Example** (Decode an ingestion request)
 * ```ts
 * import { ContactIngestInput } from "@beep/party-server/ContactEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ContactIngestInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContactIngestInput extends S.Opaque<ContactIngestInput, { readonly brand: unique symbol }>()(
  S.Struct({ card: ContactCard, activity: ActivityId, recordedAt: S.DateTimeUtcFromMillis }).pipe(
    $I.annoteSchema("ContactIngestInput", { description: "One source card extraction." })
  )
) {}

/**
 * A provisional party and its unreviewed evidence, or a data-quality-only outcome.
 * **Example** (Inspect a contact result)
 * ```ts
 * import { ContactIngest } from "@beep/party-server/ContactEvidence"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContactIngest)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContactIngest extends S.Opaque<ContactIngest, { readonly brand: unique symbol }>()(
  S.Struct({
    party: S.OptionFromNullOr(Party),
    identifiers: S.Array(IngestIdentifier),
    observations: S.Array(DirectoryRow),
    assertions: S.Array(SourceAssertion),
    versions: S.Array(ClaimVersion),
    issues: S.Array(IngestIssue),
  }).pipe($I.annoteSchema("ContactIngest", { description: "Contact ingestion evidence and issues." }))
) {}

/**
 * Provenance for one read of a contact source.
 * **Example** (Decode a source extraction request)
 * ```ts
 * import { ContactSourceIngestInput } from "@beep/party-server/ContactEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ContactSourceIngestInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContactSourceIngestInput extends S.Opaque<ContactSourceIngestInput, { readonly brand: unique symbol }>()(
  S.Struct({ activity: ActivityId, recordedAt: S.DateTimeUtcFromMillis }).pipe(
    $I.annoteSchema("ContactSourceIngestInput", { description: "Provenance for a contact source extraction." })
  )
) {}

/**
 * Graph card and explicit phone-country context supplied by its source owner.
 * **Example** (Decode Graph adapter input)
 * ```ts
 * import { GraphContactInput } from "@beep/party-server/ContactEvidence"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(GraphContactInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphContactInput extends S.Opaque<GraphContactInput, { readonly brand: unique symbol }>()(
  S.Struct({ contact: GraphContact, sourceNamespace: S.String, country: PhoneNumberInput.fields.country }).pipe(
    $I.annoteSchema("GraphContactInput", { description: "Graph source card with explicit country context." })
  )
) {}
