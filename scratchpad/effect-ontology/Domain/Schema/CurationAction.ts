/**
 * Human curation commands and their resulting events/jobs.
 *
 * @remarks
 * Actions, events, and jobs are schema-backed tagged unions. Status-specific
 * values are nested so impossible combinations of optional correction fields
 * cannot leak into curation behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { OntologyName } from "../Identity.ts";
import { Confidence } from "../Model/shared.ts";
import { NamedNode } from "../Rdf/Types.ts";
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
 * @example
 * ```ts
 * import { CorrectTripleAction } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const makeCorrection = CorrectTripleAction.make
 * console.log(makeCorrection)
 * ```
 *
 * @invariant Replacement subject, predicate, and object are all present.
 * @category actions
 * @since 0.0.0
 */
export const CorrectTripleAction = CurationActionDefinition.cases.CorrectTripleAction.pipe(
  $I.annoteSchema("CorrectTripleAction", {
    description: "Curation command that replaces an incorrect claim with a complete canonical RDF triple.",
    toArbitrary: () => () => S.toArbitrary(CurationActionDefinition.cases.CorrectTripleAction),
  })
);

/**
 * Deprecate a claim without supplying a replacement.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MarkAsWrongAction } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const action = S.decodeUnknownSync(MarkAsWrongAction)({
 *   ontologyId: "claims",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(action.storeAsNegativeExample) // true
 * ```
 *
 * @category actions
 * @since 0.0.0
 */
export const MarkAsWrongAction = CurationActionDefinition.cases.MarkAsWrongAction.pipe(
  $I.annoteSchema("MarkAsWrongAction", {
    description: "Curation command that deprecates an incorrect claim and optionally records a negative example.",
    toArbitrary: () => () => S.toArbitrary(CurationActionDefinition.cases.MarkAsWrongAction),
  })
);

/**
 * Attach a surface-form alias to a canonical RDF entity.
 *
 * @example
 * ```ts
 * import { AddAliasAction } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const makeAlias = AddAliasAction.make
 * console.log(makeAlias)
 * ```
 *
 * @category actions
 * @since 0.0.0
 */
export const AddAliasAction = CurationActionDefinition.cases.AddAliasAction.pipe(
  $I.annoteSchema("AddAliasAction", {
    description: "Curation command that attaches a surface-form alias to a canonical RDF entity.",
    toArbitrary: () => () => S.toArbitrary(CurationActionDefinition.cases.AddAliasAction),
  })
);

/**
 * Promote a claim to preferred rank.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PromoteToPreferredAction } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const action = S.decodeUnknownSync(PromoteToPreferredAction)({
 *   ontologyId: "claims",
 *   claimId: "claim-abc123def456"
 * })
 * console.log(action._tag) // "PromoteToPreferredAction"
 * ```
 *
 * @category actions
 * @since 0.0.0
 */
export const PromoteToPreferredAction = CurationActionDefinition.cases.PromoteToPreferredAction.pipe(
  $I.annoteSchema("PromoteToPreferredAction", {
    description: "Curation command that promotes a claim to preferred rank.",
    toArbitrary: () => () => S.toArbitrary(CurationActionDefinition.cases.PromoteToPreferredAction),
  })
);

/**
 * Confirm an owl:sameAs link between a canonical entity and Wikidata.
 *
 * @example
 * ```ts
 * import { LinkToWikidataAction } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const makeLink = LinkToWikidataAction.make
 * console.log(makeLink)
 * ```
 *
 * @category actions
 * @since 0.0.0
 */
export const LinkToWikidataAction = CurationActionDefinition.cases.LinkToWikidataAction.pipe(
  $I.annoteSchema("LinkToWikidataAction", {
    description: "Curation command that confirms an owl:sameAs link to one Wikidata item.",
    toArbitrary: () => () => S.toArbitrary(CurationActionDefinition.cases.LinkToWikidataAction),
  })
);

/**
 * Tagged union of every supported human curation action.
 *
 * @example
 * ```ts
 * import { CurationActionSchema } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(Object.keys(CurationActionSchema.cases).length) // 5
 * ```
 *
 * @category unions
 * @since 0.0.0
 */
export const CurationActionSchema = CurationActionDefinition.pipe(
  $I.annoteSchema("CurationAction", {
    description: "Tagged union of claim correction, deprecation, aliasing, promotion, and Wikidata-link actions.",
    toArbitrary: () => () => S.toArbitrary(CurationActionDefinition),
  })
);

/**
 * Runtime action decoded by {@link CurationActionSchema}.
 *
 * @example
 * ```ts
 * import type { CurationAction } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const actionName = (action: CurationAction) => action._tag
 * console.log(actionName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationAction = typeof CurationActionSchema.Type;

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
 * @example
 * ```ts
 * import { ClaimCorrectedEvent } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(ClaimCorrectedEvent.make)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ClaimCorrectedEvent = CurationEventDefinition.cases.ClaimCorrectedEvent.pipe(
  $I.annoteSchema("ClaimCorrectedEvent", {
    description: "Domain event emitted after a claim correction is applied successfully.",
    toArbitrary: () => () => S.toArbitrary(CurationEventDefinition.cases.ClaimCorrectedEvent),
  })
);

/**
 * Event emitted after a claim is deprecated.
 *
 * @example
 * ```ts
 * import { ClaimDeprecatedEvent } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(ClaimDeprecatedEvent.make)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ClaimDeprecatedEvent = CurationEventDefinition.cases.ClaimDeprecatedEvent.pipe(
  $I.annoteSchema("ClaimDeprecatedEvent", {
    description: "Domain event emitted after an incorrect claim is deprecated.",
    toArbitrary: () => () => S.toArbitrary(CurationEventDefinition.cases.ClaimDeprecatedEvent),
  })
);

/**
 * Event emitted after an entity alias is added.
 *
 * @example
 * ```ts
 * import { AliasAddedEvent } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(AliasAddedEvent.make)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const AliasAddedEvent = CurationEventDefinition.cases.AliasAddedEvent.pipe(
  $I.annoteSchema("AliasAddedEvent", {
    description: "Domain event emitted after a surface-form alias is attached to an entity.",
    toArbitrary: () => () => S.toArbitrary(CurationEventDefinition.cases.AliasAddedEvent),
  })
);

/**
 * Event emitted after a claim is promoted.
 *
 * @example
 * ```ts
 * import { ClaimPromotedEvent } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(ClaimPromotedEvent.make)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ClaimPromotedEvent = CurationEventDefinition.cases.ClaimPromotedEvent.pipe(
  $I.annoteSchema("ClaimPromotedEvent", {
    description: "Domain event emitted after a claim is promoted to preferred rank.",
    toArbitrary: () => () => S.toArbitrary(CurationEventDefinition.cases.ClaimPromotedEvent),
  })
);

/**
 * Event emitted after a Wikidata link is confirmed.
 *
 * @example
 * ```ts
 * import { EntityLinkedEvent } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(EntityLinkedEvent.make)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const EntityLinkedEvent = CurationEventDefinition.cases.EntityLinkedEvent.pipe(
  $I.annoteSchema("EntityLinkedEvent", {
    description: "Domain event emitted after an entity is linked to a Wikidata item.",
    toArbitrary: () => () => S.toArbitrary(CurationEventDefinition.cases.EntityLinkedEvent),
  })
);

/**
 * Tagged union of events emitted by curation actions.
 *
 * @example
 * ```ts
 * import type { CurationEvent } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const eventName = (event: CurationEvent) => event._tag
 * console.log(eventName)
 * ```
 *
 * @category unions
 * @since 0.0.0
 */
export const CurationEvent = CurationEventDefinition.pipe(
  $I.annoteSchema("CurationEvent", {
    description: "Tagged union of events emitted after successful curation actions.",
    toArbitrary: () => () => S.toArbitrary(CurationEventDefinition),
  })
);

/**
 * Runtime event decoded by {@link CurationEvent}.
 *
 * @example
 * ```ts
 * import type { CurationEvent as CurationEventValue } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const eventName = (event: CurationEventValue) => event._tag
 * console.log(eventName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationEvent = typeof CurationEvent.Type;

const CurationJobDefinition = S.TaggedUnion({
  EmbeddingJob: {
    ontologyId: OntologyName,
    canonicalEntityId: S.NonEmptyString,
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
 * @example
 * ```ts
 * import { EmbeddingJob } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(EmbeddingJob.make)
 * ```
 *
 * @category jobs
 * @since 0.0.0
 */
export const EmbeddingJob = CurationJobDefinition.cases.EmbeddingJob.pipe(
  $I.annoteSchema("EmbeddingJob", {
    description: "Asynchronous curation job that re-embeds a canonical entity.",
    toArbitrary: () => () => S.toArbitrary(CurationJobDefinition.cases.EmbeddingJob),
  })
);

/**
 * Update the prompt cache with a curated example.
 *
 * @example
 * ```ts
 * import { PromptCacheJob } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * console.log(PromptCacheJob.make)
 * ```
 *
 * @category jobs
 * @since 0.0.0
 */
export const PromptCacheJob = CurationJobDefinition.cases.PromptCacheJob.pipe(
  $I.annoteSchema("PromptCacheJob", {
    description: "Asynchronous curation job that updates the prompt example cache.",
    toArbitrary: () => () => S.toArbitrary(CurationJobDefinition.cases.PromptCacheJob),
  })
);

/**
 * Tagged union of asynchronous jobs requested by curation.
 *
 * @example
 * ```ts
 * import type { CurationJob } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const jobName = (job: CurationJob) => job._tag
 * console.log(jobName)
 * ```
 *
 * @category unions
 * @since 0.0.0
 */
export const CurationJob = CurationJobDefinition.pipe(
  $I.annoteSchema("CurationJob", {
    description: "Tagged union of embedding and prompt-cache work requested by curation.",
    toArbitrary: () => () => S.toArbitrary(CurationJobDefinition),
  })
);

/**
 * Runtime job decoded by {@link CurationJob}.
 *
 * @example
 * ```ts
 * import type { CurationJob as CurationJobValue } from "@effect-ontology/Schema/CurationAction.ts"
 *
 * const jobName = (job: CurationJobValue) => job._tag
 * console.log(jobName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationJob = typeof CurationJob.Type;
