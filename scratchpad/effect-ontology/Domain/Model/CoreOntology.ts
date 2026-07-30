/**
 * Core ontology vocabulary and persistent tracked-object models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256HexFromBytes, TaggedErrorClass } from "@beep/schema";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { FastCheck } from "effect/testing";
import { Attributes, Confidence, IRI } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/CoreOntology");
const utf8Encoder = new TextEncoder();

/**
 * Namespace IRI for the experimental core ontology.
 *
 * @example
 * ```ts
 * import { CORE_NAMESPACE } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * console.log(CORE_NAMESPACE) // "http://effect-ontology.dev/core#"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CORE_NAMESPACE: IRI = IRI.fromUnknown("http://effect-ontology.dev/core#");

/**
 * Core ontology class IRIs used by tracked objects.
 *
 * @remarks
 * This deliberately narrow schema replaces the upstream open-ended constants
 * object; it is not intended to become a repository-wide mega-vocabulary.
 *
 * @example
 * ```ts
 * import { CoreClass } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * console.log(
 *   CoreClass.is["http://effect-ontology.dev/core#Person"](
 *     "http://effect-ontology.dev/core#Person"
 *   )
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoreClass = LiteralKit([
  "http://effect-ontology.dev/core#TrackedEntity",
  "http://effect-ontology.dev/core#TrackedEvent",
  "http://effect-ontology.dev/core#Mention",
  "http://effect-ontology.dev/core#Person",
  "http://effect-ontology.dev/core#Organization",
  "http://effect-ontology.dev/core#Place",
  "http://effect-ontology.dev/core#Artifact",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "http://effect-ontology.dev/core#TrackedEntity",
        "http://effect-ontology.dev/core#TrackedEvent",
        "http://effect-ontology.dev/core#Mention",
        "http://effect-ontology.dev/core#Person",
        "http://effect-ontology.dev/core#Organization",
        "http://effect-ontology.dev/core#Place",
        "http://effect-ontology.dev/core#Artifact"
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
 * @example
 * ```ts
 * import type { CoreClass } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const iri: CoreClass = "http://effect-ontology.dev/core#TrackedEntity"
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
 * @example
 * ```ts
 * import { CoreProperty } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * console.log(
 *   CoreProperty.is["http://effect-ontology.dev/core#hasParticipant"](
 *     "http://effect-ontology.dev/core#hasParticipant"
 *   )
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoreProperty = LiteralKit([
  "http://effect-ontology.dev/core#hasEvidentialMention",
  "http://effect-ontology.dev/core#mentions",
  "http://effect-ontology.dev/core#hasParticipant",
  "http://effect-ontology.dev/core#isParticipantIn",
  "http://effect-ontology.dev/core#canonicalEntity",
  "http://effect-ontology.dev/core#isCanonicalFormOf",
  "http://effect-ontology.dev/core#mergedFrom",
  "http://effect-ontology.dev/core#wasMergedInto",
  "http://effect-ontology.dev/core#resolutionConfidence",
  "http://effect-ontology.dev/core#hasLocation",
  "http://effect-ontology.dev/core#isLocationOf",
  "http://effect-ontology.dev/core#name",
  "http://effect-ontology.dev/core#description",
  "http://effect-ontology.dev/core#occurrenceTime",
  "http://effect-ontology.dev/core#startTime",
  "http://effect-ontology.dev/core#endTime",
  "http://effect-ontology.dev/core#groundingConfidence",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "http://effect-ontology.dev/core#hasEvidentialMention",
        "http://effect-ontology.dev/core#mentions",
        "http://effect-ontology.dev/core#hasParticipant",
        "http://effect-ontology.dev/core#isParticipantIn",
        "http://effect-ontology.dev/core#canonicalEntity",
        "http://effect-ontology.dev/core#isCanonicalFormOf",
        "http://effect-ontology.dev/core#mergedFrom",
        "http://effect-ontology.dev/core#wasMergedInto",
        "http://effect-ontology.dev/core#resolutionConfidence",
        "http://effect-ontology.dev/core#hasLocation",
        "http://effect-ontology.dev/core#isLocationOf",
        "http://effect-ontology.dev/core#name",
        "http://effect-ontology.dev/core#description",
        "http://effect-ontology.dev/core#occurrenceTime",
        "http://effect-ontology.dev/core#startTime",
        "http://effect-ontology.dev/core#endTime",
        "http://effect-ontology.dev/core#groundingConfidence"
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
 * @example
 * ```ts
 * import type { CoreProperty } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const iri: CoreProperty = "http://effect-ontology.dev/core#name"
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
  return yield* S.decodeUnknownEffect(Sha256HexFromBytes)(utf8Encoder.encode(text));
});

/**
 * Deterministic identifier for one mention span.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { MentionId } from "@effect-ontology/Model/CoreOntology.ts"
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
 * @example
 * ```ts
 * import { MentionId, type MentionId as MentionIdentifier } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const id: MentionIdentifier = MentionId.make("mention-a1b2c3d4e5f6")
 * console.log(id) // "mention-a1b2c3d4e5f6"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MentionId = typeof MentionId.Type;

const MentionEvidenceFields = {
  text: S.NonEmptyString,
  startOffset: NonNegativeInt,
  endOffset: NonNegativeInt,
} as const;

class MentionEvidenceFieldsModel extends S.Class<MentionEvidenceFieldsModel>($I`MentionEvidenceFieldsModel`)(
  MentionEvidenceFields,
  $I.annote("MentionEvidenceFieldsModel", {
    description: "Internal field model for an ordered text-mention span.",
  })
) {}

const makeMentionEvidenceArbitrary = (fc: typeof FastCheck) =>
  fc
    .record({
      text: fc.string({ minLength: 1, maxLength: 128 }),
      startOffset: fc.integer({ min: 0, max: 100_000 }),
      width: fc.integer({ min: 0, max: 10_000 }),
    })
    .map(({ text, startOffset, width }) =>
      MentionEvidenceFieldsModel.make({
        text,
        startOffset: NonNegativeInt.make(startOffset),
        endOffset: NonNegativeInt.make(startOffset + width),
      })
    );

const MentionEvidenceDefinition = MentionEvidenceFieldsModel.check(
  S.makeFilter(
    (evidence: MentionEvidenceFieldsModel) =>
      evidence.endOffset >= evidence.startOffset
        ? undefined
        : {
            path: ["endOffset"],
            issue: "endOffset must be greater than or equal to startOffset.",
          },
    {
      identifier: $I`MentionEvidenceOffsetOrderCheck`,
      title: "Mention Evidence Offset Order",
      description: "A text mention whose exclusive end offset does not precede its start offset.",
      message: "Mention evidence end offset must be greater than or equal to its start offset.",
      arbitrary: {
        candidate: {
          make: makeMentionEvidenceArbitrary,
        },
      },
    }
  )
);

/**
 * Ordered text evidence carried by a core ontology mention.
 *
 * @example
 * ```ts
 * import { MentionEvidence } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const evidence = MentionEvidence.fromUnknown({
 *   text: "Mayor Bruce Harrell",
 *   startOffset: 42,
 *   endOffset: 61
 * })
 * console.log(evidence.startOffset) // 42
 * ```
 *
 * @invariant `0 <= startOffset <= endOffset`.
 * @category value-objects
 * @since 0.0.0
 */
export const MentionEvidence = MentionEvidenceDefinition.annotate({
  toArbitrary: () => makeMentionEvidenceArbitrary,
}).pipe(
  $I.annoteSchema("MentionEvidence", {
    description: "Non-empty ordered text span retained as mention evidence.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link MentionEvidence}.
 *
 * @example
 * ```ts
 * import type { MentionEvidence } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const width = (evidence: MentionEvidence): number =>
 *   evidence.endOffset - evidence.startOffset
 * console.log(typeof width) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MentionEvidence = typeof MentionEvidence.Type;

const MentionFields = {
  id: MentionId,
  evidence: MentionEvidence,
  confidence: Confidence,
  mentionsEntity: IRI,
  sourceDocument: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
  extractedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
} as const;

/**
 * Text evidence linking a source span to a tracked entity or event.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Mention } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const mention = S.decodeUnknownSync(Mention)({
 *   id: "mention-a1b2c3d4e5f6",
 *   evidence: {
 *     text: "Mayor Bruce Harrell",
 *     startOffset: 42,
 *     endOffset: 61
 *   },
 *   confidence: 0.95,
 *   mentionsEntity: "https://example.org/entity/bruce-harrell"
 * })
 * console.log(mention.evidence.text) // "Mayor Bruce Harrell"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Mention extends S.Class<Mention>($I`Mention`)(
  MentionFields,
  $I.annote("Mention", {
    description: "Confidence-scored source evidence referring to a tracked entity or event.",
  })
) {}

/**
 * Stable canonical identifier for a persistent resolved entity.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { CanonicalEntityId } from "@effect-ontology/Model/CoreOntology.ts"
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
    SchemaUtils.withStatics((schema) => ({
      fromSeed: Effect.fn("CanonicalEntityId.fromSeed")(function* (seed: string) {
        const digest = yield* digestText(seed);
        return schema.make(`entity-${Str.takeLeft(12)(digest)}`);
      }),
    }))
  );

/**
 * Runtime value decoded by {@link CanonicalEntityId}.
 *
 * @example
 * ```ts
 * import {
 *   CanonicalEntityId,
 *   type CanonicalEntityId as CanonicalIdentifier
 * } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const id: CanonicalIdentifier = CanonicalEntityId.make("bruce_harrell")
 * console.log(id) // "bruce_harrell"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityId = typeof CanonicalEntityId.Type;

const TrackedEntityFields = {
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
} as const;

/**
 * Persistent canonical entity tracked across source documents.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TrackedEntity } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const entity = S.decodeUnknownSync(TrackedEntity)({
 *   id: "bruce_harrell",
 *   iri: "https://example.org/entity/bruce-harrell",
 *   name: "Bruce Harrell",
 *   types: ["https://schema.org/Person"]
 * })
 * console.log(entity.isResolved) // false
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrackedEntity extends S.Class<TrackedEntity>($I`TrackedEntity`)(
  TrackedEntityFields,
  $I.annote("TrackedEntity", {
    description: "Persistent canonical entity with ontology types, confidence, merges, and links.",
  })
) {
  /**
   * Whether at least one other entity was merged into this canonical form.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import { TrackedEntity } from "@effect-ontology/Model/CoreOntology.ts"
   *
   * const entity = S.decodeUnknownSync(TrackedEntity)({
   *   id: "alice",
   *   iri: "https://example.org/entity/alice",
   *   name: "Alice",
   *   types: ["https://schema.org/Person"]
   * })
   * console.log(entity.isResolved) // false
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { EventId } from "@effect-ontology/Model/CoreOntology.ts"
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
      fromSeed: Effect.fn("EventId.fromSeed")(function* (seed: string) {
        const digest = yield* digestText(seed);
        return schema.make(`event-${Str.takeLeft(12)(digest)}`);
      }),
    }))
  );

/**
 * Runtime value decoded by {@link EventId}.
 *
 * @example
 * ```ts
 * import { EventId, type EventId as EventIdentifier } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const id: EventIdentifier = EventId.make("event-a1b2c3d4e5f6")
 * console.log(id) // "event-a1b2c3d4e5f6"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventId = typeof EventId.Type;

const ParticipantFields = {
  entityIri: IRI,
  role: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
} as const;

/**
 * Tracked entity participating in an event, with an optional ontology role.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Participant } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const participant = S.decodeUnknownSync(Participant)({
 *   entityIri: "https://example.org/entity/bruce-harrell"
 * })
 * console.log(participant.entityIri) // "https://example.org/entity/bruce-harrell"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Participant extends S.Class<Participant>($I`Participant`)(
  ParticipantFields,
  $I.annote("Participant", {
    description: "Entity participation in an event with an optional ontology-defined role.",
  })
) {}

const EventIntervalFields = {
  start: S.DateTimeUtcFromString,
  end: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
} as const;

class EventIntervalFieldsModel extends S.Class<EventIntervalFieldsModel>($I`EventIntervalFieldsModel`)(
  EventIntervalFields,
  $I.annote("EventIntervalFieldsModel", {
    description: "Internal field model for a start and optional end instant.",
  })
) {}

const makeEventIntervalArbitrary = (fc: typeof FastCheck) =>
  S.toArbitrary(S.DateTimeUtcFromString).chain((start) =>
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
 * @example
 * ```ts
 * import { DateTime } from "effect"
 * import { EventInterval } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const now = DateTime.nowUnsafe()
 * const encodedNow = DateTime.formatIso(now)
 * const interval = EventInterval.fromUnknown({ start: encodedNow, end: encodedNow })
 * console.log(DateTime.toEpochMillis(interval.start) <= DateTime.toEpochMillis(now)) // true
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
 * @example
 * ```ts
 * import type { EventInterval } from "@effect-ontology/Model/CoreOntology.ts"
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
 * @example
 * ```ts
 * import { EventTime } from "@effect-ontology/Model/CoreOntology.ts"
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
    toArbitrary: () => () => S.toArbitrary(EventTimeDefinition),
  })
);

/**
 * Runtime value decoded by {@link EventTime}.
 *
 * @example
 * ```ts
 * import type { EventTime } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const time: EventTime = { _tag: "Unspecified" }
 * console.log(time._tag) // "Unspecified"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventTime = typeof EventTime.Type;

const TrackedEventFields = {
  id: EventId,
  iri: IRI,
  types: S.NonEmptyArray(IRI),
  time: EventTime.pipe(SchemaUtils.withKeyDefaults(EventTime.cases.Unspecified.make({}))),
  participants: S.Array(Participant).pipe(SchemaUtils.withEmptyArrayDefaults<Participant>()),
  location: S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
  attributes: Attributes.pipe(SchemaUtils.withKeyDefaults({})),
  groundingConfidence: S.OptionFromOptionalKey(Confidence).pipe(SchemaUtils.withNoneDefault),
} as const;

/**
 * Persistent ontology-typed occurrence involving tracked entities.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TrackedEvent } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const event = S.decodeUnknownSync(TrackedEvent)({
 *   id: "event-a1b2c3d4e5f6",
 *   iri: "https://example.org/event/announcement",
 *   types: ["https://schema.org/Event"]
 * })
 * console.log(event.hasTemporalGrounding) // false
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TrackedEvent extends S.Class<TrackedEvent>($I`TrackedEvent`)(
  TrackedEventFields,
  $I.annote("TrackedEvent", {
    description: "Persistent ontology-typed event with explicit time, participants, location, and confidence.",
  })
) {
  /**
   * Whether this event has an explicit instant or interval.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import { TrackedEvent } from "@effect-ontology/Model/CoreOntology.ts"
   *
   * const event = S.decodeUnknownSync(TrackedEvent)({
   *   id: "event-a1b2c3d4e5f6",
   *   iri: "https://example.org/event/announcement",
   *   types: ["https://schema.org/Event"]
   * })
   * console.log(event.hasTemporalGrounding) // false
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
} as const;

/**
 * Failure while constructing or persisting mention evidence.
 *
 * @example
 * ```ts
 * import { MentionError } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const error = MentionError.make({ message: "Mention offsets are invalid." })
 * console.log(error._tag) // "MentionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MentionError extends TaggedErrorClass<MentionError>($I`MentionError`)(
  "MentionError",
  CoreOperationErrorFields,
  $I.annote("MentionError", {
    description: "Typed failure while constructing or persisting mention evidence.",
  })
) {}

/**
 * Failure while resolving or persisting a tracked entity.
 *
 * @example
 * ```ts
 * import { TrackedEntityError } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const error = TrackedEntityError.make({ message: "Canonical entity was not found." })
 * console.log(error._tag) // "TrackedEntityError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TrackedEntityError extends TaggedErrorClass<TrackedEntityError>($I`TrackedEntityError`)(
  "TrackedEntityError",
  CoreOperationErrorFields,
  $I.annote("TrackedEntityError", {
    description: "Typed failure while resolving or persisting a tracked entity.",
  })
) {}

/**
 * Failure while grounding or persisting a tracked event.
 *
 * @example
 * ```ts
 * import { TrackedEventError } from "@effect-ontology/Model/CoreOntology.ts"
 *
 * const error = TrackedEventError.make({ message: "Event interval is invalid." })
 * console.log(error._tag) // "TrackedEventError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TrackedEventError extends TaggedErrorClass<TrackedEventError>($I`TrackedEventError`)(
  "TrackedEventError",
  CoreOperationErrorFields,
  $I.annote("TrackedEventError", {
    description: "Typed failure while grounding or persisting a tracked event.",
  })
) {}
