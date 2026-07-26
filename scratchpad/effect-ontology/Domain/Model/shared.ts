/**
 * Shared value schemas for the effect-ontology experiment.
 *
 * @remarks
 * These schemas centralize the small invariants reused by extraction,
 * resolution, and ontology models. Domain code receives finite attribute
 * values, `Option`-modeled confidence, and validated entity identifiers rather
 * than repairing weak input at each call site.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { IRI as CanonicalIRI } from "@beep/rdf/Iri";
import { URLStr as CanonicalURLStr, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/shared");

/**
 * Canonical RDF IRI with an explicit property-testing generator.
 *
 * @remarks
 * The declaration delegates acceptance and construction to `@beep/rdf` while
 * hiding its opaque syntax filter from downstream arbitrary derivation.
 *
 * @example
 * ```ts
 * import { IRI } from "@effect-ontology/Model/shared.ts"
 *
 * const iri = IRI.fromUnknown("https://example.com/ontology#Person")
 * console.log(IRI.is(iri)) // true
 * ```
 *
 * @invariant The value satisfies the repository's canonical RFC 3987 IRI schema.
 * @category rdf
 * @since 0.0.0
 */
export const IRI = S.declare(CanonicalIRI.is).pipe(
  $I.annoteSchema("IRI", {
    description: "Canonical RFC 3987 IRI with an explicit web-IRI arbitrary.",
    toArbitrary: () => (fc) => fc.webUrl().map(CanonicalIRI.make),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime IRI accepted by {@link IRI}.
 *
 * @example
 * ```ts
 * import { IRI, type IRI as IriValue } from "@effect-ontology/Model/shared.ts"
 *
 * const iri: IriValue = IRI.fromUnknown("https://example.com/id")
 * console.log(iri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type IRI = typeof IRI.Type;

/**
 * Canonical URL string with an explicit web-URL generator.
 *
 * @example
 * ```ts
 * import { URLStr } from "@effect-ontology/Model/shared.ts"
 *
 * const url = URLStr.fromUnknown("https://example.com/image.png")
 * console.log(URLStr.is(url)) // true
 * ```
 *
 * @invariant A non-empty string accepted by the platform URL parser.
 * @category urls
 * @since 0.0.0
 */
export const URLStr = S.declare(CanonicalURLStr.is).pipe(
  $I.annoteSchema("URLStr", {
    description: "Canonical URL string with an explicit web-URL arbitrary.",
    toArbitrary: () => (fc) => fc.webUrl().map(CanonicalURLStr.make),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime URL accepted by {@link URLStr}.
 *
 * @example
 * ```ts
 * import { URLStr, type URLStr as UrlValue } from "@effect-ontology/Model/shared.ts"
 *
 * const url: UrlValue = URLStr.fromUnknown("https://example.com")
 * console.log(url)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type URLStr = typeof URLStr.Type;

/**
 * JSON-safe scalar accepted as an entity or mention attribute value.
 *
 * @remarks
 * Numbers are finite so attribute records remain serializable without the
 * non-standard `NaN` and infinity cases admitted by JavaScript numbers.
 *
 * @example
 * ```ts
 * import { AttributeValue } from "@effect-ontology/Model/shared.ts"
 *
 * console.log(AttributeValue.is("Seattle")) // true
 * console.log(AttributeValue.is(Number.POSITIVE_INFINITY)) // false
 * ```
 *
 * @invariant A string, boolean, or finite number.
 * @category value-objects
 * @since 0.0.0
 */
export const AttributeValue = S.Union([S.String, S.Finite, S.Boolean])
  .annotate({
    toArbitrary: () => (fc) => fc.oneof(S.toArbitrary(S.String), S.toArbitrary(S.Finite), S.toArbitrary(S.Boolean)),
  })
  .pipe(
    $I.annoteSchema("AttributeValue", {
      description: "JSON-safe scalar attribute value consisting of a string, boolean, or finite number.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value decoded by {@link AttributeValue}. {@inheritDoc AttributeValue}
 *
 * @example
 * ```ts
 * import { type AttributeValue } from "@effect-ontology/Model/shared.ts"
 *
 * const value: AttributeValue = 0.95
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AttributeValue = typeof AttributeValue.Type;

/**
 * Open attribute record used by extracted mentions and entities.
 *
 * @remarks
 * Attribute keys commonly contain property IRIs, but the source contract also
 * permits application-defined keys. Values are deliberately restricted by
 * {@link AttributeValue}.
 *
 * @example
 * ```ts
 * import { Attributes } from "@effect-ontology/Model/shared.ts"
 *
 * const attributes = Attributes.make({
 *   "http://schema.org/age": 39,
 *   "http://schema.org/active": true
 * })
 * console.log(attributes["http://schema.org/age"]) // 39
 * ```
 *
 * @invariant Every property value is a JSON-safe scalar.
 * @category models
 * @since 0.0.0
 */
export const Attributes = S.Record(S.String, AttributeValue)
  .annotate({
    toArbitrary: () => (fc) => fc.dictionary(fc.string(), S.toArbitrary(AttributeValue)),
  })
  .pipe(
    $I.annoteSchema("Attributes", {
      description: "Open string-keyed attribute record whose values are JSON-safe scalars.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics(() => ({
      empty: (): Attributes => ({}),
    }))
  );

/**
 * Runtime value decoded by {@link Attributes}. {@inheritDoc Attributes}
 *
 * @example
 * ```ts
 * import { type Attributes } from "@effect-ontology/Model/shared.ts"
 *
 * const attributes: Attributes = { active: true }
 * console.log(attributes.active) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Attributes = typeof Attributes.Type;

/**
 * Confidence value on the closed unit interval.
 *
 * @remarks
 * This semantic alias reuses the repository's canonical
 * {@link UnitInterval} schema, including its finite-number guarantee.
 *
 * @example
 * ```ts
 * import { Confidence } from "@effect-ontology/Model/shared.ts"
 *
 * console.log(Confidence.is(0.95)) // true
 * console.log(Confidence.is(1.5)) // false
 * ```
 *
 * @invariant Finite and between zero and one, inclusive.
 * @category value-objects
 * @since 0.0.0
 */
export const Confidence = UnitInterval.annotate({
  toArbitrary: () => () => S.toArbitrary(UnitInterval),
}).pipe(
  $I.annoteSchema("Confidence", {
    description: "Finite confidence score on the closed unit interval from zero through one.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link Confidence}. {@inheritDoc Confidence}
 *
 * @example
 * ```ts
 * import { Confidence, type Confidence as ConfidenceValue } from "@effect-ontology/Model/shared.ts"
 *
 * const confidence: ConfidenceValue = Confidence.make(0.95)
 * console.log(confidence)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Confidence = typeof Confidence.Type;

/**
 * Nullish-compatible optional confidence value.
 *
 * @remarks
 * Decoding accepts an omitted, `undefined`, or `null` value and normalizes it
 * immediately to `Option.none`. Construction also defaults to `Option.none`,
 * so downstream behavior never branches on nullish values.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalConfidence } from "@effect-ontology/Model/shared.ts"
 *
 * const missing = OptionalConfidence.fromUnknown(undefined)
 * const present = OptionalConfidence.fromUnknown(0.8)
 * console.log(O.isNone(missing), O.isSome(present)) // true true
 * ```
 *
 * @invariant Contains either no value or one valid {@link Confidence}.
 * @category value-objects
 * @since 0.0.0
 */
export const OptionalConfidence = S.OptionFromNullishOr(Confidence)
  .annotate({
    toArbitrary: () => (fc) => fc.option(S.toArbitrary(Confidence), { nil: undefined }).map(O.fromUndefinedOr),
  })
  .pipe(
    SchemaUtils.withNoneDefault,
    $I.annoteSchema("OptionalConfidence", {
      description: "Optional confidence normalized from nullish input to an Effect Option.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value decoded by {@link OptionalConfidence}. {@inheritDoc OptionalConfidence}
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalConfidence, type OptionalConfidence as OptionalConfidenceValue } from "@effect-ontology/Model/shared.ts"
 *
 * const confidence: OptionalConfidenceValue = OptionalConfidence.fromUnknown(null)
 * console.log(O.isNone(confidence)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalConfidence = typeof OptionalConfidence.Type;

/**
 * Canonical source pattern for local entity identifiers.
 *
 * @example
 * ```ts
 * import { ENTITY_ID_PATTERN } from "@effect-ontology/Model/shared.ts"
 *
 * console.log(ENTITY_ID_PATTERN.test("cristiano_ronaldo")) // true
 * console.log(ENTITY_ID_PATTERN.test("_private")) // false
 * ```
 *
 * @invariant Begins with a lowercase ASCII letter and continues with lowercase
 * ASCII letters, digits, or underscores.
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Validated local identifier for an extracted or resolved entity.
 *
 * @remarks
 * The upstream assertion-based constructor has intentionally been removed.
 * Use the schema's `make`, `fromUnknown`, or `decodeOption` statics so invalid
 * identifiers cannot acquire the brand without validation.
 *
 * @example
 * ```ts
 * import { EntityId } from "@effect-ontology/Model/shared.ts"
 *
 * const id = EntityId.make("cristiano_ronaldo")
 * console.log(EntityId.is(id)) // true
 * ```
 *
 * @invariant Snake case beginning with a lowercase ASCII letter.
 * @category entity-ids
 * @since 0.0.0
 */
export const EntityId = S.String.check(
  S.isPattern(ENTITY_ID_PATTERN, {
    identifier: $I`EntityIdPatternCheck`,
    title: "Entity Identifier",
    description:
      "A local entity identifier beginning with a lowercase ASCII letter and continuing with lowercase letters, digits, or underscores.",
    message: "Entity ID must begin with a lowercase letter and contain only lowercase letters, digits, or underscores.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(ENTITY_ID_PATTERN),
  })
  .pipe(
    S.brand("EntityId"),
    $I.annoteSchema("EntityId", {
      description: "Validated snake-case local identifier for an extracted or resolved entity.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      equivalence: SchemaUtils.toEquivalence(schema),
    }))
  );

/**
 * Runtime value decoded by {@link EntityId}. {@inheritDoc EntityId}
 *
 * @example
 * ```ts
 * import { EntityId, type EntityId as EntityIdValue } from "@effect-ontology/Model/shared.ts"
 *
 * const id: EntityIdValue = EntityId.make("al_nassr_fc")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityId = typeof EntityId.Type;

export {
  /**
   * Compatibility export for the upstream schema name.
   *
   * @example
   * ```ts
   * import { AttributesSchema } from "@effect-ontology/Model/shared.ts"
   *
   * console.log(AttributesSchema.is({ active: true })) // true
   * ```
   *
   * @deprecated Use {@link Attributes}; new schema values omit the `Schema` suffix.
   * @category interop
   * @since 0.0.0
   */
  Attributes as AttributesSchema,
  /**
   * Compatibility export for the upstream schema name.
   *
   * @example
   * ```ts
   * import { ConfidenceSchema } from "@effect-ontology/Model/shared.ts"
   *
   * console.log(ConfidenceSchema.is(0.8)) // true
   * ```
   *
   * @deprecated Use {@link Confidence}; new schema values omit the `Schema` suffix.
   * @category interop
   * @since 0.0.0
   */
  Confidence as ConfidenceSchema,
  /**
   * Compatibility export for the upstream schema name.
   *
   * @example
   * ```ts
   * import { EntityIdSchema } from "@effect-ontology/Model/shared.ts"
   *
   * console.log(EntityIdSchema.is("al_nassr_fc")) // true
   * ```
   *
   * @deprecated Use {@link EntityId}; new schema values omit the `Schema` suffix.
   * @category interop
   * @since 0.0.0
   */
  EntityId as EntityIdSchema,
  /**
   * Compatibility export for the upstream schema name.
   *
   * @example
   * ```ts
   * import * as O from "effect/Option"
   * import { OptionalConfidenceSchema } from "@effect-ontology/Model/shared.ts"
   *
   * console.log(O.isNone(OptionalConfidenceSchema.fromUnknown(undefined))) // true
   * ```
   *
   * @deprecated Use {@link OptionalConfidence}; it normalizes absence to `Option`.
   * @category interop
   * @since 0.0.0
   */
  OptionalConfidence as OptionalConfidenceSchema,
};
