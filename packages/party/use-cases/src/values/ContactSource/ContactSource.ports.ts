/**
 * Domain-neutral contact ingestion input and source port.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyUseCasesId } from "@beep/identity/packages";
import { Identifier, PhoneNumberInput } from "@beep/party-domain/Identifier";
import { ConceptIri, ContextRef } from "@beep/party-domain/Ids";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type * as Stream from "effect/Stream";

const $I = $PartyUseCasesId.create("values/ContactSource/ContactSource.ports");

/**
 * An unparsed mailbox and the source's explicit shared-address flag.
 *
 * **Example** (Retain raw spelling)
 * ```ts
 * import { ContactEmailInput } from "@beep/party-use-cases/ContactSource"
 * ContactEmailInput.make({ raw: " Dana@EXAMPLE.test ", represents: false })
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContactEmailInput extends S.Opaque<ContactEmailInput, { readonly brand: unique symbol }>()(
  S.Struct({ raw: S.String, represents: S.Boolean }).pipe(
    $I.annoteSchema("ContactEmailInput", { description: "Raw email evidence, before shared normalization." })
  )
) {}

/**
 * Source-supplied contextual role, with the link's own evidence location.
 *
 * **Details**
 * The source adapter chooses its context and role vocabulary. Party preserves
 * these opaque tokens without interpreting client, matter or other domain terms.
 *
 * **Example** (Decode a contextual role)
 * ```ts
 * import { ContactContextRole } from "@beep/party-use-cases/ContactSource"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ContactContextRole)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContactContextRole extends S.Opaque<ContactContextRole, { readonly brand: unique symbol }>()(
  S.Struct({ context: ContextRef, role: ConceptIri, anchor: S.NonEmptyString }).pipe(
    $I.annoteSchema("ContactContextRole", { description: "Source-owned role assertion and link provenance." })
  )
) {}

/**
 * A source card; a mention requiring evidence review, never canonical identity.
 *
 * **Details**
 * Empty source identifiers survive decoding so ingestion can report a data-quality
 * issue when no usable identifier exists. A display name never supplies a key.
 * Rich sources can supply already-graduated identifiers through `identifiers`;
 * raw email and phone fields use the same domain normalizers as mail ingestion.
 *
 * **Example** (An identifier-free card)
 * ```ts
 * import { ContactCard } from "@beep/party-use-cases/ContactSource"
 * ContactCard.make({ sourceNamespace: "urn:example:contacts", sourceRecordId: "card-1", label: "Example Person", kind: "Person", emails: [], phones: [], identifiers: [], roles: [] })
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContactCard extends S.Opaque<ContactCard, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceNamespace: S.String,
    sourceRecordId: S.String,
    label: S.String,
    kind: S.Literals(["Person", "Organization"]),
    emails: S.Array(ContactEmailInput),
    phones: S.Array(PhoneNumberInput),
    identifiers: S.Array(Identifier),
    roles: S.Array(ContactContextRole),
  }).pipe($I.annoteSchema("ContactCard", { description: "Domain-neutral contact source record." }))
) {}

/**
 * A source read failure carrying a log-safe reason.
 *
 * **Example** (Report unavailable source)
 * ```ts
 * import { ContactSourceError } from "@beep/party-use-cases/ContactSource"
 * ContactSourceError.make({ reason: "source-unavailable" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ContactSourceError extends S.TaggedError<ContactSourceError, { readonly brand: unique symbol }>(
  $I`ContactSourceError`
)(
  "ContactSourceError",
  { reason: S.NonEmptyString },
  $I.annoteError<ContactSourceError>("ContactSourceError", { description: "Log-safe contact source failure." })
) {}

/**
 * Lazy reads from a contact source; each subscription starts its own read.
 * @category ports
 * @since 0.0.0
 */
export interface ContactSourceShape {
  readonly cards: Stream.Stream<ContactCard, ContactSourceError>;
}

/**
 * A contact source implemented by an owning source adapter.
 *
 * **Example** (Supply a synthetic source)
 * ```ts
 * import { ContactSource } from "@beep/party-use-cases/ContactSource"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 * const source = Layer.succeed(ContactSource, ContactSource.of({ cards: Stream.empty }))
 * ```
 * @category services
 * @since 0.0.0
 */
export class ContactSource extends Context.Service<ContactSource, ContactSourceShape>()($I`ContactSource`) {}
