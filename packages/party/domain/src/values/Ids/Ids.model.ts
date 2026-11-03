/**
 * Prefixed, branded identifiers for the party data model.
 *
 * **Details**
 * These evidence and account ids are strings with fixed scheme prefixes, checked
 * at the decode boundary. PartyId itself is the shared integer surrogate. Neither
 * identity uses `effect/Graph` node indexes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PartyDomainId.create("values/Ids/Ids.model");

const prefixed = (prefix: string) =>
  S.String.check(
    S.isPattern(
      new RegExp(`^${prefix}:\\S+$`),
      $I.annote(`${prefix}PrefixCheck`, { message: `Expected an id of the form "${prefix}:<value>".` })
    )
  );

/**
 * An identifier string such as an email address or phone number.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const IdentifierId = prefixed("party-ident").pipe(
  S.brand("IdentifierId"),
  $I.annoteSchema("IdentifierId", { description: "Identifier with the ident: scheme." })
);
/**
 * Decoded IdentifierId type.
 * @category models
 * @since 0.0.0
 */
export type IdentifierId = typeof IdentifierId.Type;

/**
 * An account on some system (mailbox, social account, phone line).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AccountId = prefixed("party-acct").pipe(
  S.brand("AccountId"),
  $I.annoteSchema("AccountId", { description: "Identifier with the acct: scheme." })
);
/**
 * Decoded AccountId type.
 * @category models
 * @since 0.0.0
 */
export type AccountId = typeof AccountId.Type;

/**
 * A voice: whoever composed and sent under one channel configuration.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const VoiceId = prefixed("party-voice").pipe(
  S.brand("VoiceId"),
  $I.annoteSchema("VoiceId", { description: "Identifier with the voice: scheme." })
);
/**
 * Decoded VoiceId type.
 * @category models
 * @since 0.0.0
 */
export type VoiceId = typeof VoiceId.Type;

/**
 * Immutable artifact content, keyed by its SHA-256 digest.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContentId = prefixed("party-sha256").pipe(
  S.brand("ContentId"),
  $I.annoteSchema("ContentId", { description: "Identifier with the sha256: scheme." })
);
/**
 * Decoded ContentId type.
 * @category models
 * @since 0.0.0
 */
export type ContentId = typeof ContentId.Type;

/**
 * One occurrence of artifact content in a collection (a path, a Bates range, a PST child).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OccurrenceId = prefixed("party-occ").pipe(
  S.brand("OccurrenceId"),
  $I.annoteSchema("OccurrenceId", { description: "Identifier with the occ: scheme." })
);
/**
 * Decoded OccurrenceId type.
 * @category models
 * @since 0.0.0
 */
export type OccurrenceId = typeof OccurrenceId.Type;

/**
 * A provenance activity (extraction run, resolver run, human review).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ActivityId = prefixed("party-act").pipe(
  S.brand("ActivityId"),
  $I.annoteSchema("ActivityId", { description: "Identifier with the act: scheme." })
);
/**
 * Decoded ActivityId type.
 * @category models
 * @since 0.0.0
 */
export type ActivityId = typeof ActivityId.Type;

/**
 * A deterministic or model-produced observation.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ObservationId = prefixed("party-obs").pipe(
  S.brand("ObservationId"),
  $I.annoteSchema("ObservationId", { description: "Identifier with the obs: scheme." })
);
/**
 * Decoded ObservationId type.
 * @category models
 * @since 0.0.0
 */
export type ObservationId = typeof ObservationId.Type;

/**
 * A communication event (message, meeting, call).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EventId = prefixed("party-evt").pipe(
  S.brand("EventId"),
  $I.annoteSchema("EventId", { description: "Identifier with the evt: scheme." })
);
/**
 * Decoded EventId type.
 * @category models
 * @since 0.0.0
 */
export type EventId = typeof EventId.Type;

/**
 * A source-local assertion: one proposition asserted by one source occurrence.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AssertionId = prefixed("party-asrt").pipe(
  S.brand("AssertionId"),
  $I.annoteSchema("AssertionId", { description: "Identifier with the asrt: scheme." })
);
/**
 * Decoded AssertionId type.
 * @category models
 * @since 0.0.0
 */
export type AssertionId = typeof AssertionId.Type;

/**
 * An immutable bitemporal claim version in the authority ledger.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ClaimVersionId = prefixed("party-cv").pipe(
  S.brand("ClaimVersionId"),
  $I.annoteSchema("ClaimVersionId", { description: "Identifier with the cv: scheme." })
);
/**
 * Decoded ClaimVersionId type.
 * @category models
 * @since 0.0.0
 */
export type ClaimVersionId = typeof ClaimVersionId.Type;

/**
 * A derived assessment (operational hierarchy signal, evidence-kind classification).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AssessmentId = prefixed("party-asmt").pipe(
  S.brand("AssessmentId"),
  $I.annoteSchema("AssessmentId", { description: "Identifier with the asmt: scheme." })
);
/**
 * Decoded AssessmentId type.
 * @category models
 * @since 0.0.0
 */
export type AssessmentId = typeof AssessmentId.Type;

/**
 * An authenticated human principal (reviewer, analyst).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PrincipalId = prefixed("party-user").pipe(
  S.brand("PrincipalId"),
  $I.annoteSchema("PrincipalId", { description: "Identifier with the user: scheme." })
);
/**
 * Decoded PrincipalId type.
 * @category models
 * @since 0.0.0
 */
export type PrincipalId = typeof PrincipalId.Type;

/**
 * A context the party plays a role in (matter, case, deal, campaign).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContextRef = prefixed("party-ctx").pipe(
  S.brand("ContextRef"),
  $I.annoteSchema("ContextRef", { description: "Identifier with the ctx: scheme." })
);
/**
 * Decoded ContextRef type.
 * @category models
 * @since 0.0.0
 */
export type ContextRef = typeof ContextRef.Type;

/**
 * A SKOS concept IRI for open vocabularies (roles, relationship kinds, services).
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ConceptIri = S.String.check(
  S.isPattern(
    /^(https?:\/\/|urn:)\S+$/,
    $I.annote("ConceptIriCheck", { message: "Expected an http(s) or urn concept IRI." })
  )
).pipe(S.brand("ConceptIri"), $I.annoteSchema("ConceptIri", { description: "SKOS concept IRI." }));
/**
 * Decoded ConceptIri type.
 * @category models
 * @since 0.0.0
 */
export type ConceptIri = typeof ConceptIri.Type;

/**
 * A hex digest used to pin an evidence basis, a configuration, or a text version.
 *
 * **Example** (Decode a slice-owned identifier)
 *
 * ```ts
 * import * as Ids from "@beep/party-domain/Ids"
 * import * as S from "effect/Schema"
 * S.decodeUnknownOption(Ids.ClaimVersionId)("party-cv:1")
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const Digest = S.String.check(
  S.isPattern(/^[0-9a-f]{8,64}$/, $I.annote("DigestCheck", { message: "Expected a lowercase hex digest." }))
).pipe(S.brand("Digest"), $I.annoteSchema("Digest", { description: "Lowercase hex digest." }));
/**
 * Decoded Digest type.
 * @category models
 * @since 0.0.0
 */
export type Digest = typeof Digest.Type;
