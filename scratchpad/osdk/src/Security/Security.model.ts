/**
 * Property security: the markings that guard one property value and the envelope that carries them.
 *
 * **Details**
 *
 * When security metadata is requested, a load response does not repeat the
 * markings beside every value. It carries one table of security results, and
 * each property value arrives wrapped with an index into that table (see
 * {@link SecuredValue}). An entry of the table ({@link PropertySecurities}) is
 * a list of alternative outcomes ({@link PropertySecurity}); the outcome that
 * succeeded in computing markings is {@link PropertyMarkings}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constTrue, dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { MarkingId } from "../Identifier/Identifier.model.ts";

const $I = $ScratchpadId.create("osdk/Security/Security.model");

// -----------------------------------------------------------------------------
// Marking requirements
// -----------------------------------------------------------------------------

/**
 * Markings that must all be held: a conjunction.
 *
 * @category models
 * @since 0.0.0
 */
export const ConjunctiveMarkings = S.Array(MarkingId).pipe(
  $I.annoteSchema("ConjunctiveMarkings", {
    description: "Markings that must all be held to see a value.",
  })
);

/**
 * Runtime type of {@link ConjunctiveMarkings}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConjunctiveMarkings = typeof ConjunctiveMarkings.Type;

/**
 * Marking requirement in conjunctive normal form: every inner set must be met, by holding any one of its markings.
 *
 * **Example** (Read a requirement in conjunctive normal form)
 *
 * ```ts import.meta.vitest name="Read a requirement in conjunctive normal form"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DisjunctiveMarkings } from "@beep/scratchpad/osdk/src/Security/index"
 *
 * const requirement = await Effect.runPromise(
 *   S.decodeUnknownEffect(DisjunctiveMarkings)([["us-only", "eu-only"], ["secret"]])
 * )
 * const clauses = A.map(requirement, (anyOf) => `(${A.join(anyOf, " or ")})`)
 * A.join(clauses, " and ") // => "(us-only or eu-only) and (secret)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DisjunctiveMarkings = MarkingId.pipe(
  S.Array,
  S.Array,
  $I.annoteSchema("DisjunctiveMarkings", {
    description: "Sets of markings where at least one marking of every set must be held to see a value.",
  })
);

/**
 * Runtime type of {@link DisjunctiveMarkings}.
 *
 * @category models
 * @since 0.0.0
 */
export type DisjunctiveMarkings = typeof DisjunctiveMarkings.Type;

// -----------------------------------------------------------------------------
// Security outcomes
// -----------------------------------------------------------------------------

const PropertySecurityKind = LiteralKit(["propertyMarkingSummary", "unsupportedPolicy", "errorComputingSecurity"]);

/**
 * The markings that guard one property value, for the value itself and for the resource that contains it.
 *
 * **Details**
 *
 * `conjunctive` markings must all be held. `disjunctive` is in conjunctive
 * normal form: every inner set must be met, and holding any one marking of a
 * set meets it. The `container` pair states the same two requirements for the
 * containing resource (such as the project of the backing dataset), and they
 * apply on top of the value's own. An absent requirement is treated as no
 * requirement.
 *
 * **Example** (Check held markings against a value's requirements)
 *
 * ```ts import.meta.vitest name="Check held markings against a value's requirements"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { MarkingId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyMarkings } from "@beep/scratchpad/osdk/src/Security/index"
 *
 * const [secret, usOnly, euOnly] = [MarkingId.make("secret"), MarkingId.make("us-only"), MarkingId.make("eu-only")]
 * const markings = PropertyMarkings.make({
 *   conjunctive: O.some([secret]),
 *   disjunctive: O.some([[usOnly, euOnly]]),
 * })
 * const verdicts = [
 *   PropertyMarkings.isSatisfiedBy(markings, HashSet.make(secret, euOnly)),
 *   PropertyMarkings.isSatisfiedBy(markings, HashSet.make(usOnly, euOnly)),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyMarkings extends S.Opaque<PropertyMarkings, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("propertyMarkingSummary"),
    conjunctive: S.OptionFromOptionalKey(ConjunctiveMarkings).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Markings of the value that must all be held." })
    ),
    disjunctive: S.OptionFromOptionalKey(DisjunctiveMarkings).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Marking sets of the value; one marking of every set must be held." })
    ),
    containerConjunctive: S.OptionFromOptionalKey(ConjunctiveMarkings).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Markings of the containing resource that must all be held." })
    ),
    containerDisjunctive: S.OptionFromOptionalKey(DisjunctiveMarkings).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Marking sets of the containing resource; one marking of every set must be held.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PropertyMarkings", {
      description: "The markings that guard one property value, for the value and for the resource that contains it.",
    })
  )
) {
  /**
   * Whether someone holding exactly the given markings meets all four requirements.
   *
   * @param self - The requirements of one property value.
   * @param held - Every marking the principal holds.
   * @returns `true` when no stated requirement is left unmet.
   */
  static readonly isSatisfiedBy: {
    (held: HashSet.HashSet<MarkingId>): (self: PropertyMarkings) => boolean;
    (self: PropertyMarkings, held: HashSet.HashSet<MarkingId>): boolean;
  } = dual(2, (self: PropertyMarkings, held: HashSet.HashSet<MarkingId>): boolean => {
    const holds = (marking: MarkingId): boolean => HashSet.has(held, marking);
    const meetsAll = (required: O.Option<ConjunctiveMarkings>): boolean =>
      O.match(required, { onNone: constTrue, onSome: A.every(holds) });
    const meetsEverySet = (required: O.Option<DisjunctiveMarkings>): boolean =>
      O.match(required, { onNone: constTrue, onSome: A.every(A.some(holds)) });
    return (
      meetsAll(self.conjunctive) &&
      meetsEverySet(self.disjunctive) &&
      meetsAll(self.containerConjunctive) &&
      meetsEverySet(self.containerDisjunctive)
    );
  });
}

/**
 * Outcome for a property backed by a restricted view, whose policy cannot be reported as markings.
 *
 * @category models
 * @since 0.0.0
 */
export class UnsupportedPolicy extends S.Opaque<UnsupportedPolicy, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("unsupportedPolicy") }).pipe(
    $I.annoteSchema("UnsupportedPolicy", {
      description: "Outcome for a property backed by a restricted view, whose policy cannot be reported as markings.",
    })
  )
) {}

/**
 * Outcome when the platform failed to load the security of a property value.
 *
 * @category models
 * @since 0.0.0
 */
export class ErrorComputingSecurity extends S.Opaque<ErrorComputingSecurity, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("errorComputingSecurity") }).pipe(
    $I.annoteSchema("ErrorComputingSecurity", {
      description: "Outcome when the platform failed to load the security of a property value.",
    })
  )
) {}

/**
 * One security outcome for a property value: its markings, or the reason none could be reported.
 *
 * **Example** (Branch on a security outcome)
 *
 * ```ts import.meta.vitest name="Branch on a security outcome"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { MarkingId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyMarkings, PropertySecurity, UnsupportedPolicy } from "@beep/scratchpad/osdk/src/Security/index"
 *
 * const describe = PropertySecurity.match({
 *   propertyMarkingSummary: ({ conjunctive }) => `${A.length(O.getOrElse(conjunctive, A.empty))} required markings`,
 *   unsupportedPolicy: () => "guarded by a restricted view",
 *   errorComputingSecurity: () => "security unavailable",
 * })
 * const outcomes = [
 *   describe(PropertyMarkings.make({ conjunctive: O.some([MarkingId.make("secret")]) })),
 *   describe(UnsupportedPolicy.make({})),
 * ]
 * outcomes // => ["1 required markings", "guarded by a restricted view"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertySecurity = PropertySecurityKind.mapMembers(() =>
  Tuple.make(PropertyMarkings, UnsupportedPolicy, ErrorComputingSecurity)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("PropertySecurity", {
    description: "One security outcome for a property value: its markings, or the reason none could be reported.",
  })
);

/**
 * Runtime type of {@link PropertySecurity}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertySecurity = typeof PropertySecurity.Type;

/**
 * One entry of a response's security table: the alternative security outcomes of a property value.
 *
 * **Details**
 *
 * The outcomes are alternatives (a disjunction), not requirements that all
 * apply. Secured values point at an entry by its position in the table.
 *
 * **Example** (Decode an entry of the security table)
 *
 * ```ts import.meta.vitest name="Decode an entry of the security table"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PropertySecurities } from "@beep/scratchpad/osdk/src/Security/index"
 *
 * const entry = await Effect.runPromise(
 *   S.decodeUnknownEffect(PropertySecurities)({
 *     disjunction: [{ type: "propertyMarkingSummary", conjunctive: ["secret"] }, { type: "unsupportedPolicy" }],
 *   })
 * )
 * const kinds = A.map(entry.disjunction, (outcome) => outcome.type)
 * kinds // => ["propertyMarkingSummary", "unsupportedPolicy"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertySecurities extends S.Opaque<PropertySecurities, { readonly brand: unique symbol }>()(
  S.Struct({
    disjunction: S.Array(PropertySecurity).annotateKey({
      description: "Alternative security outcomes of the property value.",
    }),
  }).pipe(
    $I.annoteSchema("PropertySecurities", {
      description: "One entry of a response's security table: the alternative security outcomes of a property value.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Secured values
// -----------------------------------------------------------------------------

const securedValueImpl = <const Name extends string, Value extends S.Constraint>(name: Name, value: Value) => {
  const identifier: string = name;
  return S.Struct({
    value: S.OptionFromOptionalKey(value).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The property value, absent when the property holds none." })
    ),
    propertySecurityIndex: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Position of the value's entry in the response's security table." })
    ),
  }).pipe(
    $I.annoteSchema(identifier, {
      description: "A property value paired with the position of its entry in the response's security table.",
    })
  );
};

/**
 * Builds the envelope a property value travels in when security metadata is requested.
 *
 * **Details**
 *
 * The envelope pairs the value with `propertySecurityIndex`, the position of
 * its {@link PropertySecurities} entry in the response-level table. Both keys
 * are optional on the wire, so both are `Option` here. `name` identifies the
 * resulting schema, because every value codec yields a distinct envelope.
 *
 * **Example** (Decode a secured number)
 *
 * ```ts import.meta.vitest name="Decode a secured number"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SecuredValue } from "@beep/scratchpad/osdk/src/Security/index"
 *
 * const SecuredCount = SecuredValue("SecuredCount", S.Finite)
 * const secured = await Effect.runPromise(
 *   S.decodeUnknownEffect(SecuredCount)({ value: 10, propertySecurityIndex: 5 })
 * )
 * const facts = [O.getOrNull(secured.value), O.getOrNull(secured.propertySecurityIndex)]
 * facts // => [10, 5]
 * ```
 *
 * @param name - Identifier of the resulting schema, unique among the envelopes of this module.
 * @param value - Codec of the wrapped property value.
 * @returns A struct schema with optional `value` and `propertySecurityIndex`, both decoded to `Option`.
 * @category factories
 * @since 0.0.0
 */
export const SecuredValue: {
  <Value extends S.Constraint>(
    value: Value
  ): <const Name extends string>(name: Name) => ReturnType<typeof securedValueImpl<Name, Value>>;
  <const Name extends string, Value extends S.Constraint>(
    name: Name,
    value: Value
  ): ReturnType<typeof securedValueImpl<Name, Value>>;
} = dual(2, securedValueImpl);
