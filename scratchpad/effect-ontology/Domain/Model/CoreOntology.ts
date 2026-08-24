/**
 * Core ontology vocabulary and persistent tracked-object models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { IRI } from "@beep/rdf";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256HexFromBytes } from "@beep/schema";
import { DateTime, Effect, Order, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { FastCheck } from "effect/testing";
import { ContentHash } from "../Identity.ts";
import { Attributes } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/CoreOntology");
const utf8Encoder = new TextEncoder();

/**
 * Namespace IRI for the experimental core ontology.
 *
 * **Example** (Use CORE_NAMESPACE)
 * ```ts
 * import { CORE_NAMESPACE } from "@effect-ontology/Model/CoreOntology"
 *
 * console.log(CORE_NAMESPACE) // "https://effect-ontology.dev/core#"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CORE_NAMESPACE: IRI = IRI.fromUnknown("https://effect-ontology.dev/core#");

/**
 * Core ontology class IRIs used by tracked objects.
 *
 * **Details**
 *
 * * This deliberately narrow schema replaces the upstream open-ended constants
 * object; it is not intended to become a repository-wide mega-vocabulary.
 *
 * **Example** (Use CoreClass)
 * ```ts
 * import { CoreClass } from "@effect-ontology/Model/CoreOntology"
 *
 * console.log(
 *   CoreClass.is["https://effect-ontology.dev/core#Person"](
 *     "https://effect-ontology.dev/core#Person"
 *   )
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoreClass = LiteralKit([
  "https://effect-ontology.dev/core#TrackedEntity",
  "https://effect-ontology.dev/core#TrackedEvent",
  "https://effect-ontology.dev/core#Mention",
  "https://effect-ontology.dev/core#Person",
  "https://effect-ontology.dev/core#Organization",
  "https://effect-ontology.dev/core#Place",
  "https://effect-ontology.dev/core#Artifact",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "https://effect-ontology.dev/core#TrackedEntity",
        "https://effect-ontology.dev/core#TrackedEvent",
        "https://effect-ontology.dev/core#Mention",
        "https://effect-ontology.dev/core#Person",
        "https://effect-ontology.dev/core#Organization",
        "https://effect-ontology.dev/core#Place",
        "https://effect-ontology.dev/core#Artifact"
      ),
  })
  .annotate(
    $I.annote("CoreClass", {
      description: "Narrow closed set of class IRIs declared by the experimental core ontology.",
    })
  );

/**
 * Runtime value accepted by {@link CoreClass}.
 *
 * **Example** (Use CoreClass)
 * ```ts
 * import type { CoreClass } from "@effect-ontology/Model/CoreOntology"
 *
 * const iri: CoreClass = "https://effect-ontology.dev/core#TrackedEntity"
 * console.log(iri.endsWith("TrackedEntity")) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CoreClass = typeof CoreClass.Type;

/**
 * Core ontology property IRIs used by tracked objects and events.
 *
 * **Example** (Use CoreProperty)
 * ```ts
 * import { CoreProperty } from "@effect-ontology/Model/CoreOntology"
 *
 * console.log(
 *   CoreProperty.is["https://effect-ontology.dev/core#hasParticipant"](
 *     "https://effect-ontology.dev/core#hasParticipant"
 *   )
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoreProperty = LiteralKit([
  "https://effect-ontology.dev/core#hasEvidentialMention",
  "https://effect-ontology.dev/core#mentions",
  "https://effect-ontology.dev/core#hasParticipant",
  "https://effect-ontology.dev/core#isParticipantIn",
  "https://effect-ontology.dev/core#canonicalEntity",
  "https://effect-ontology.dev/core#isCanonicalFormOf",
  "https://effect-ontology.dev/core#mergedFrom",
  "https://effect-ontology.dev/core#wasMergedInto",
  "https://effect-ontology.dev/core#resolutionConfidence",
  "https://effect-ontology.dev/core#hasLocation",
  "https://effect-ontology.dev/core#isLocationOf",
  "https://effect-ontology.dev/core#name",
  "https://effect-ontology.dev/core#description",
  "https://effect-ontology.dev/core#occurrenceTime",
  "https://effect-ontology.dev/core#startTime",
  "https://effect-ontology.dev/core#endTime",
  "https://effect-ontology.dev/core#groundingConfidence",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "https://effect-ontology.dev/core#hasEvidentialMention",
        "https://effect-ontology.dev/core#mentions",
        "https://effect-ontology.dev/core#hasParticipant",
        "https://effect-ontology.dev/core#isParticipantIn",
        "https://effect-ontology.dev/core#canonicalEntity",
        "https://effect-ontology.dev/core#isCanonicalFormOf",
        "https://effect-ontology.dev/core#mergedFrom",
        "https://effect-ontology.dev/core#wasMergedInto",
        "https://effect-ontology.dev/core#resolutionConfidence",
        "https://effect-ontology.dev/core#hasLocation",
        "https://effect-ontology.dev/core#isLocationOf",
        "https://effect-ontology.dev/core#name",
        "https://effect-ontology.dev/core#description",
        "https://effect-ontology.dev/core#occurrenceTime",
        "https://effect-ontology.dev/core#startTime",
        "https://effect-ontology.dev/core#endTime",
        "https://effect-ontology.dev/core#groundingConfidence"
      ),
  })
  .annotate(
    $I.annote("CoreProperty", {
      description: "Narrow closed set of property IRIs declared by the experimental core ontology.",
    })
  );

/**
 * Runtime value accepted by {@link CoreProperty}.
 *
 * **Example** (Use CoreProperty)
 * ```ts
 * import type { CoreProperty } from "@effect-ontology/Model/CoreOntology"
 *
 * const iri: CoreProperty = "https://effect-ontology.dev/core#name"
 * console.log(iri.endsWith("name")) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CoreProperty = typeof CoreProperty.Type;

const mentionIdPattern = /^mention-[a-f0-9]{12}$/;
const canonicalEntityIdPattern = /^(?:entity-[a-f0-9]{12}|[a-z][a-z0-9_]*)$/;
const eventIdPattern = /^event-[a-f0-9]{12}$/;

const digestText = Effect.fn("CoreOntology.digestText")(function* (text: string) {
  return yield* Sha256HexFromBytes.decodeEffect(utf8Encoder.encode(text));
});

const withSeedDerivedIdStatics =
  (operationName: string, prefix: string) =>
  <Schema extends S.Top & { readonly Type: string; readonly "~type.make.in": string }>(schema: Schema) =>
    schema.pipe(
      SchemaUtils.withStatics(() => ({
        fromSeed: Effect.fn(operationName)(function* (seed: string) {
          const digest = yield* digestText(seed);
          return schema.make(`${prefix}-${Str.takeLeft(12)(digest)}`);
        }),
      }))
    );

/**
 * Deterministic identifier for one mention span.
 *
 * **Example** (Use MentionId)
 * ```ts
 * import { Effect } from "effect"
 * import { MentionId } from "@effect-ontology/Model/CoreOntology"
 *
 * console.log(Effect.isEffect(MentionId.fromCoordinates("doc-1", 0, 5))) // true
 * ```
 *
 * @invariant `mention-` followed by exactly 12 lowercase hexadecimal characters.
 * @category identifiers
 * @since 0.0.0
 */
export const MentionId = S.String.check(
  S.isPattern(mentionIdPattern, {
    identifier: $I`MentionIdPatternCheck`,
    title: "Mention Identifier",
    description: "A mention prefix followed by 12 lowercase hexadecimal characters.",
    message: 'Mention identifier must have the form "mention-{12 lowercase hex characters}".',
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(mentionIdPattern),
  })
  .pipe(
    S.brand("MentionId"),
    $I.annoteSchema("MentionId", {
      description: "Deterministic short identifier for one document character span.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromCoordinates: Effect.fn("MentionId.fromCoordinates")(function* (
        documentId: string,
        startOffset: number,
        endOffset: number
      ) {
        const digest = yield* digestText(`${documentId}:${startOffset}:${endOffset}`);
        return schema.make(`mention-${Str.takeLeft(12)(digest)}`);
      }),
    }))
  );

/**
 * Runtime value decoded by {@link MentionId}.
 *
 * **Example** (Use MentionId)
 * ```ts
 * import { MentionId, type MentionId as MentionIdentifier } from "@effect-ontology/Model/CoreOntology"
 *
 * const id: MentionIdentifier = MentionId.make("mention-a1b2c3d4e5f6")
 * console.log(id) // "mention-a1b2c3d4e5f6"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MentionId = typeof MentionId.Type;

const LegacyMentionEvidence = S.Struct({
  text: S.NonEmptyString,
  startOffset: NonNegativeInt,
  endOffset: NonNegativeInt,
});
type LegacyMentionEvidenceValue = typeof LegacyMentionEvidence.Type;

/**
 * Ordered text evidence carried by a core ontology mention.
 *
 * **Example** (Use MentionEvidence)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MentionEvidence } from "@effect-ontology/Model/CoreOntology"
 *
 * const evidence = S.decodeUnknownOption(MentionEvidence)({
 *   text: "Mayor Bruce Harrell",
 *   startOffset: 42,
 *   endOffset: 61
 * })
 * console.log(O.map(evidence, (value) => value.startChar)) // Some(42)
 * ```
 *
 * @invariant The range is non-empty and `endChar - startChar` equals the UTF-16 width of `quote`.
 * @category value-objects
 * @since 0.0.0
 */
export const MentionEvidence = LegacyMentionEvidence.pipe(
  S.decodeTo(TextAnchor, {
    decode: SchemaGetter.transform((evidence: LegacyMentionEvidenceValue): typeof TextAnchor.Encoded => ({
      quote: evidence.text,
      startChar: evidence.startOffset,
      endChar: evidence.endOffset,
    })),
    encode: SchemaGetter.transform(
      (anchor: typeof TextAnchor.Encoded): LegacyMentionEvidenceValue => ({
        text: anchor.quote,
        startOffset: NonNegativeInt.make(anchor.startChar),
        endOffset: NonNegativeInt.make(anchor.endChar),
      })
    ),
  }),
  $I.annoteSchema("MentionEvidence", {
    description: "Legacy mention-evidence ingress decoding to the canonical provenance TextAnchor.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link MentionEvidence}.
 *
 * **Example** (Use MentionEvidence)
 * ```ts
 * import type { MentionEvidence } from "@effect-ontology/Model/CoreOntology"
 *
 * const width = (evidence: MentionEvidence): number =>
 *   evidence.endChar - evidence.startChar
 * console.log(typeof width) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MentionEvidence = typeof MentionEvidence.Type;

/**
 * Text evidence linking a source span to a tracked entity or event.
 *
 * **Example** (Use Mention)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Mention } from "@effect-ontology/Model/CoreOntology"
 *
 * const mention = S.decodeUnknownOption(Mention)({
 *   id: "mention-a1b2c3d4e5f6",
 *   evidence: {
 *     text: "Mayor Bruce Harrell",
 *     startOffset: 42,
 *     endOffset: 61
 *   },
 *   confidence: 0.95,
 *   mentionsEntity: "https://example.org/entity/bruce-harrell"
 * })
 * console.log(O.map(mention, (value) => value.evidence.quote)) // "Mayor Bruce Harrell"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Mention extends S.Class<Mention>($I`Mention`)(
  {
    id: MentionId,
    evidence: MentionEvidence,
    confidence: Confidence,
    mentionsEntity: IRI,
    sourceDocument: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    extractedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Mention", {
    description: "Confidence-scored source evidence referring to a tracked entity or event.",
  })
) {}

/**
 * Stable canonical identifier for a persistent resolved entity.
 *
 * **Example** (Use CanonicalEntityId)
 * ```ts
 * import { Effect } from "effect"
 * import { CanonicalEntityId } from "@effect-ontology/Model/CoreOntology"
 *
 * console.log(Effect.isEffect(CanonicalEntityId.fromSeed("Bruce Harrell"))) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CanonicalEntityId = S.String.check(
  S.isPattern(canonicalEntityIdPattern, {
    identifier: $I`CanonicalEntityIdPatternCheck`,
    title: "Canonical Entity Identifier",
    description: "A short digest identifier or stable snake-case entity identifier.",
    message: 'Canonical entity identifier must be snake_case or have the form "entity-{12 lowercase hex characters}".',
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(canonicalEntityIdPattern),
  })
  .pipe(
    S.brand("CanonicalEntityId"),
    $I.annoteSchema("CanonicalEntityId", {
      description: "Stable canonical identifier for a persistent resolved entity.",
    }),
    SchemaUtils.withCodecStatics,
    withSeedDerivedIdStatics("CanonicalEntityId.fromSeed", "entity")
  );

/**
 * Runtime value decoded by {@link CanonicalEntityId}.
 *
 * **Example** (Use CanonicalEntityId)
 * ```ts
 * import {
 *   CanonicalEntityId,
 *   type CanonicalEntityId as CanonicalIdentifier
 * } from "@effect-ontology/Model/CoreOntology"
 *
 * const id: CanonicalIdentifier = CanonicalEntityId.make("bruce_harrell")
 * console.log(id) // "bruce_harrell"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityId = typeof CanonicalEntityId.Type;

/**
 * Persistent canonical entity tracked across source documents.
 *
 * **Example** (Use TrackedEntity)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TrackedEntity } from "@effect-ontology/Model/CoreOntology"
 *
 * const entity = S.decodeUnknownOption(TrackedEntity)({
 *   id: "bruce_harrell",
 *   iri: "https://example.org/entity/bruce-harrell",
 *   name: "Bruce Harrell",
 *   types: ["https://schema.org/Person"]
 * })
 * console.log(O.map(entity, (value) => value.isResolved)) // false
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrackedEntity extends S.Class<TrackedEntity>($I`TrackedEntity`)(
  {
    id: CanonicalEntityId,
    iri: IRI,
    name: S.NonEmptyString,
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    types: S.NonEmptyArray(IRI),
    attributes: Attributes.pipe(SchemaUtils.withKeyDefaults({})),
    groundingConfidence: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
    resolutionConfidence: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
    mergedFrom: S.Array(IRI).pipe(SchemaUtils.withEmptyArrayDefaults<IRI>()),
    location: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    externalIds: S.Record(S.String, S.NonEmptyString).pipe(SchemaUtils.withKeyDefaults({})),
  },
  $I.annote("TrackedEntity", {
    description: "Persistent canonical entity with ontology types, confidence, merges, and links.",
  })
) {
  /**
   * Whether at least one other entity was merged into this canonical form.
   *
   * **Example** (Use EventId)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { TrackedEntity } from "@effect-ontology/Model/CoreOntology"
   *
   * const entity = S.decodeUnknownOption(TrackedEntity)({
   *   id: "alice",
   *   iri: "https://example.org/entity/alice",
   *   name: "Alice",
   *   types: ["https://schema.org/Person"]
   * })
   * console.log(O.map(entity, (value) => value.isResolved)) // false
   * ```
   *
   * @returns `true` when the merged-source collection is non-empty.
   */
  get isResolved(): boolean {
    return A.isReadonlyArrayNonEmpty(this.mergedFrom);
  }
}

/**
 * Stable deterministic identifier for a tracked event.
 *
 * **Example** (Use EventId)
 * ```ts
 * import { Effect } from "effect"
 * import { EventId } from "@effect-ontology/Model/CoreOntology"
 *
 * console.log(Effect.isEffect(EventId.fromSeed("announcement-2026-07-25"))) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EventId = S.String.check(
  S.isPattern(eventIdPattern, {
    identifier: $I`EventIdPatternCheck`,
    title: "Event Identifier",
    description: "An event prefix followed by 12 lowercase hexadecimal characters.",
    message: 'Event identifier must have the form "event-{12 lowercase hex characters}".',
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(eventIdPattern),
  })
  .pipe(
    S.brand("EventId"),
    $I.annoteSchema("EventId", {
      description: "Stable deterministic short identifier for a tracked event.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type => schema.make(`event-${ContentHash.idFragment(hash)}`),
    })),
    withSeedDerivedIdStatics("EventId.fromSeed", "event")
  );

/**
 * Runtime value decoded by {@link EventId}.
 *
 * **Example** (Use EventId)
 * ```ts
 * import { EventId, type EventId as EventIdentifier } from "@effect-ontology/Model/CoreOntology"
 *
 * const id: EventIdentifier = EventId.make("event-a1b2c3d4e5f6")
 * console.log(id) // "event-a1b2c3d4e5f6"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventId = typeof EventId.Type;

/**
 * Tracked entity participating in an event, with an optional ontology role.
 *
 * **Example** (Use Participant)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Participant } from "@effect-ontology/Model/CoreOntology"
 *
 * const participant = S.decodeUnknownOption(Participant)({
 *   entityIri: "https://example.org/entity/bruce-harrell"
 * })
 * console.log(O.map(participant, (value) => value.entityIri)) // "https://example.org/entity/bruce-harrell"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Participant extends S.Class<Participant>($I`Participant`)(
  {
    entityIri: IRI,
    role: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Participant", {
    description: "Entity participation in an event with an optional ontology-defined role.",
  })
) {}

class EventIntervalFieldsModel extends S.Class<EventIntervalFieldsModel>($I`EventIntervalFieldsModel`)(
  {
    start: S.DateTimeUtcFromString,
    end: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("EventIntervalFieldsModel", {
    description: "Internal field model for a start and optional end instant.",
  })
) {}

const makeEventIntervalArbitrary = (fc: typeof FastCheck) =>
  S.toArbitrary(S.DateTimeUtcFromString)(fc).chain((start) =>
    fc.boolean().map((hasEnd) =>
      EventIntervalFieldsModel.make({
        start,
        end: hasEnd ? O.some(start) : O.none(),
      })
    )
  );

const isNotAfter = Order.isLessThanOrEqualTo(DateTime.Order);

const EventIntervalDefinition = EventIntervalFieldsModel.check(
  S.makeFilter(
    (interval: EventIntervalFieldsModel) =>
      O.match(interval.end, {
        onNone: () => undefined,
        onSome: (end) =>
          isNotAfter(interval.start, end)
            ? undefined
            : {
                path: ["end"],
                issue: "end must not precede start.",
              },
      }),
    {
      identifier: $I`EventIntervalOrderCheck`,
      title: "Event Interval Order",
      description: "An event interval whose optional end does not precede its start.",
      message: "Event interval end must be greater than or equal to its start.",
      arbitrary: {
        candidate: {
          make: makeEventIntervalArbitrary,
        },
      },
    }
  )
);

/**
 * Ordered start and optional end instant for a duration event.
 *
 * **Example** (Use EventInterval)
 * ```ts
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EventInterval } from "@effect-ontology/Model/CoreOntology"
 *
 * const now = DateTime.nowUnsafe()
 * const encodedNow = DateTime.formatIso(now)
 * const interval = S.decodeUnknownOption(EventInterval)({ start: encodedNow, end: encodedNow })
 * console.log(O.map(interval, (value) => DateTime.toEpochMillis(value.start) <= DateTime.toEpochMillis(now)))
 * ```
 *
 * @invariant The optional end instant never precedes the start instant.
 * @category value-objects
 * @since 0.0.0
 */
export const EventInterval = EventIntervalDefinition.annotate({
  toArbitrary: () => makeEventIntervalArbitrary,
}).pipe(
  $I.annoteSchema("EventInterval", {
    description: "Ordered event start and optional end instants.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link EventInterval}.
 *
 * **Example** (Use EventInterval)
 * ```ts
 * import type { EventInterval } from "@effect-ontology/Model/CoreOntology"
 *
 * const hasEnd = (interval: EventInterval): boolean => interval.end._tag === "Some"
 * console.log(typeof hasEnd) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventInterval = typeof EventInterval.Type;

const EventTimeDefinition = S.TaggedUnion({
  Unspecified: {},
  Instant: { value: S.DateTimeUtcFromString },
  Interval: { value: EventInterval },
});

/**
 * Explicit temporal grounding for a tracked event.
 *
 * **Example** (Use EventTime)
 * ```ts
 * import { EventTime } from "@effect-ontology/Model/CoreOntology"
 *
 * const time = EventTime.cases.Unspecified.make({})
 * console.log(time._tag) // "Unspecified"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EventTime = EventTimeDefinition.pipe(
  $I.annoteSchema("EventTime", {
    description: "Unspecified, instant, or interval temporal grounding for a tracked event.",
    toArbitrary: () => S.toArbitrary(EventTimeDefinition),
  })
);

/**
 * Runtime value decoded by {@link EventTime}.
 *
 * **Example** (Use EventTime)
 * ```ts
 * import type { EventTime } from "@effect-ontology/Model/CoreOntology"
 *
 * const time: EventTime = { _tag: "Unspecified" }
 * console.log(time._tag) // "Unspecified"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventTime = typeof EventTime.Type;

/**
 * Persistent ontology-typed occurrence involving tracked entities.
 *
 * **Example** (Use TrackedEvent)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TrackedEvent } from "@effect-ontology/Model/CoreOntology"
 *
 * const event = S.decodeUnknownOption(TrackedEvent)({
 *   id: "event-a1b2c3d4e5f6",
 *   iri: "https://example.org/event/announcement",
 *   types: ["https://schema.org/Event"]
 * })
 * console.log(O.map(event, (value) => value.hasTemporalGrounding)) // false
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrackedEvent extends S.Class<TrackedEvent>($I`TrackedEvent`)(
  {
    id: EventId,
    iri: IRI,
    types: S.NonEmptyArray(IRI),
    time: EventTime.pipe(SchemaUtils.withKeyDefaults(EventTime.cases.Unspecified.make({}))),
    participants: S.Array(Participant).pipe(SchemaUtils.withEmptyArrayDefaults<Participant>()),
    location: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    attributes: Attributes.pipe(SchemaUtils.withKeyDefaults({})),
    groundingConfidence: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("TrackedEvent", {
    description: "Persistent ontology-typed event with explicit time, participants, location, and confidence.",
  })
) {
  /**
   * Whether this event has an explicit instant or interval.
   *
   * **Example** (Use CoreOperationErrorFields)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { TrackedEvent } from "@effect-ontology/Model/CoreOntology"
   *
   * const event = S.decodeUnknownOption(TrackedEvent)({
   *   id: "event-a1b2c3d4e5f6",
   *   iri: "https://example.org/event/announcement",
   *   types: ["https://schema.org/Event"]
   * })
   * console.log(O.map(event, (value) => value.hasTemporalGrounding)) // false
   * ```
   *
   * @returns `false` only for the explicit `Unspecified` time variant.
   */
  get hasTemporalGrounding(): boolean {
    return !EventTime.guards.Unspecified(this.time);
  }
}

const CoreOperationErrorFields = {
  message: S.NonEmptyString,
  cause: S.OptionFromOptionalKey(S.Json).pipe(SchemaUtils.withNoneDefault),
};

/**
 * Failure while constructing or persisting mention evidence.
 *
 * **Example** (Use MentionError)
 * ```ts
 * import { MentionError } from "@effect-ontology/Model/CoreOntology"
 *
 * const error = MentionError.make({ message: "Mention offsets are invalid." })
 * console.log(error._tag) // "MentionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MentionError extends S.TaggedError<MentionError>($I`MentionError`)(
  "MentionError",
  CoreOperationErrorFields,
  $I.annote("MentionError", {
    description: "Typed failure while constructing or persisting mention evidence.",
  })
) {}

/**
 * Failure while resolving or persisting a tracked entity.
 *
 * **Example** (Use TrackedEntityError)
 * ```ts
 * import { TrackedEntityError } from "@effect-ontology/Model/CoreOntology"
 *
 * const error = TrackedEntityError.make({ message: "Canonical entity was not found." })
 * console.log(error._tag) // "TrackedEntityError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TrackedEntityError extends S.TaggedError<TrackedEntityError>($I`TrackedEntityError`)(
  "TrackedEntityError",
  CoreOperationErrorFields,
  $I.annote("TrackedEntityError", {
    description: "Typed failure while resolving or persisting a tracked entity.",
  })
) {}

/**
 * Failure while grounding or persisting a tracked event.
 *
 * **Example** (Use TrackedEventError)
 * ```ts
 * import { TrackedEventError } from "@effect-ontology/Model/CoreOntology"
 *
 * const error = TrackedEventError.make({ message: "Event interval is invalid." })
 * console.log(error._tag) // "TrackedEventError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TrackedEventError extends S.TaggedError<TrackedEventError>($I`TrackedEventError`)(
  "TrackedEventError",
  CoreOperationErrorFields,
  $I.annote("TrackedEventError", {
    description: "Typed failure while grounding or persisting a tracked event.",
  })
) {}
