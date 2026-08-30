/**
 * Human curation commands and their resulting events/jobs.
 *
 * **Details**
 *
 * Actions, events, and jobs are schema-backed tagged unions. Status-specific
 * values are nested so impossible combinations of optional correction fields
 * cannot leak into curation behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { NamedNode } from "@beep/rdf";
import { SchemaUtils, UUID } from "@beep/schema";
import * as S from "effect/Schema";
import { OntologyName } from "../Identity.ts";
import { ClaimId, RdfObject } from "./KnowledgeModel.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/CurationAction");

const WikidataQid = S.String.check(
  S.isPattern(/^Q[1-9][0-9]*$/, {
    identifier: $I`WikidataQidPatternCheck`,
    title: "Wikidata QID",
    description: "A Wikidata item identifier beginning with Q and a non-zero canonical decimal integer.",
    message: "Wikidata QID must use Q followed by a positive decimal integer without leading zeroes.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }).map((id) => `Q${id}`),
  })
  .pipe(
    S.brand("WikidataQid"),
    $I.annoteSchema("WikidataQid", {
      description: "Canonical Wikidata item identifier.",
    }),
    SchemaUtils.withCodecStatics
  );

const ActionBase = {
  ontologyId: OntologyName.annotateKey({
    description: "Ontology registry identifier that scopes the curation action.",
  }),
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Optional non-empty identifier of the curator." })
  ),
  note: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Optional curator note." })
  ),
  timestamp: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Optional caller-supplied UTC action instant; services stamp missing values at execution.",
    })
  ),
};

const CurationActionDefinition = S.TaggedUnion({
  CorrectTripleAction: {
    ...ActionBase,
    originalClaimId: ClaimId,
    replacement: S.Struct({
      subject: NamedNode,
      predicate: NamedNode,
      object: RdfObject,
    }).annotateKey({
      description: "Complete canonical RDF triple that replaces the original claim.",
    }),
    reason: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    storeAsExample: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  MarkAsWrongAction: {
    ...ActionBase,
    claimId: ClaimId,
    errorCategory: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    negativePattern: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    storeAsNegativeExample: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
  },
  AddAliasAction: {
    ...ActionBase,
    canonicalEntity: NamedNode,
    aliasMention: S.NonEmptyString,
    resolutionMethod: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("manual")),
    confidence: Confidence.pipe(SchemaUtils.withKeyDefaults(Confidence.make(1))),
  },
  PromoteToPreferredAction: {
    ...ActionBase,
    claimId: ClaimId,
    reason: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  LinkToWikidataAction: {
    ...ActionBase,
    canonicalEntity: NamedNode,
    wikidataQid: WikidataQid,
    reconciliationScore: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
  },
});

/**
 * Replace one incorrect claim with a complete canonical RDF triple.
 *
 * **Example** (Decode CompleteCorrection)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CorrectTripleAction } from "@effect-ontology/Schema/CurationAction"
 *
 * const action = S.decodeUnknownOption(CorrectTripleAction)({
 *   _tag: "CorrectTripleAction",
 *   ontologyId: "claims",
 *   originalClaimId: "claim-abc123def456",
 *   replacement: {
 *     subject: "https://example.org/person/alice",
 *     predicate: "https://schema.org/name",
 *     object: "https://example.org/name/alice"
 *   }
 * })
 * console.log(O.isSome(action)) // true
 * ```
 *
 * @invariant Replacement subject, predicate, and object are all present.
 * @category commands
 * @since 0.0.0
 */
export const CorrectTripleAction = CurationActionDefinition.cases.CorrectTripleAction.pipe(
  $I.annoteSchema("CorrectTripleAction", {
    description: "Curation command that replaces an incorrect claim with a complete canonical RDF triple.",
    toArbitrary: () => S.toArbitrary(CurationActionDefinition.cases.CorrectTripleAction),
  })
);

/**
 * Runtime correction command decoded by {@link CorrectTripleAction}.
 *
 * @see {@link CorrectTripleAction} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type CorrectTripleAction = typeof CorrectTripleAction.Type;
/**
 * Deprecate a claim without supplying a replacement.
 *
 * **Example** (Decode ClaimDeprecation)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MarkAsWrongAction } from "@effect-ontology/Schema/CurationAction"
 *
 * const action = S.decodeUnknownOption(MarkAsWrongAction)({
 *   _tag: "MarkAsWrongAction",
 *   ontologyId: "claims",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(O.isSome(action)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const MarkAsWrongAction = CurationActionDefinition.cases.MarkAsWrongAction.pipe(
  $I.annoteSchema("MarkAsWrongAction", {
    description: "Curation command that deprecates an incorrect claim and optionally records a negative example.",
    toArbitrary: () => S.toArbitrary(CurationActionDefinition.cases.MarkAsWrongAction),
  })
);

/**
 * Runtime deprecation command decoded by {@link MarkAsWrongAction}.
 *
 * @see {@link MarkAsWrongAction} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type MarkAsWrongAction = typeof MarkAsWrongAction.Type;

/**
 * Attach a surface-form alias to a canonical RDF entity.
 *
 * **Example** (Decode an alias command)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AddAliasAction } from "@effect-ontology/Schema/CurationAction"
 *
 * const action = S.decodeUnknownOption(AddAliasAction)({
 *   _tag: "AddAliasAction",
 *   ontologyId: "claims",
 *   canonicalEntity: "https://example.org/person/alice",
 *   aliasMention: "Alice"
 * })
 * console.log(O.isSome(action)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const AddAliasAction = CurationActionDefinition.cases.AddAliasAction.pipe(
  $I.annoteSchema("AddAliasAction", {
    description: "Curation command that attaches a surface-form alias to a canonical RDF entity.",
    toArbitrary: () => S.toArbitrary(CurationActionDefinition.cases.AddAliasAction),
  })
);
/**
 * Runtime alias command decoded by {@link AddAliasAction}.
 *
 * @see {@link AddAliasAction} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type AddAliasAction = typeof AddAliasAction.Type;
/**
 * Promote a claim to preferred rank.
 *
 * **Example** (Decode a preferred-rank promotion)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PromoteToPreferredAction } from "@effect-ontology/Schema/CurationAction"
 *
 * const action = S.decodeUnknownOption(PromoteToPreferredAction)({
 *   _tag: "PromoteToPreferredAction",
 *   ontologyId: "claims",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(O.isSome(action)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const PromoteToPreferredAction = CurationActionDefinition.cases.PromoteToPreferredAction.pipe(
  $I.annoteSchema("PromoteToPreferredAction", {
    description: "Curation command that promotes a claim to preferred rank.",
    toArbitrary: () => S.toArbitrary(CurationActionDefinition.cases.PromoteToPreferredAction),
  })
);
/**
 * Runtime promotion command decoded by {@link PromoteToPreferredAction}.
 *
 * @see {@link PromoteToPreferredAction} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type PromoteToPreferredAction = typeof PromoteToPreferredAction.Type;
/**
 * Confirm an owl:sameAs link between a canonical entity and Wikidata.
 *
 * **Example** (Decode a Wikidata link)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkToWikidataAction } from "@effect-ontology/Schema/CurationAction"
 *
 * const action = S.decodeUnknownOption(LinkToWikidataAction)({
 *   _tag: "LinkToWikidataAction",
 *   ontologyId: "claims",
 *   canonicalEntity: "https://example.org/person/alice",
 *   wikidataQid: "Q42"
 * })
 * console.log(O.isSome(action)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const LinkToWikidataAction = CurationActionDefinition.cases.LinkToWikidataAction.pipe(
  $I.annoteSchema("LinkToWikidataAction", {
    description: "Curation command that confirms an owl:sameAs link to one Wikidata item.",
    toArbitrary: () => S.toArbitrary(CurationActionDefinition.cases.LinkToWikidataAction),
  })
);
/**
 * Runtime Wikidata-link command decoded by {@link LinkToWikidataAction}.
 *
 * @see {@link LinkToWikidataAction} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type LinkToWikidataAction = typeof LinkToWikidataAction.Type;
/**
 * Tagged union of every supported human curation action.
 *
 * **Example** (Decode any curation action)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CurationAction } from "@effect-ontology/Schema/CurationAction"
 *
 * const action = S.decodeUnknownOption(CurationAction)({
 *   _tag: "PromoteToPreferredAction",
 *   ontologyId: "claims",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(O.isSome(action)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CurationAction = CurationActionDefinition.pipe(
  $I.annoteSchema("CurationAction", {
    description: "Tagged union of claim correction, deprecation, aliasing, promotion, and Wikidata-link actions.",
    toArbitrary: () => S.toArbitrary(CurationActionDefinition),
  })
);

/**
 * Runtime action decoded by {@link CurationAction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationAction = typeof CurationAction.Type;

const EventBase = {
  ontologyId: OntologyName,
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
};

const CurationEventDefinition = S.TaggedUnion({
  ClaimCorrectedEvent: {
    ...EventBase,
    originalClaimId: ClaimId,
    newClaimId: ClaimId,
    correctionId: S.NonEmptyString,
  },
  ClaimDeprecatedEvent: {
    ...EventBase,
    claimId: ClaimId,
    reason: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    negativeExampleId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  AliasAddedEvent: {
    ...EventBase,
    canonicalEntity: NamedNode,
    aliasMention: S.NonEmptyString,
    aliasId: S.NonEmptyString,
  },
  ClaimPromotedEvent: {
    ...EventBase,
    claimId: ClaimId,
  },
  EntityLinkedEvent: {
    ...EventBase,
    canonicalEntity: NamedNode,
    wikidataQid: WikidataQid,
    reconciliationScore: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
  },
});

/**
 * Event emitted after a claim correction is applied.
 *
 * **Example** (Decode CorrectionEvent)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimCorrectedEvent } from "@effect-ontology/Schema/CurationAction"
 *
 * const event = S.decodeUnknownOption(ClaimCorrectedEvent)({
 *   _tag: "ClaimCorrectedEvent",
 *   ontologyId: "claims",
 *   timestamp: "2026-08-11T12:00:00.000Z",
 *   originalClaimId: "claim-abc123def456",
 *   newClaimId: "claim-def456abc123",
 *   correctionId: "correction-1"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ClaimCorrectedEvent = CurationEventDefinition.cases.ClaimCorrectedEvent.pipe(
  $I.annoteSchema("ClaimCorrectedEvent", {
    description: "Domain event emitted after a claim correction is applied successfully.",
    toArbitrary: () => S.toArbitrary(CurationEventDefinition.cases.ClaimCorrectedEvent),
  })
);

/**
 * Event emitted after a claim is deprecated.
 *
 * **Example** (Decode DeprecationEvent)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimDeprecatedEvent } from "@effect-ontology/Schema/CurationAction"
 *
 * const event = S.decodeUnknownOption(ClaimDeprecatedEvent)({
 *   _tag: "ClaimDeprecatedEvent",
 *   ontologyId: "claims",
 *   timestamp: "2026-08-11T12:00:00.000Z",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ClaimDeprecatedEvent = CurationEventDefinition.cases.ClaimDeprecatedEvent.pipe(
  $I.annoteSchema("ClaimDeprecatedEvent", {
    description: "Domain event emitted after an incorrect claim is deprecated.",
    toArbitrary: () => S.toArbitrary(CurationEventDefinition.cases.ClaimDeprecatedEvent),
  })
);

/**
 * Event emitted after an entity alias is added.
 *
 * **Example** (Decode an alias-added event)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AliasAddedEvent } from "@effect-ontology/Schema/CurationAction"
 *
 * const event = S.decodeUnknownOption(AliasAddedEvent)({
 *   _tag: "AliasAddedEvent",
 *   ontologyId: "claims",
 *   timestamp: "2026-08-11T12:00:00.000Z",
 *   canonicalEntity: "https://example.org/person/alice",
 *   aliasMention: "Alice",
 *   aliasId: "alias-1"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const AliasAddedEvent = CurationEventDefinition.cases.AliasAddedEvent.pipe(
  $I.annoteSchema("AliasAddedEvent", {
    description: "Domain event emitted after a surface-form alias is attached to an entity.",
    toArbitrary: () => S.toArbitrary(CurationEventDefinition.cases.AliasAddedEvent),
  })
);

/**
 * Event emitted after a claim is promoted.
 *
 * **Example** (Decode PromotionEvent)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClaimPromotedEvent } from "@effect-ontology/Schema/CurationAction"
 *
 * const event = S.decodeUnknownOption(ClaimPromotedEvent)({
 *   _tag: "ClaimPromotedEvent",
 *   ontologyId: "claims",
 *   timestamp: "2026-08-11T12:00:00.000Z",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ClaimPromotedEvent = CurationEventDefinition.cases.ClaimPromotedEvent.pipe(
  $I.annoteSchema("ClaimPromotedEvent", {
    description: "Domain event emitted after a claim is promoted to preferred rank.",
    toArbitrary: () => S.toArbitrary(CurationEventDefinition.cases.ClaimPromotedEvent),
  })
);

/**
 * Event emitted after a Wikidata link is confirmed.
 *
 * **Example** (Decode an entity-link event)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityLinkedEvent } from "@effect-ontology/Schema/CurationAction"
 *
 * const event = S.decodeUnknownOption(EntityLinkedEvent)({
 *   _tag: "EntityLinkedEvent",
 *   ontologyId: "claims",
 *   timestamp: "2026-08-11T12:00:00.000Z",
 *   canonicalEntity: "https://example.org/person/alice",
 *   wikidataQid: "Q42"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const EntityLinkedEvent = CurationEventDefinition.cases.EntityLinkedEvent.pipe(
  $I.annoteSchema("EntityLinkedEvent", {
    description: "Domain event emitted after an entity is linked to a Wikidata item.",
    toArbitrary: () => S.toArbitrary(CurationEventDefinition.cases.EntityLinkedEvent),
  })
);

/**
 * Tagged union of events emitted by curation actions.
 *
 * **Example** (Decode any curation event)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CurationEvent } from "@effect-ontology/Schema/CurationAction"
 *
 * const event = S.decodeUnknownOption(CurationEvent)({
 *   _tag: "ClaimPromotedEvent",
 *   ontologyId: "claims",
 *   timestamp: "2026-08-11T12:00:00.000Z",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CurationEvent = CurationEventDefinition.pipe(
  $I.annoteSchema("CurationEvent", {
    description: "Tagged union of events emitted after successful curation actions.",
    toArbitrary: () => S.toArbitrary(CurationEventDefinition),
  })
);

/**
 * Runtime event decoded by {@link CurationEvent}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationEvent = typeof CurationEvent.Type;

const CurationJobDefinition = S.TaggedUnion({
  EmbeddingJob: {
    ontologyId: OntologyName,
    canonicalEntityId: UUID,
    reason: S.NonEmptyString,
  },
  PromptCacheJob: {
    ontologyId: OntologyName,
    exampleId: S.NonEmptyString,
    isNegative: S.Boolean,
  },
});

/**
 * Re-embed a canonical entity after curation changes its aliases.
 *
 * **Example** (Decode an embedding job)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EmbeddingJob } from "@effect-ontology/Schema/CurationAction"
 *
 * const job = S.decodeUnknownOption(EmbeddingJob)({
 *   _tag: "EmbeddingJob",
 *   ontologyId: "claims",
 *   canonicalEntityId: "00000000-0000-4000-8000-000000000001",
 *   reason: "alias added"
 * })
 * console.log(O.isSome(job)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const EmbeddingJob = CurationJobDefinition.cases.EmbeddingJob.pipe(
  $I.annoteSchema("EmbeddingJob", {
    description: "Asynchronous curation job that re-embeds a canonical entity.",
    toArbitrary: () => S.toArbitrary(CurationJobDefinition.cases.EmbeddingJob),
  })
);

/**
 * Update the prompt cache with a curated example.
 *
 * **Example** (Decode a prompt-cache job)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PromptCacheJob } from "@effect-ontology/Schema/CurationAction"
 *
 * const job = S.decodeUnknownOption(PromptCacheJob)({
 *   _tag: "PromptCacheJob",
 *   ontologyId: "claims",
 *   exampleId: "example-1",
 *   isNegative: false
 * })
 * console.log(O.isSome(job)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const PromptCacheJob = CurationJobDefinition.cases.PromptCacheJob.pipe(
  $I.annoteSchema("PromptCacheJob", {
    description: "Asynchronous curation job that updates the prompt example cache.",
    toArbitrary: () => S.toArbitrary(CurationJobDefinition.cases.PromptCacheJob),
  })
);

/**
 * Tagged union of asynchronous jobs requested by curation.
 *
 * **Example** (Decode any curation job)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CurationJob } from "@effect-ontology/Schema/CurationAction"
 *
 * const job = S.decodeUnknownOption(CurationJob)({
 *   _tag: "EmbeddingJob",
 *   ontologyId: "claims",
 *   canonicalEntityId: "00000000-0000-4000-8000-000000000001",
 *   reason: "alias added"
 * })
 * console.log(O.isSome(job)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CurationJob = CurationJobDefinition.pipe(
  $I.annoteSchema("CurationJob", {
    description: "Tagged union of embedding and prompt-cache work requested by curation.",
    toArbitrary: () => S.toArbitrary(CurationJobDefinition),
  })
);

/**
 * Runtime job decoded by {@link CurationJob}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationJob = typeof CurationJob.Type;
