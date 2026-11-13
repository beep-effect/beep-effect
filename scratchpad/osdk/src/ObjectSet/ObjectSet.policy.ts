/**
 * Rules an object set must obey that its shape alone does not enforce, checked without a platform.
 *
 * **Details**
 *
 * OSDK learns about these rules late or not at all: one is an invariant thrown
 * when a page is fetched, the others are sentences in documentation that the
 * platform enforces with an error response. {@link checkObjectSet} applies all
 * of them to a whole tree up front and returns every finding as data.
 *
 * One documented rule is deliberately absent. Reading a single value through a
 * to-many link is rejected by the platform, but whether a link is to-many is a
 * fact of the ontology, so that rule belongs to a check that has one in hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { SelectedPropertyOperation } from "../DerivedProperty/DerivedProperty.model.ts";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import { foldDerivedProperty, foldObjectSet, hasDerivedProperties } from "./ObjectSet.behavior.ts";
import type { DerivedProperty } from "../DerivedProperty/DerivedProperty.model.ts";
import type { ObjectSet } from "./ObjectSet.model.ts";

const $I = $ScratchpadId.create("osdk/ObjectSet/ObjectSet.policy");

// -----------------------------------------------------------------------------
// Limits
// -----------------------------------------------------------------------------

/**
 * The numeric limits the platform documents for object sets and derived properties.
 *
 * **Example** (Read the documented limits)
 *
 * ```ts import.meta.vitest name="Read the documented limits"
 * import { objectSetLimits } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const limits = [objectSetLimits.minNeighbors, objectSetLimits.maxNeighbors, objectSetLimits.maxCollected]
 * limits // => [1, 500, 100]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const objectSetLimits: {
  readonly minNeighbors: number;
  readonly maxNeighbors: number;
  readonly maxCollected: number;
  readonly minOperands: number;
} = {
  minNeighbors: 1,
  maxNeighbors: 500,
  maxCollected: 100,
  minOperands: 2,
};

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

const SetOperator = LiteralKit(["union", "intersect", "subtract"]);

const CollectOperation = LiteralKit(["collectList", "collectSet"]);

const VariadicOperator = LiteralKit(["add", "multiply", "least", "greatest"]);

const ObjectSetFindingKind = LiteralKit([
  "derivedPropertiesInOperand",
  "neighborCountOutOfRange",
  "collectLimitExceeded",
  "tooFewOperands",
]);

/**
 * An operand of a union, intersection or difference carries derived properties.
 *
 * **Details**
 *
 * The platform cannot combine sets whose objects have different extra
 * properties. Attach derived properties after combining the sets instead.
 *
 * @category models
 * @since 0.0.0
 */
export class DerivedPropertiesInOperand extends S.Opaque<
  DerivedPropertiesInOperand,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("derivedPropertiesInOperand"),
    operator: SetOperator.annotateKey({ description: "The combination whose operand is at fault." }),
    operand: S.Int.annotateKey({ description: "Zero-based position of the offending operand." }),
  }).pipe(
    $I.annoteSchema("DerivedPropertiesInOperand", {
      description: "An operand of a union, intersection or difference carries derived properties.",
    })
  )
) {}

/**
 * A nearest-neighbour search asks for a number of objects outside the documented range.
 *
 * @category models
 * @since 0.0.0
 */
export class NeighborCountOutOfRange extends S.Opaque<NeighborCountOutOfRange, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("neighborCountOutOfRange"),
    count: S.Int.annotateKey({ description: "The count that was asked for." }),
  }).pipe(
    $I.annoteSchema("NeighborCountOutOfRange", {
      description: "A nearest-neighbour search asks for a number of objects outside the documented range.",
    })
  )
) {}

/**
 * A collecting operation asks for more values than the platform returns.
 *
 * @category models
 * @since 0.0.0
 */
export class CollectLimitExceeded extends S.Opaque<CollectLimitExceeded, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("collectLimitExceeded"),
    operation: CollectOperation.annotateKey({ description: "The collecting operation at fault." }),
    property: PropertyApiName.annotateKey({ description: "Property whose values are collected." }),
    limit: S.Int.annotateKey({ description: "The limit that was asked for." }),
  }).pipe(
    $I.annoteSchema("CollectLimitExceeded", {
      description: "A collecting operation asks for more values than the platform returns.",
    })
  )
) {}

/**
 * A sum, product, least or greatest has fewer than the two operands the platform requires.
 *
 * @category models
 * @since 0.0.0
 */
export class TooFewOperands extends S.Opaque<TooFewOperands, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("tooFewOperands"),
    operator: VariadicOperator.annotateKey({ description: "The expression at fault." }),
    operands: S.Int.annotateKey({ description: "How many operands it has." }),
  }).pipe(
    $I.annoteSchema("TooFewOperands", {
      description: "A sum, product, least or greatest has fewer than the two operands the platform requires.",
    })
  )
) {}

/**
 * One way an object set breaks a rule the platform enforces but the wire shape does not.
 *
 * **Example** (Explain a finding in words)
 *
 * ```ts import.meta.vitest name="Explain a finding in words"
 * import { NeighborCountOutOfRange, ObjectSetFinding } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const explain = ObjectSetFinding.match({
 *   derivedPropertiesInOperand: ({ operator, operand }) => `operand ${operand} of ${operator} has derived properties`,
 *   neighborCountOutOfRange: ({ count }) => `${count} neighbours is outside 1 to 500`,
 *   collectLimitExceeded: ({ operation, limit }) => `${operation} of ${limit} values exceeds 100`,
 *   tooFewOperands: ({ operator, operands }) => `${operator} of ${operands} operands needs two`,
 * })
 * explain(NeighborCountOutOfRange.make({ count: 0 })) // => "0 neighbours is outside 1 to 500"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectSetFinding = ObjectSetFindingKind.mapMembers(() =>
  Tuple.make(DerivedPropertiesInOperand, NeighborCountOutOfRange, CollectLimitExceeded, TooFewOperands)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ObjectSetFinding", {
    description: "One way an object set breaks a rule the platform enforces but the wire shape does not.",
  })
);

/**
 * Runtime type of {@link ObjectSetFinding}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectSetFinding = typeof ObjectSetFinding.Type;

// -----------------------------------------------------------------------------
// Checks
// -----------------------------------------------------------------------------

type Findings = ReadonlyArray<ObjectSetFinding>;

const noFindings: Findings = A.empty();

const checkCollected =
  (operation: typeof CollectOperation.Type) =>
  ({ property, limit }: { readonly property: PropertyApiName; readonly limit: number }): Findings =>
    limit > objectSetLimits.maxCollected ? A.of(CollectLimitExceeded.make({ operation, property, limit })) : noFindings;

const checkOperation: (operation: SelectedPropertyOperation) => Findings = SelectedPropertyOperation.matchOrElse(
  {
    collectList: checkCollected("collectList"),
    collectSet: checkCollected("collectSet"),
  },
  () => noFindings
);

const checkArity =
  (operator: typeof VariadicOperator.Type) =>
  (operands: ReadonlyArray<Findings>): Findings =>
    A.length(operands) < objectSetLimits.minOperands
      ? A.prepend(A.flatten(operands), TooFewOperands.make({ operator, operands: A.length(operands) }))
      : A.flatten(operands);

const checkOperands =
  (operator: typeof SetOperator.Type) =>
  (operands: ReadonlyArray<Findings>, set: { readonly objectSets: ReadonlyArray<ObjectSet> }): Findings =>
    A.appendAll(
      A.getSomes(
        A.map(set.objectSets, (operand, index) =>
          hasDerivedProperties(operand)
            ? O.some(DerivedPropertiesInOperand.make({ operator, operand: index }))
            : O.none()
        )
      ),
      A.flatten(operands)
    );

/**
 * Every rule a derived property breaks, including those broken by the object sets its selections read through.
 *
 * **Details**
 *
 * Reports a collecting operation whose limit exceeds 100 and a sum, product,
 * least or greatest with fewer than two operands. A finding of an outer
 * expression comes before the findings of its operands.
 *
 * **Example** (Catch an oversized collection inside a formula)
 *
 * ```ts import.meta.vitest name="Catch an oversized collection inside a formula"
 * import * as A from "effect/Array"
 * import { pipe } from "effect/Function"
 * import { SelectedList } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 * import {
 *   abs,
 *   aggregate,
 *   checkDerivedProperty,
 *   currentObject,
 *   traverse,
 * } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const names = pipe(currentObject, traverse("peeps"), aggregate(SelectedList.of("fullName", 250)))
 * const kinds = A.map(checkDerivedProperty(abs(names)), (finding) => finding.type)
 * kinds // => ["collectLimitExceeded"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkDerivedProperty: (definition: DerivedProperty) => Findings = foldDerivedProperty<Findings>({
  property: () => noFindings,
  selection: ({ objectSet, operation }) => A.appendAll(checkOperation(operation), checkObjectSet(objectSet)),
  add: checkArity("add"),
  subtract: (left, right) => A.appendAll(left, right),
  multiply: checkArity("multiply"),
  divide: (left, right) => A.appendAll(left, right),
  absoluteValue: identity,
  negate: identity,
  least: checkArity("least"),
  greatest: checkArity("greatest"),
  extract: identity,
});

/**
 * Every rule an object set breaks, found by walking the whole tree and the derived properties inside it.
 *
 * **Details**
 *
 * Reports an operand of a union, intersection or difference that carries
 * derived properties, a nearest-neighbour count outside 1 to 500, and
 * everything {@link checkDerivedProperty} reports for each attached derived
 * property. A finding of an outer set comes before the findings of the sets it
 * is built from. An empty result means no rule that can be checked without an
 * ontology is broken.
 *
 * **Example** (Collect every finding of an object set)
 *
 * ```ts import.meta.vitest name="Collect every finding of an object set"
 * import * as A from "effect/Array"
 * import { pipe } from "effect/Function"
 * import { SelectedSet } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 * import {
 *   aggregate,
 *   checkObjectSet,
 *   currentObject,
 *   nearestNeighbors,
 *   objectType,
 *   traverse,
 *   union,
 *   withProperties,
 * } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const offices = pipe(currentObject, traverse("peeps"), aggregate(SelectedSet.of("office", 500)))
 * const employees = pipe(objectType("Employee"), withProperties({ offices }))
 * const set = pipe(objectType("Document"), nearestNeighbors("revenue", 1000, "embedding"), union(employees))
 * const kinds = A.map(checkObjectSet(set), (finding) => finding.type)
 * kinds // => ["derivedPropertiesInOperand", "neighborCountOutOfRange", "collectLimitExceeded"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkObjectSet: (set: ObjectSet) => Findings = foldObjectSet<Findings>({
  base: () => noFindings,
  interfaceBase: () => noFindings,
  static: () => noFindings,
  reference: () => noFindings,
  methodInput: () => noFindings,
  filter: identity,
  searchAround: identity,
  interfaceLinkSearchAround: identity,
  asType: identity,
  asBaseObjectTypes: identity,
  nearestNeighbors: (source, { count }) =>
    count < objectSetLimits.minNeighbors || count > objectSetLimits.maxNeighbors
      ? A.prepend(source, NeighborCountOutOfRange.make({ count }))
      : source,
  withProperties: (source, { derivedProperties }) =>
    A.appendAll(A.flatMap(R.values(derivedProperties), checkDerivedProperty), source),
  union: checkOperands("union"),
  intersect: checkOperands("intersect"),
  subtract: checkOperands("subtract"),
});
