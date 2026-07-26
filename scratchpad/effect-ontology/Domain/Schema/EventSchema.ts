/**
 * Effect v4 EventLog groups for curation and extraction events.
 *
 * @remarks
 * Payload schemas are the event-journal boundary: they normalize optional
 * values, constrain counts and identities, and carry explicit arbitraries
 * before EventLog persistence or remote distribution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import * as EventGroup from "effect/unstable/eventlog/EventGroup";
import { BatchId, GcsUri, OntologyName } from "../Identity.ts";
import { BatchState } from "../Model/BatchWorkflow.ts";
import { Confidence } from "../Model/shared.ts";
import { NamedNode } from "../Rdf/Types.ts";
import { ClaimId } from "./KnowledgeModel.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/EventSchema");

const ClaimCorrectedPayloadDefinition = S.Struct({
  ontologyId: OntologyName,
  originalClaimId: ClaimId,
  newClaimId: ClaimId,
  correctionId: S.NonEmptyString,
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
});
const ClaimCorrectedPayload = ClaimCorrectedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(ClaimCorrectedPayloadDefinition),
}).pipe(
  $I.annoteSchema("ClaimCorrectedPayload", {
    description: "Journal payload linking an original claim to its curated replacement.",
  })
);

const ClaimDeprecatedPayloadDefinition = S.Struct({
  ontologyId: OntologyName,
  claimId: ClaimId,
  reason: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  negativeExampleId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
});
const ClaimDeprecatedPayload = ClaimDeprecatedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(ClaimDeprecatedPayloadDefinition),
}).pipe(
  $I.annoteSchema("ClaimDeprecatedPayload", {
    description: "Journal payload recording claim deprecation and an optional negative-example artifact.",
  })
);

const AliasAddedPayloadDefinition = S.Struct({
  ontologyId: OntologyName,
  canonicalEntity: NamedNode,
  aliasMention: S.NonEmptyString,
  aliasId: S.NonEmptyString,
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
});
const AliasAddedPayload = AliasAddedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(AliasAddedPayloadDefinition),
}).pipe(
  $I.annoteSchema("AliasAddedPayload", {
    description: "Journal payload recording a new surface-form alias for a canonical RDF entity.",
  })
);

const ClaimPromotedPayloadDefinition = S.Struct({
  ontologyId: OntologyName,
  claimId: ClaimId,
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
});
const ClaimPromotedPayload = ClaimPromotedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(ClaimPromotedPayloadDefinition),
}).pipe(
  $I.annoteSchema("ClaimPromotedPayload", {
    description: "Journal payload recording promotion of one claim to preferred rank.",
  })
);

const EntityLinkedPayloadDefinition = S.Struct({
  ontologyId: OntologyName,
  canonicalEntity: NamedNode,
  wikidataQid: S.NonEmptyString,
  reconciliationScore: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
  curatorId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
});
const EntityLinkedPayload = EntityLinkedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(EntityLinkedPayloadDefinition),
}).pipe(
  $I.annoteSchema("EntityLinkedPayload", {
    description: "Journal payload recording a confirmed link from a canonical entity to Wikidata.",
  })
);

/**
 * EventLog definitions emitted after successful curation operations.
 *
 * @remarks
 * Primary keys encode the ontology scope and affected domain identity, making
 * replay idempotency stable across retries of the same curation result.
 *
 * @example
 * ```ts
 * import { CurationEventGroup } from "@effect-ontology/Schema/EventSchema.ts"
 *
 * console.log(Object.keys(CurationEventGroup.events).length) // 5
 * ```
 *
 * @category event-groups
 * @since 0.0.0
 */
export const CurationEventGroup = EventGroup.empty
  .add({
    tag: "ClaimCorrected",
    primaryKey: (payload) => `${payload.ontologyId}:correction:${payload.originalClaimId}`,
    payload: ClaimCorrectedPayload,
  })
  .add({
    tag: "ClaimDeprecated",
    primaryKey: (payload) => `${payload.ontologyId}:deprecation:${payload.claimId}`,
    payload: ClaimDeprecatedPayload,
  })
  .add({
    tag: "AliasAdded",
    primaryKey: (payload) => `${payload.ontologyId}:alias:${payload.aliasId}`,
    payload: AliasAddedPayload,
  })
  .add({
    tag: "ClaimPromoted",
    primaryKey: (payload) => `${payload.ontologyId}:promotion:${payload.claimId}`,
    payload: ClaimPromotedPayload,
  })
  .add({
    tag: "EntityLinked",
    primaryKey: (payload) => `${payload.ontologyId}:link:${payload.canonicalEntity.value}:${payload.wikidataQid}`,
    payload: EntityLinkedPayload,
  });

/**
 * Event definitions contained by {@link CurationEventGroup}.
 *
 * @example
 * ```ts
 * import type { CurationEvent } from "@effect-ontology/Schema/EventSchema.ts"
 *
 * const acceptEvent = (_event: CurationEvent) => undefined
 * console.log(acceptEvent)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurationEvent = EventGroup.Events<typeof CurationEventGroup>;

const ExtractionOutcome = LiteralKit(["success", "partial", "failed"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("success", "partial", "failed"),
  })
  .annotate(
    $I.annote("ExtractionOutcome", {
      description: "Terminal extraction outcome stored in an EventLog payload.",
    })
  );

const ExtractionCompletedPayloadDefinition = S.Struct({
  batchId: BatchId,
  ontologyId: OntologyName,
  entityCount: NonNegativeInt,
  relationCount: NonNegativeInt,
  tripleCount: NonNegativeInt,
  outputUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
  status: ExtractionOutcome,
  timestamp: S.DateTimeUtcFromString,
});
const ExtractionCompletedPayload = ExtractionCompletedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(ExtractionCompletedPayloadDefinition),
}).pipe(
  $I.annoteSchema("ExtractionCompletedPayload", {
    description: "Journal payload summarizing a terminal extraction outcome and its optional output artifact.",
  })
);

const ValidationFailedPayloadDefinition = S.Struct({
  batchId: BatchId,
  validationId: S.NonEmptyString,
  ontologyId: OntologyName,
  errorCount: NonNegativeInt,
  warningCount: NonNegativeInt,
  reportUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
  timestamp: S.DateTimeUtcFromString,
});
const ValidationFailedPayload = ValidationFailedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(ValidationFailedPayloadDefinition),
}).pipe(
  $I.annoteSchema("ValidationFailedPayload", {
    description: "Journal payload summarizing failed validation and its optional report artifact.",
  })
);

const BatchStateChangedPayloadDefinition = S.Struct({
  batchId: BatchId,
  ontologyId: OntologyName,
  state: BatchState,
  timestamp: S.DateTimeUtcFromString,
});
const BatchStateChangedPayload = BatchStateChangedPayloadDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(BatchStateChangedPayloadDefinition),
}).pipe(
  $I.annoteSchema("BatchStateChangedPayload", {
    description: "Journal payload carrying the complete schema-validated batch workflow state.",
  })
);

/**
 * EventLog definitions emitted by extraction and batch workflows.
 *
 * @example
 * ```ts
 * import { ExtractionEventGroup } from "@effect-ontology/Schema/EventSchema.ts"
 *
 * console.log(Object.keys(ExtractionEventGroup.events).length) // 3
 * ```
 *
 * @category event-groups
 * @since 0.0.0
 */
export const ExtractionEventGroup = EventGroup.empty
  .add({
    tag: "ExtractionCompleted",
    primaryKey: (payload) => `extraction:${payload.batchId}`,
    payload: ExtractionCompletedPayload,
  })
  .add({
    tag: "ValidationFailed",
    primaryKey: (payload) => `validation:${payload.batchId}:${payload.validationId}`,
    payload: ValidationFailedPayload,
  })
  .add({
    tag: "BatchStateChanged",
    primaryKey: (payload) => `batch:${payload.batchId}`,
    payload: BatchStateChangedPayload,
  });

/**
 * Event definitions contained by {@link ExtractionEventGroup}.
 *
 * @example
 * ```ts
 * import type { ExtractionEvent } from "@effect-ontology/Schema/EventSchema.ts"
 *
 * const acceptEvent = (_event: ExtractionEvent) => undefined
 * console.log(acceptEvent)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionEvent = EventGroup.Events<typeof ExtractionEventGroup>;

/**
 * Immutable tuple of all effect-ontology EventLog groups.
 *
 * @example
 * ```ts
 * import { OntologyEventGroups } from "@effect-ontology/Schema/EventSchema.ts"
 *
 * console.log(OntologyEventGroups.length) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OntologyEventGroups = Tuple.make(CurationEventGroup, ExtractionEventGroup);

/**
 * Union of every effect-ontology EventLog event definition.
 *
 * @example
 * ```ts
 * import type { OntologyEvent } from "@effect-ontology/Schema/EventSchema.ts"
 *
 * const acceptEvent = (_event: OntologyEvent) => undefined
 * console.log(acceptEvent)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyEvent = CurationEvent | ExtractionEvent;
