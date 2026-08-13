/**
 * Provenance-aware claims, curated assertions, derivations, and events.
 *
 * @remarks
 * The source module's three-layer epistemic distinction is retained while its
 * ambiguous string-or-instance RDF values are replaced by canonical RDF/JS
 * term schemas. Temporal absence is normalized to `Option`, and repeated
 * identifier construction lives on the identifier schemas themselves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import type { FastCheck } from "effect/testing";
import { ContentHash, GcsUri } from "../Identity.ts";
import { Confidence } from "../Model/index.ts";
import { AbsoluteIRI, NamedNode, ObjectTerm } from "../Rdf/index.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/KnowledgeModel");

const claimIdPattern = /^claim-[0-9a-f]{12}$/;
const assertionIdPattern = /^assertion-[0-9a-f]{12}$/;
const derivedAssertionIdPattern = /^derived-[0-9a-f]{12}$/;
const ruleIdPattern = /^rule-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const eventIdPattern = /^event-[0-9a-f]{12}$/;
const decodeDateTimeUtcFromMillis = S.decodeUnknownSync(S.DateTimeUtcFromMillis);

/**
 * Deterministic identifier of an extracted claim.
 *
 * @example
 * ```ts
 * import { ClaimId } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(ClaimId.is("claim-abc123def456")) // true
 * ```
 *
 * @invariant Uses `claim-` followed by exactly twelve lowercase hexadecimal
 * characters.
 * @category identifiers
 * @since 0.0.0
 */
export const ClaimId = S.String.check(
  S.isPattern(claimIdPattern, {
    identifier: $I`ClaimIdPatternCheck`,
    title: "Claim Identifier",
    description: "A claim- prefix followed by exactly twelve lowercase hexadecimal characters.",
    message: "Claim ID must use claim- followed by exactly twelve lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(claimIdPattern),
  })
  .pipe(
    S.brand("ClaimId"),
    $I.annoteSchema("ClaimId", {
      description: "Deterministic compact identifier for one extracted claim.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type => schema.make(`claim-${ContentHash.idFragment(hash)}`),
    }))
  );

/**
 * Runtime value decoded by {@link ClaimId}.
 *
 * @example
 * ```ts
 * import { ClaimId, type ClaimId as ClaimIdValue } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const id: ClaimIdValue = ClaimId.make("claim-abc123def456")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;

/**
 * Deterministic identifier of a curated assertion.
 *
 * @example
 * ```ts
 * import { AssertionId } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(AssertionId.is("assertion-abc123def456")) // true
 * ```
 *
 * @invariant Uses `assertion-` followed by exactly twelve lowercase
 * hexadecimal characters.
 * @category identifiers
 * @since 0.0.0
 */
export const AssertionId = S.String.check(
  S.isPattern(assertionIdPattern, {
    identifier: $I`AssertionIdPatternCheck`,
    title: "Assertion Identifier",
    description: "An assertion- prefix followed by exactly twelve lowercase hexadecimal characters.",
    message: "Assertion ID must use assertion- followed by exactly twelve lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(assertionIdPattern),
  })
  .pipe(
    S.brand("AssertionId"),
    $I.annoteSchema("AssertionId", {
      description: "Deterministic compact identifier for one curated assertion.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type =>
        schema.make(`assertion-${ContentHash.idFragment(hash)}`),
    }))
  );

/**
 * Runtime value decoded by {@link AssertionId}.
 *
 * @example
 * ```ts
 * import { AssertionId, type AssertionId as AssertionIdValue } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const id: AssertionIdValue = AssertionId.make("assertion-abc123def456")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AssertionId = typeof AssertionId.Type;

/**
 * Deterministic identifier of an inferred assertion.
 *
 * @example
 * ```ts
 * import { DerivedAssertionId } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(DerivedAssertionId.is("derived-abc123def456")) // true
 * ```
 *
 * @invariant Uses `derived-` followed by exactly twelve lowercase hexadecimal
 * characters.
 * @category identifiers
 * @since 0.0.0
 */
export const DerivedAssertionId = S.String.check(
  S.isPattern(derivedAssertionIdPattern, {
    identifier: $I`DerivedAssertionIdPatternCheck`,
    title: "Derived Assertion Identifier",
    description: "A derived- prefix followed by exactly twelve lowercase hexadecimal characters.",
    message: "Derived assertion ID must use derived- followed by exactly twelve lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(derivedAssertionIdPattern),
  })
  .pipe(
    S.brand("DerivedAssertionId"),
    $I.annoteSchema("DerivedAssertionId", {
      description: "Deterministic compact identifier for one rule-derived assertion.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type =>
        schema.make(`derived-${ContentHash.idFragment(hash)}`),
    }))
  );

/**
 * Runtime value decoded by {@link DerivedAssertionId}.
 *
 * @example
 * ```ts
 * import {
 *   DerivedAssertionId,
 *   type DerivedAssertionId as DerivedAssertionIdValue
 * } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const id: DerivedAssertionIdValue = DerivedAssertionId.make("derived-abc123def456")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DerivedAssertionId = typeof DerivedAssertionId.Type;

/**
 * Stable identifier of a reasoning rule.
 *
 * @example
 * ```ts
 * import { RuleId } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(RuleId.is("rule-subclass-transitivity")) // true
 * ```
 *
 * @invariant Uses a `rule-` prefix followed by canonical lowercase
 * hyphen-separated segments.
 * @category identifiers
 * @since 0.0.0
 */
export const RuleId = S.String.check(
  S.isPattern(ruleIdPattern, {
    identifier: $I`RuleIdPatternCheck`,
    title: "Reasoning Rule Identifier",
    description: "A rule- prefix followed by lowercase alphanumeric hyphen-separated segments.",
    message: "Rule ID must use rule- followed by lowercase alphanumeric segments separated by single hyphens.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(ruleIdPattern),
  })
  .pipe(
    S.brand("RuleId"),
    $I.annoteSchema("RuleId", {
      description: "Canonical lowercase identifier for a reasoning rule.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value decoded by {@link RuleId}.
 *
 * @example
 * ```ts
 * import { RuleId, type RuleId as RuleIdValue } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const id: RuleIdValue = RuleId.make("rule-subclass-transitivity")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RuleId = typeof RuleId.Type;

class TextSpanFields extends S.Class<TextSpanFields>($I`TextSpanFields`)(
  {
    start: NonNegativeInt.annotateKey({
      description: "Inclusive zero-based character offset in the source text.",
    }),
    end: NonNegativeInt.annotateKey({
      description: "Exclusive zero-based character offset in the source text.",
    }),
    text: S.String.annotateKey({
      description: "Exact text covered by the half-open span.",
    }),
  },
  $I.annote("TextSpanFields", {
    description: "Internal text-span fields with non-negative character offsets.",
  })
) {}

const makeTextSpanArbitrary = (fc: typeof FastCheck) =>
  fc
    .tuple(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 4_096 }), fc.string({ maxLength: 4_096 }))
    .map(([start, length, text]) =>
      TextSpanFields.make({
        start: NonNegativeInt.make(start),
        end: NonNegativeInt.make(start + length),
        text,
      })
    );

const TextSpanDefinition = TextSpanFields.check(
  S.makeFilter(
    (span) =>
      span.start <= span.end
        ? undefined
        : {
            path: ["end"],
            issue: "Text-span end must be greater than or equal to start.",
          },
    {
      identifier: $I`TextSpanOrderCheck`,
      title: "Ordered Text Span",
      description: "A half-open text span whose end offset is not before its start offset.",
      message: "Text-span end must be greater than or equal to start.",
      arbitrary: {
        candidate: {
          make: makeTextSpanArbitrary,
        },
      },
    }
  )
);

/**
 * Half-open source-text evidence span `[start, end)`.
 *
 * @example
 * ```ts
 * import { TextSpan } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const span = TextSpan.fromUnknown({ start: 0, end: 5, text: "Alice" })
 * console.log(span.end) // 5
 * ```
 *
 * @invariant Both offsets are non-negative integers and `start <= end`.
 * @category evidence
 * @since 0.0.0
 */
export const TextSpan = TextSpanDefinition.annotate({
  toArbitrary: () => makeTextSpanArbitrary,
}).pipe(
  $I.annoteSchema("TextSpan", {
    description: "Validated half-open character span carrying its exact source text.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link TextSpan}.
 *
 * @example
 * ```ts
 * import type { TextSpan } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const width = (span: TextSpan) => span.end - span.start
 * console.log(width)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextSpan = typeof TextSpan.Type;

const EvidenceSourceDefinition = S.TaggedUnion({
  gcs: {
    value: S.Struct({
      uri: GcsUri.annotateKey({
        description: "Validated Google Cloud Storage URI.",
      }),
    }),
  },
  web: {
    value: S.Struct({
      iri: AbsoluteIRI.annotateKey({
        description: "Absolute web or semantic resource IRI.",
      }),
    }),
  },
});

const EvidenceSource = EvidenceSourceDefinition.pipe(
  $I.annoteSchema("EvidenceSource", {
    description: "Tagged evidence source containing either a GCS URI or an absolute resource IRI.",
    toArbitrary: () => (fc) => S.toArbitrary(EvidenceSourceDefinition)(fc),
  })
);

/**
 * Provenance evidence supporting an extracted claim.
 *
 * @remarks
 * Source location is explicitly discriminated, text spans are non-empty, and
 * optional contextual prose is normalized to `Option`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Evidence } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const evidence = S.decodeUnknownSync(Evidence)({
 *   source: { _tag: "gcs", value: {
 *     uri: "gs://beep-ontology-state/documents/article.txt"
 *   }},
 *   spans: [{ start: 0, end: 5, text: "Alice" }]
 * })
 * console.log(evidence.spans.length) // 1
 * ```
 *
 * @invariant Contains at least one ordered text span and exactly one tagged
 * source location.
 * @category evidence
 * @since 0.0.0
 */
export class Evidence extends S.Class<Evidence>($I`Evidence`)(
  {
    source: EvidenceSource.annotateKey({
      description: "Discriminated source location for the supporting document.",
    }),
    spans: TextSpan.pipe(S.NonEmptyArray).annotateKey({
      description: "Non-empty collection of source-text spans supporting the claim.",
    }),
    context: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional section or paragraph context.",
      })
    ),
  },
  $I.annote("Evidence", {
    description: "Claim provenance with a tagged source, non-empty text spans, and optional context.",
  })
) {
  static readonly is = S.is(Evidence);
}

/**
 * Canonical RDF/JS object term used in claims and assertions.
 *
 * @example
 * ```ts
 * import { makeLiteral } from "@effect-ontology/Rdf/Types.ts"
 * import { RdfObject } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const literal = makeLiteral(
 *   "Alice",
 *   "http://www.w3.org/2001/XMLSchema#string"
 * )
 * console.log(RdfObject.is(literal)) // true
 * ```
 *
 * @category rdf
 * @since 0.0.0
 */
export const RdfObject = ObjectTerm.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(ObjectTerm)(fc),
}).pipe(
  $I.annoteSchema("RdfObject", {
    description: "Canonical RDF/JS named-node, blank-node, or literal object term.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link RdfObject}.
 *
 * @example
 * ```ts
 * import type { RdfObject } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const termType = (object: RdfObject) => object.termType
 * console.log(termType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RdfObject = typeof RdfObject.Type;

/**
 * Wikidata-style rank assigned to an extracted claim.
 *
 * @example
 * ```ts
 * import { ClaimRank } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(ClaimRank.is.preferred("preferred")) // true
 * ```
 *
 * @category literals
 * @since 0.0.0
 */
export const ClaimRank = LiteralKit(["preferred", "normal", "deprecated"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("preferred", "normal", "deprecated"),
  })
  .annotate(
    $I.annote("ClaimRank", {
      description: "Wikidata-style preferred, normal, or deprecated claim rank.",
    })
  );

/**
 * Runtime value accepted by {@link ClaimRank}.
 *
 * @example
 * ```ts
 * import type { ClaimRank } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const rank: ClaimRank = "normal"
 * console.log(rank)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimRank = typeof ClaimRank.Type;

const TemporalIntervalFields = S.Struct({
  from: S.DateTimeUtcFromString.annotateKey({
    description: "Inclusive UTC validity start.",
  }),
  to: S.DateTimeUtcFromString.annotateKey({
    description: "Exclusive UTC validity end.",
  }),
});

const TemporalIntervalDefinition = TemporalIntervalFields.check(
  S.makeFilter(
    (interval) =>
      DateTime.toEpochMillis(interval.from) <= DateTime.toEpochMillis(interval.to)
        ? undefined
        : {
            path: ["to"],
            issue: "Temporal interval end must not precede its start.",
          },
    {
      identifier: $I`TemporalIntervalOrderCheck`,
      title: "Ordered Temporal Interval",
      description: "A UTC validity interval whose end is not before its start.",
      message: "Temporal interval end must be greater than or equal to its start.",
    }
  )
);

const TemporalIntervalFromSelf = S.declare((input: unknown): input is typeof TemporalIntervalDefinition.Type =>
  S.is(TemporalIntervalDefinition)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(fc.integer({ min: 0, max: 4_000_000_000_000 }), fc.integer({ min: 0, max: 86_400_000 }))
      .map(([from, duration]) =>
        TemporalIntervalFields.make({
          from: decodeDateTimeUtcFromMillis(from),
          to: decodeDateTimeUtcFromMillis(from + duration),
        })
      ),
});

const TemporalInterval = TemporalIntervalDefinition.pipe(
  S.decodeTo(TemporalIntervalFromSelf),
  $I.annoteSchema("TemporalInterval", {
    description: "Ordered UTC validity interval.",
  })
);

/**
 * Reported RDF fact extracted from one source document.
 *
 * @remarks
 * Claims retain provenance and confidence and may conflict with one another.
 * Curated truth belongs to {@link Assertion}. The RDF triple uses canonical
 * RDF/JS terms, rank defaults to `normal`, and temporal validity is nested as
 * one optional ordered interval.
 *
 * @example
 * ```ts
 * import { Claim } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const claim = Claim.fromUnknown({
 *   id: "claim-abc123def456",
 *   subject: { termType: "NamedNode", value: "https://example.com/alice" },
 *   predicate: { termType: "NamedNode", value: "https://schema.org/name" },
 *   object: {
 *     termType: "Literal",
 *     value: "Alice",
 *     datatype: {
 *       termType: "NamedNode",
 *       value: "http://www.w3.org/2001/XMLSchema#string"
 *     }
 *   },
 *   documentUri: "gs://beep-ontology-state/documents/article.txt",
 *   evidence: {
 *     source: { _tag: "gcs", value: {
 *       uri: "gs://beep-ontology-state/documents/article.txt"
 *     }},
 *     spans: [{ start: 0, end: 5, text: "Alice" }]
 *   },
 *   extractedAt: "1970-01-01T00:00:00.000Z",
 *   confidence: 0.95
 * })
 * console.log(claim.rank) // "normal"
 * ```
 *
 * @invariant RDF terms are canonical, confidence lies in `[0, 1]`, evidence is
 * non-empty, and optional temporal validity is ordered.
 * @category claims
 * @since 0.0.0
 */
export class Claim extends S.Class<Claim>($I`Claim`)(
  {
    id: ClaimId,
    subject: NamedNode,
    predicate: NamedNode,
    object: RdfObject,
    documentUri: GcsUri,
    evidence: Evidence,
    extractedAt: S.DateTimeUtcFromString,
    confidence: Confidence,
    rank: ClaimRank.pipe(SchemaUtils.withKeyDefaults(ClaimRank.Enum.normal)),
    validity: S.OptionFromOptionalKey(TemporalInterval).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Claim", {
    description: "Provenance-bearing reported RDF fact with confidence, rank, and optional ordered validity.",
  })
) {
  static readonly is = S.is(Claim);
  static readonly fromUnknown = S.decodeUnknownSync(Claim);
}

/**
 * Curation lifecycle status of an assertion.
 *
 * @example
 * ```ts
 * import { AssertionStatus } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(AssertionStatus.is.accepted("accepted")) // true
 * ```
 *
 * @category literals
 * @since 0.0.0
 */
export const AssertionStatus = LiteralKit(["accepted", "rejected", "pending"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("accepted", "rejected", "pending"),
  })
  .annotate(
    $I.annote("AssertionStatus", {
      description: "Accepted, rejected, or pending curation status of an assertion.",
    })
  );

/**
 * Runtime value accepted by {@link AssertionStatus}.
 *
 * @example
 * ```ts
 * import type { AssertionStatus } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const status: AssertionStatus = "pending"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AssertionStatus = typeof AssertionStatus.Type;

/**
 * Curated RDF fact normalized from one or more claims.
 *
 * @example
 * ```ts
 * import { Assertion } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const assertion = Assertion.fromUnknown({
 *   id: "assertion-abc123def456",
 *   subject: { termType: "NamedNode", value: "https://example.com/alice" },
 *   predicate: { termType: "NamedNode", value: "https://schema.org/name" },
 *   object: {
 *     termType: "Literal",
 *     value: "Alice",
 *     datatype: {
 *       termType: "NamedNode",
 *       value: "http://www.w3.org/2001/XMLSchema#string"
 *     }
 *   },
 *   assertedAt: "1970-01-01T00:00:00.000Z",
 *   derivedFrom: ["claim-abc123def456"],
 *   status: "accepted"
 * })
 * console.log(assertion.status) // "accepted"
 * ```
 *
 * @invariant At least one source claim supports the assertion and optional
 * temporal validity is ordered.
 * @category assertions
 * @since 0.0.0
 */
export class Assertion extends S.Class<Assertion>($I`Assertion`)(
  {
    id: AssertionId,
    subject: NamedNode,
    predicate: NamedNode,
    object: RdfObject,
    assertedAt: S.DateTimeUtcFromString,
    derivedFrom: ClaimId.pipe(S.NonEmptyArray),
    status: AssertionStatus,
    validity: S.OptionFromOptionalKey(TemporalInterval).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Assertion", {
    description: "Curated RDF fact supported by one or more claims and carrying explicit curation status.",
  })
) {
  static readonly is = S.is(Assertion);
  static readonly fromUnknown = S.decodeUnknownSync(Assertion);
}

/**
 * Assertion inferred by applying a reasoning rule to accepted facts.
 *
 * @example
 * ```ts
 * import { DerivedAssertion } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const readRule = (value: DerivedAssertion) => value.ruleId
 * console.log(readRule)
 * ```
 *
 * @invariant At least one supporting assertion is recorded.
 * @category assertions
 * @since 0.0.0
 */
export class DerivedAssertion extends S.Class<DerivedAssertion>($I`DerivedAssertion`)(
  {
    id: DerivedAssertionId,
    assertion: Assertion,
    ruleId: RuleId,
    supportingFacts: AssertionId.pipe(S.NonEmptyArray),
    derivedAt: S.DateTimeUtcFromString,
  },
  $I.annote("DerivedAssertion", {
    description: "Rule-derived assertion with a non-empty set of supporting curated facts.",
  })
) {
  static readonly is = S.is(DerivedAssertion);
}

/**
 * Deterministic identifier of a real-world event node.
 *
 * @example
 * ```ts
 * import { EventId } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(EventId.is("event-abc123def456")) // true
 * ```
 *
 * @invariant Uses `event-` followed by exactly twelve lowercase hexadecimal
 * characters.
 * @category identifiers
 * @since 0.0.0
 */
export const EventId = S.String.check(
  S.isPattern(eventIdPattern, {
    identifier: $I`EventIdPatternCheck`,
    title: "Event Identifier",
    description: "An event- prefix followed by exactly twelve lowercase hexadecimal characters.",
    message: "Event ID must use event- followed by exactly twelve lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(eventIdPattern),
  })
  .pipe(
    S.brand("EventId"),
    $I.annoteSchema("EventId", {
      description: "Deterministic compact identifier for one real-world event node.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type => schema.make(`event-${ContentHash.idFragment(hash)}`),
    }))
  );

/**
 * Runtime value decoded by {@link EventId}.
 *
 * @example
 * ```ts
 * import { EventId, type EventId as EventIdValue } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const id: EventIdValue = EventId.make("event-abc123def456")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventId = typeof EventId.Type;

/**
 * Presentation category for a real-world event.
 *
 * @example
 * ```ts
 * import { EventType } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * console.log(EventType.is.Appointment("Appointment")) // true
 * ```
 *
 * @category literals
 * @since 0.0.0
 */
export const EventType = LiteralKit([
  "StaffAnnouncement",
  "PolicyInitiative",
  "CouncilVote",
  "Appointment",
  "BudgetAction",
  "PublicMeeting",
  "Generic",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "StaffAnnouncement",
        "PolicyInitiative",
        "CouncilVote",
        "Appointment",
        "BudgetAction",
        "PublicMeeting",
        "Generic"
      ),
  })
  .annotate(
    $I.annote("EventType", {
      description: "Finite event categories used for timeline grouping and presentation.",
    })
  );

/**
 * Runtime value accepted by {@link EventType}.
 *
 * @example
 * ```ts
 * import type { EventType } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const type: EventType = "Generic"
 * console.log(type)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventType = typeof EventType.Type;

/**
 * Named RDF resource participating in an event.
 *
 * @example
 * ```ts
 * import { makeNamedNode } from "@effect-ontology/Rdf/Types.ts"
 * import { EntityRef } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const participant = EntityRef.make({
 *   entity: makeNamedNode("https://example.com/alice")
 * })
 * console.log(participant.entity.termType) // "NamedNode"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class EntityRef extends S.Class<EntityRef>($I`EntityRef`)(
  {
    entity: NamedNode.annotateKey({
      description: "Canonical RDF/JS named node identifying the participant.",
    }),
    role: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional semantic or presentation role in the event.",
      })
    ),
    label: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional display label.",
      })
    ),
  },
  $I.annote("EntityRef", {
    description: "Event-participant reference backed by a canonical named node and Option-normalized metadata.",
  })
) {
  static readonly is = S.is(EntityRef);
}

/**
 * First-class real-world event grouping participants and curated facts.
 *
 * @remarks
 * Publication time is mandatory and source documents are non-empty. All other
 * optional time and prose values decode to `Option`; participant, fact, and
 * tag collections default to empty arrays.
 *
 * @example
 * ```ts
 * import { Event } from "@effect-ontology/Schema/KnowledgeModel.ts"
 *
 * const event = Event.fromUnknown({
 *   id: "event-abc123def456",
 *   type: "Generic",
 *   publishedAt: "2026-07-25T12:00:00.000Z",
 *   sourceDocuments: ["gs://beep-ontology-state/documents/article.txt"]
 * })
 * console.log(event.participants.length) // 0
 * ```
 *
 * @invariant At least one valid GCS source document is present.
 * @category events
 * @since 0.0.0
 */
export class Event extends S.Class<Event>($I`Event`)(
  {
    id: EventId,
    type: EventType,
    title: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    eventTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    publishedAt: S.DateTimeUtcFromString,
    ingestedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    participants: S.Array(EntityRef).pipe(SchemaUtils.withEmptyArrayDefaults<EntityRef>()),
    factGroup: S.Array(AssertionId).pipe(SchemaUtils.withEmptyArrayDefaults<AssertionId>()),
    sourceDocuments: GcsUri.pipe(S.NonEmptyArray),
    summary: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    tags: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
  },
  $I.annote("Event", {
    description: "First-class timeline event with validated time, participants, curated facts, and source provenance.",
  })
) {
  static readonly is = S.is(Event);
  static readonly fromUnknown = S.decodeUnknownSync(Event);
}
