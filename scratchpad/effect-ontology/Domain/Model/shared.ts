/**
 * Shared value schemas for the effect-ontology experiment.
 *
 * **Details**
 *
 * * These schemas centralize the small invariants reused by extraction,
 * resolution, and ontology models. Domain code receives finite attribute
 * values, `Option`-modeled confidence, and validated entity identifiers rather
 * than repairing weak input at each call site.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/shared");

/**
 * JSON-safe scalar accepted as an entity or mention attribute value.
 *
 * **Details**
 *
 * * Numbers are finite so attribute records remain serializable without the
 * non-standard `NaN` and infinity cases admitted by JavaScript numbers.
 *
 * **Example** (Use AttributeValue)
 * ```ts
 * import { AttributeValue } from "@effect-ontology/Model/shared"
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
    toArbitrary: () => (fc) =>
      fc.oneof(S.toArbitrary(S.String)(fc), S.toArbitrary(S.Finite)(fc), S.toArbitrary(S.Boolean)(fc)),
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
 * **Example** (Use AttributeValue)
 * ```ts
 * import { type AttributeValue } from "@effect-ontology/Model/shared"
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
 * **Details**
 *
 * * Attribute keys commonly contain property IRIs, but the source contract also
 * permits application-defined keys. Values are deliberately restricted by
 * {@link AttributeValue}.
 *
 * **Example** (Use Attributes)
 * ```ts
 * import { Attributes } from "@effect-ontology/Model/shared"
 *
 * const attributes = Attributes.make({
 *   "https://schema.org/age": 39,
 *   "https://schema.org/active": true
 * })
 * console.log(attributes["https://schema.org/age"]) // 39
 * ```
 *
 * @invariant Every property value is a JSON-safe scalar.
 * @category models
 * @since 0.0.0
 */
export const Attributes = S.Record(S.String, AttributeValue)
  .annotate({
    toArbitrary: () => (fc) => fc.dictionary(fc.string(), S.toArbitrary(AttributeValue)(fc)),
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
 * **Example** (Use Attributes)
 * ```ts
 * import { type Attributes } from "@effect-ontology/Model/shared"
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
 * Nullish-compatible optional confidence value.
 *
 * **Details**
 *
 * * Decoding accepts an omitted, `undefined`, or `null` value and normalizes it
 * immediately to `Option.none`. Construction also defaults to `Option.none`,
 * so downstream behavior never branches on nullish values.
 *
 * **Example** (Use OptionalConfidence)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionalConfidence } from "@effect-ontology/Model/shared"
 *
 * const missing = S.decodeUnknownOption(OptionalConfidence)(undefined)
 * const present = S.decodeUnknownOption(OptionalConfidence)(0.8)
 * console.log(O.exists(missing, O.isNone), O.exists(present, O.isSome)) // true true
 * ```
 *
 * @invariant Contains either no value or one valid {@link Confidence}.
 * @category value-objects
 * @since 0.0.0
 */
export const OptionalConfidence = S.OptionFromNullishOr(Confidence)
  .annotate({
    toArbitrary: () => (fc) => fc.option(S.toArbitrary(Confidence)(fc), { nil: undefined }).map(O.fromUndefinedOr),
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
 * **Example** (Use OptionalConfidence)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionalConfidence, type OptionalConfidence as OptionalConfidenceValue } from "@effect-ontology/Model/shared"
 *
 * const confidence = S.decodeUnknownOption(OptionalConfidence)(null)
 * console.log(O.exists(confidence, (value: OptionalConfidenceValue) => O.isNone(value))) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalConfidence = typeof OptionalConfidence.Type;

/**
 * Canonical source pattern for local entity identifiers.
 *
 * **Example** (Use ENTITY_ID_PATTERN)
 * ```ts
 * import { ENTITY_ID_PATTERN } from "@effect-ontology/Model/shared"
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
 * **Details**
 *
 * * The upstream assertion-based constructor has intentionally been removed.
 * Use the schema's `make`, `fromUnknown`, or `decodeOption` statics so invalid
 * identifiers cannot acquire the brand without validation.
 *
 * **Example** (Use EntityId)
 * ```ts
 * import { EntityId } from "@effect-ontology/Model/shared"
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
 * **Example** (Use EntityId)
 * ```ts
 * import { EntityId, type EntityId as EntityIdValue } from "@effect-ontology/Model/shared"
 *
 * const id: EntityIdValue = EntityId.make("al_nassr_fc")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityId = typeof EntityId.Type;
