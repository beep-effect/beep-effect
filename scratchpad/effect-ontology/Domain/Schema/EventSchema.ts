/**
 * Effect v4 EventLog groups for curation and extraction events.
 *
 * **Details**
 *
 * * Payload schemas are the event-journal boundary: they normalize optional
 * values, constrain counts and identities, and carry explicit arbitraries
 * before EventLog persistence or remote distribution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { NamedNode } from "@beep/rdf";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import * as Event from "effect/unstable/eventlog/Event";
import * as EventGroup from "effect/unstable/eventlog/EventGroup";
import { BatchId, GcsUri, OntologyName } from "../Identity.ts";
import { BatchState } from "../Model/index.ts";
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
  toArbitrary: () => S.toArbitrary(ClaimCorrectedPayloadDefinition),
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
  toArbitrary: () => S.toArbitrary(ClaimDeprecatedPayloadDefinition),
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
  toArbitrary: () => S.toArbitrary(AliasAddedPayloadDefinition),
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
  toArbitrary: () => S.toArbitrary(ClaimPromotedPayloadDefinition),
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
  toArbitrary: () => S.toArbitrary(EntityLinkedPayloadDefinition),
}).pipe(
  $I.annoteSchema("EntityLinkedPayload", {
    description: "Journal payload recording a confirmed link from a canonical entity to Wikidata.",
  })
);

/**
 * EventLog definitions emitted after successful curation operations.
 *
 * **Details**
 *
 * * Primary keys encode the ontology scope and affected domain identity, making
 * replay idempotency stable across retries of the same curation result.
 *
 * **Example** (Use CurationEventGroup)
 * ```ts
 * import { CurationEventGroup } from "@effect-ontology/Schema/EventSchema"
 *
 * console.log(Object.keys(CurationEventGroup.events).length) // 5
 * ```
 *
 * @category events
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
    primaryKey: (payload) => `${payload.ontologyId}:link:${payload.canonicalEntity}:${payload.wikidataQid}`,
    payload: EntityLinkedPayload,
  });

/**
 * Event definitions contained by {@link CurationEventGroup}.
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
  toArbitrary: () => S.toArbitrary(ExtractionCompletedPayloadDefinition),
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
  toArbitrary: () => S.toArbitrary(ValidationFailedPayloadDefinition),
}).pipe(
  $I.annoteSchema("ValidationFailedPayload", {
    description: "Journal payload summarizing failed validation and its optional report artifact.",
  })
);

type BatchStateChangedPayloadFields = {
  readonly batchId: typeof BatchId;
  readonly ontologyId: typeof OntologyName;
  readonly state: typeof BatchState;
  readonly timestamp: typeof S.DateTimeUtcFromString;
};

const BatchStateChangedPayloadDefinition: S.Struct<BatchStateChangedPayloadFields> = S.Struct({
  batchId: BatchId,
  ontologyId: OntologyName,
  state: BatchState,
  timestamp: S.DateTimeUtcFromString,
});
const BatchStateChangedPayload: typeof BatchStateChangedPayloadDefinition =
  BatchStateChangedPayloadDefinition.annotate({
    toArbitrary: () => S.toArbitrary(BatchStateChangedPayloadDefinition),
  }).pipe(
    $I.annoteSchema("BatchStateChangedPayload", {
      description: "Journal payload carrying the complete schema-validated batch workflow state.",
    })
  );

const EventEntryFields = {
  id: S.NonEmptyString,
  primaryKey: S.NonEmptyString,
  createdAt: S.DateTimeUtc,
};

const ClaimCorrectedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("ClaimCorrected"),
  payload: ClaimCorrectedPayload,
});
const ClaimDeprecatedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("ClaimDeprecated"),
  payload: ClaimDeprecatedPayload,
});
const AliasAddedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("AliasAdded"),
  payload: AliasAddedPayload,
});
const ClaimPromotedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("ClaimPromoted"),
  payload: ClaimPromotedPayload,
});
const EntityLinkedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("EntityLinked"),
  payload: EntityLinkedPayload,
});
const ExtractionCompletedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("ExtractionCompleted"),
  payload: ExtractionCompletedPayload,
});
const ValidationFailedEventEntry = S.Struct({
  ...EventEntryFields,
  event: S.tag("ValidationFailed"),
  payload: ValidationFailedPayload,
});
type BatchStateChangedEventEntryCodec = S.Struct<
  typeof EventEntryFields & {
    readonly event: S.tag<"BatchStateChanged">;
    readonly payload: typeof BatchStateChangedPayload;
  }
>;

const BatchStateChangedEventEntry: BatchStateChangedEventEntryCodec = S.Struct({
  ...EventEntryFields,
  event: S.tag("BatchStateChanged"),
  payload: BatchStateChangedPayload,
});

type OntologyEventEntryMembers = readonly [
  typeof ClaimCorrectedEventEntry,
  typeof ClaimDeprecatedEventEntry,
  typeof AliasAddedEventEntry,
  typeof ClaimPromotedEventEntry,
  typeof EntityLinkedEventEntry,
  typeof ExtractionCompletedEventEntry,
  typeof ValidationFailedEventEntry,
  typeof BatchStateChangedEventEntry,
];

const OntologyEventEntryDefinition: S.toTaggedUnion<"event", OntologyEventEntryMembers> = S.Union([
  ClaimCorrectedEventEntry,
  ClaimDeprecatedEventEntry,
  AliasAddedEventEntry,
  ClaimPromotedEventEntry,
  EntityLinkedEventEntry,
  ExtractionCompletedEventEntry,
  ValidationFailedEventEntry,
  BatchStateChangedEventEntry,
]).pipe(S.toTaggedUnion("event"));

type OntologyEventEntryCodec = S.Codec<
  typeof OntologyEventEntryDefinition.Type,
  typeof OntologyEventEntryDefinition.Encoded
>;

/**
 * Canonical journal entry pairing every ontology event tag with its payload schema.
 *
 * **Example** (Inspect canonical ontology event cases)
 * ```ts
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyEventEntry } from "@effect-ontology/Schema/EventSchema"
 *
 * const entry = S.decodeUnknownOption(OntologyEventEntry)({
 *   id: "evt-claim-corrected-1",
 *   primaryKey: "football:correction:claim-abc123def456",
 *   createdAt: DateTime.makeUnsafe("2026-07-25T12:00:00.000Z"),
 *   event: "ClaimCorrected",
 *   payload: {
 *     ontologyId: "football",
 *     originalClaimId: "claim-abc123def456",
 *     newClaimId: "claim-def456abc123",
 *     correctionId: "corr-1",
 *     timestamp: "2026-07-25T12:00:00.000Z"
 *   }
 * })
 * console.log(O.map(entry, (value) => value.event)) // Some("ClaimCorrected")
 * console.log(O.map(entry, (value) => value.primaryKey)) // Some("football:correction:claim-abc123def456")
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const OntologyEventEntry: ReturnType<
  typeof SchemaUtils.withEffectCodecStatics<OntologyEventEntryCodec>
> = OntologyEventEntryDefinition.pipe(
  SchemaUtils.withEffectCodecStatics,
  $I.annoteSchema("OntologyEventEntry", {
    description: "Schema-validated journal entry whose event tag determines its canonical payload.",
    toArbitrary: () => S.toArbitrary(OntologyEventEntryDefinition),
  })
);

/**
 * Runtime journal entry decoded by {@link OntologyEventEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyEventEntry = typeof OntologyEventEntry.Type;

type ExtractionEventDefinition =
  | Event.Event<"ExtractionCompleted", typeof ExtractionCompletedPayload>
  | Event.Event<"ValidationFailed", typeof ValidationFailedPayload>
  | Event.Event<"BatchStateChanged", typeof BatchStateChangedPayload>;

/**
 * EventLog definitions emitted by extraction and batch workflows.
 *
 * **Example** (Use ExtractionEventGroup)
 * ```ts
 * import { ExtractionEventGroup } from "@effect-ontology/Schema/EventSchema"
 *
 * console.log(Object.keys(ExtractionEventGroup.events).length) // 3
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ExtractionEventGroup: EventGroup.EventGroup<ExtractionEventDefinition> = EventGroup.empty
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
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionEvent = ExtractionEventDefinition;

/**
 * Immutable tuple of all effect-ontology EventLog groups.
 *
 * **Example** (Use OntologyEventGroups)
 * ```ts
 * import { OntologyEventGroups } from "@effect-ontology/Schema/EventSchema"
 *
 * console.log(OntologyEventGroups.length) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OntologyEventGroups: readonly [typeof CurationEventGroup, typeof ExtractionEventGroup] = Tuple.make(
  CurationEventGroup,
  ExtractionEventGroup
);

/**
 * Union of every effect-ontology EventLog event definition.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyEvent = CurationEvent | ExtractionEvent;
