/**
 * Building shapes, applying them to loaded objects, and computing their identity.
 *
 * **Details**
 *
 * A shape grows through a pipeline: `pipe(shape("Employee"), require(["fullName"]), withDefault("office", "Remote"))`.
 * Every builder also takes the shape first. Nothing here talks to a
 * platform.
 *
 * Three functions do the work. {@link applyShape} projects one object's
 * properties through a shape and reports everything that went wrong at once.
 * {@link toObjectSet} turns a derived link's link set into the object set to
 * load. {@link shapeId} hashes a shape definition. It takes the definition,
 * not the shape, on purpose: the definition is the serialisable part, and the
 * signature makes it impossible to believe a function was hashed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Formatter from "effect/Formatter";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { LinkTypeApiName, ObjectTypeApiName, PropertyApiName } from "../Identifier/Identifier.model.ts";
import { intersect, subtract, traverse, union, where } from "../ObjectSet/ObjectSet.behavior.ts";
import {
  DefaultPolicy,
  DerivedLink,
  DerivedLinkName,
  DropIfNullPolicy,
  DroppedByShape,
  LinkSetOperator,
  NullPolicy,
  RequiredPropertyNull,
  RequirePolicy,
  SelectPolicy,
  ShapeDefinition,
  ShapeId,
  ShapeLinkSet,
  ShapeRejection,
  TransformFailed,
  TransformMissing,
  TransformName,
  TransformPolicy,
  TraversalSegment,
  ViolatedShape,
} from "./Shape.model.ts";
import type { ObjectSet } from "../ObjectSet/ObjectSet.model.ts";
import type { DefaultValue, PropertyTransform, Shape, ShapeViolation } from "./Shape.model.ts";

// -----------------------------------------------------------------------------
// Building
// -----------------------------------------------------------------------------

/**
 * Starts a shape of an object type: no properties kept yet, no links.
 *
 * **Example** (Build a shape in a pipeline)
 *
 * ```ts import.meta.vitest name="Build a shape in a pipeline"
 * import { pipe } from "effect/Function"
 * import * as R from "effect/Record"
 * import { dropIfNull, require, select, shape, withDefault } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(
 *   shape("Employee"),
 *   require(["fullName"]),
 *   select(["startedAt"]),
 *   dropIfNull(["employeeNumber"]),
 *   withDefault("office", "Remote")
 * )
 * const kinds = R.map(card.definition.properties, (policy) => policy.type)
 * kinds // => { fullName: "require", startedAt: "select", employeeNumber: "dropIfNull", office: "withDefault" }
 * ```
 *
 * @param objectType - API name of the object type the shape projects.
 * @throws When `objectType` is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const shape = (objectType: string): Shape => ({
  definition: ShapeDefinition.make({ objectType: ObjectTypeApiName.make(objectType), properties: {} }),
  transforms: {},
});

const withPolicy = (self: Shape, property: string, policy: NullPolicy): Shape => ({
  definition: ShapeDefinition.make({
    objectType: self.definition.objectType,
    properties: R.set(self.definition.properties, PropertyApiName.make(property), policy),
    links: self.definition.links,
  }),
  transforms: self.transforms,
});

const withPolicies = (
  policy: NullPolicy
): {
  (properties: ReadonlyArray<string>): (self: Shape) => Shape;
  (self: Shape, properties: ReadonlyArray<string>): Shape;
} =>
  dual(
    2,
    (self: Shape, properties: ReadonlyArray<string>): Shape =>
      A.reduce(properties, self, (grown, property) => withPolicy(grown, property, policy))
  );

/**
 * Keeps the named properties as they are: a null stays a null.
 *
 * **Details**
 *
 * Giving a property a policy replaces the policy it had. A property the shape
 * never names is left out of the shaped result, which is what makes `select`
 * worth calling. OSDK's `select` checks nothing and removes nothing.
 *
 * **Example** (Keep a property that may be null)
 *
 * ```ts import.meta.vitest name="Keep a property that may be null"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { applyShape, select, shape } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(shape("Employee"), select(["nickname"]))
 * const shaped = applyShape(card, { nickname: O.none(), salary: O.some(1) })
 * shaped // => Result.succeed({ nickname: O.none() })
 * ```
 *
 * @throws When a property name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const select: {
  (properties: ReadonlyArray<string>): (self: Shape) => Shape;
  (self: Shape, properties: ReadonlyArray<string>): Shape;
} = withPolicies(SelectPolicy.make({}));

/**
 * Insists the named properties have a value: a null in any of them is a violation.
 *
 * **Example** (Report a required property that is null)
 *
 * ```ts import.meta.vitest name="Report a required property that is null"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { applyShape, require, shape } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(shape("Employee"), require(["fullName"]))
 * const outcomes = [
 *   Result.isSuccess(applyShape(card, { fullName: O.some("Ada Lovelace") })),
 *   Result.isSuccess(applyShape(card, { fullName: O.none() })),
 * ]
 * outcomes // => [true, false]
 * ```
 *
 * @throws When a property name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const require: {
  (properties: ReadonlyArray<string>): (self: Shape) => Shape;
  (self: Shape, properties: ReadonlyArray<string>): Shape;
} = withPolicies(RequirePolicy.make({}));

/**
 * Leaves an object out when any of the named properties is null, without treating that as an error.
 *
 * **Example** (Drop an object instead of failing on it)
 *
 * ```ts import.meta.vitest name="Drop an object instead of failing on it"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { applyShape, dropIfNull, shape, ShapeRejection } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(shape("Employee"), dropIfNull(["office"]))
 * const reason = Result.match(applyShape(card, { office: O.none() }), {
 *   onSuccess: () => "shaped",
 *   onFailure: ShapeRejection.match({ dropped: () => "dropped", violated: () => "violated" }),
 * })
 * reason // => "dropped"
 * ```
 *
 * @throws When a property name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const dropIfNull: {
  (properties: ReadonlyArray<string>): (self: Shape) => Shape;
  (self: Shape, properties: ReadonlyArray<string>): Shape;
} = withPolicies(DropIfNullPolicy.make({}));

/**
 * Replaces a null in one property with a fixed value.
 *
 * **Example** (Fill a null with a default)
 *
 * ```ts import.meta.vitest name="Fill a null with a default"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { applyShape, shape, withDefault } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(shape("Employee"), withDefault("office", "Remote"))
 * const shaped = [applyShape(card, { office: O.none() }), applyShape(card, { office: O.some("Lyon") })]
 * shaped // => [Result.succeed({ office: "Remote" }), Result.succeed({ office: "Lyon" })]
 * ```
 *
 * @param property - API name of the property.
 * @param defaultValue - Value the property takes when it is null: any JSON value but `null`.
 * @throws When `property` is the empty string or the default is not JSON.
 * @category combinators
 * @since 0.0.0
 */
export const withDefault: {
  (property: string, defaultValue: DefaultValue): (self: Shape) => Shape;
  (self: Shape, property: string, defaultValue: DefaultValue): Shape;
} = dual(
  3,
  (self: Shape, property: string, defaultValue: DefaultValue): Shape =>
    withPolicy(self, property, DefaultPolicy.make({ defaultValue }))
);

/**
 * Passes one property, null or not, through a named function.
 *
 * **Details**
 *
 * The definition records the transform's name. The function is kept beside
 * it, under that name, and is not part of the shape's identity. Registering a
 * second function under a name already in use replaces the first, for every
 * property that names it: one name means one behaviour.
 *
 * **Example** (Compute a property from a possibly null value)
 *
 * ```ts import.meta.vitest name="Compute a property from a possibly null value"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as P from "effect/Predicate"
 * import * as Result from "effect/Result"
 * import * as Str from "effect/String"
 * import { applyShape, shape, withTransform } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(
 *   shape("Employee"),
 *   withTransform("fullName", {
 *     name: "upperCaseOrAnonymous",
 *     apply: (value) => pipe(value, O.filter(P.isString), O.map(Str.toUpperCase), O.getOrElse(() => "ANONYMOUS")),
 *   })
 * )
 * const shaped = [applyShape(card, { fullName: O.some("Ada") }), applyShape(card, {})]
 * shaped // => [Result.succeed({ fullName: "ADA" }), Result.succeed({ fullName: "ANONYMOUS" })]
 * ```
 *
 * @param property - API name of the property.
 * @param transform - The function and the name the definition refers to it by.
 * @throws When `property` or the transform's name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const withTransform: {
  (property: string, transform: PropertyTransform): (self: Shape) => Shape;
  (self: Shape, property: string, transform: PropertyTransform): Shape;
} = dual(3, (self: Shape, property: string, transform: PropertyTransform): Shape => {
  const name = TransformName.make(transform.name);
  return {
    definition: withPolicy(self, property, TransformPolicy.make({ transform: name })).definition,
    transforms: R.set(self.transforms, name, transform.apply),
  };
});

/**
 * A link set that follows the named link types in order from the source object.
 *
 * **Details**
 *
 * This covers the common case. A filter, an order, a limit or a set operation
 * is added by building {@link ShapeLinkSet} directly: every other field has a
 * constructor default.
 *
 * **Example** (Reach the lead of the lead)
 *
 * ```ts import.meta.vitest name="Reach the lead of the lead"
 * import * as A from "effect/Array"
 * import { linkSet } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const skipLevel = linkSet(["lead", "lead"])
 * const links = A.map(skipLevel.segments, (segment) => segment.link)
 * links // => ["lead", "lead"]
 * ```
 *
 * @param links - API names of the link types to follow, in order.
 * @throws When a link name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const linkSet = (links: ReadonlyArray<string>): ShapeLinkSet =>
  ShapeLinkSet.make({
    segments: A.map(links, (link) => TraversalSegment.make({ link: LinkTypeApiName.make(link) })),
  });

/**
 * Adds a derived link to a shape: linked objects to bring along under a name, each in a shape of its own.
 *
 * **Details**
 *
 * The target's definition is nested into this shape's definition, and its
 * transform functions join this shape's. Adding a link under a name already in
 * use replaces the earlier link.
 *
 * **Example** (Bring the lead along)
 *
 * ```ts import.meta.vitest name="Bring the lead along"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import { deriveLink, linkSet, require, shape } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const nameOnly = pipe(shape("Employee"), require(["fullName"]))
 * const withLead = pipe(nameOnly, deriveLink("lead", linkSet(["lead"]), nameOnly))
 * const nested = O.map(R.get(withLead.definition.links, "lead"), (link) => R.keys(link.shape.properties))
 * nested // => O.some(["fullName"])
 * ```
 *
 * @param name - Name the linked objects come back under.
 * @param via - Which objects the link reaches from the source object.
 * @param target - Shape every linked object takes.
 * @throws When `name` is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const deriveLink: {
  (name: string, via: ShapeLinkSet, target: Shape): (self: Shape) => Shape;
  (self: Shape, name: string, via: ShapeLinkSet, target: Shape): Shape;
} = dual(
  4,
  (self: Shape, name: string, via: ShapeLinkSet, target: Shape): Shape => ({
    definition: ShapeDefinition.make({
      objectType: self.definition.objectType,
      properties: self.definition.properties,
      links: R.set(
        self.definition.links,
        DerivedLinkName.make(name),
        DerivedLink.make({ linkSet: via, shape: target.definition })
      ),
    }),
    transforms: R.union(self.transforms, target.transforms, (_, incoming) => incoming),
  })
);

const decodeLinkName = S.decodeOption(DerivedLinkName);

/**
 * The shape of the objects one derived link brings along, ready to apply to them.
 *
 * **Details**
 *
 * The result shares this shape's transform functions, so a transform named by
 * the nested definition is found.
 *
 * **Example** (Apply the nested shape to a linked object)
 *
 * ```ts import.meta.vitest name="Apply the nested shape to a linked object"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { applyShape, deriveLink, linkSet, linkedShape, require, shape } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const nameOnly = pipe(shape("Employee"), require(["fullName"]))
 * const withLead = pipe(shape("Employee"), deriveLink("lead", linkSet(["lead"]), nameOnly))
 * const lead = pipe(
 *   linkedShape(withLead, "lead"),
 *   O.map((nested) => applyShape(nested, { fullName: O.some("Grace Hopper") }))
 * )
 * lead // => O.some(Result.succeed({ fullName: "Grace Hopper" }))
 * ```
 *
 * @param name - Name of the derived link.
 * @returns `none` when the shape has no derived link of that name.
 * @category getters
 * @since 0.0.0
 */
export const linkedShape: {
  (name: string): (self: Shape) => O.Option<Shape>;
  (self: Shape, name: string): O.Option<Shape>;
} = dual(
  2,
  (self: Shape, name: string): O.Option<Shape> =>
    O.map(
      O.flatMap(decodeLinkName(name), (key) => R.get(self.definition.links, key)),
      (link) => ({ definition: link.shape, transforms: self.transforms })
    )
);

/**
 * The object set a link set reaches, given the object set that holds the source object.
 *
 * **Details**
 *
 * The segments are traversed from `source`. Each set operation then combines
 * the result with its operand, which is evaluated from the same `source`, in
 * the order listed. The link set's filter is applied last, to the combined
 * result. An operand is evaluated the same way, so its own filter narrows the
 * operand only.
 *
 * `order` and `limit` are not part of an object set. They belong beside it in
 * the request that loads it, and the caller reads them from the link set.
 * `distinct` needs nothing: the objects of a set are already distinct.
 *
 * OSDK evaluates a link the same way, except that it hands the top-level
 * filter to the query beside the set instead of putting it in the set.
 *
 * **Example** (Reach the reports in Lyon that are not also peers)
 *
 * ```ts import.meta.vitest name="Reach the reports in Lyon that are not also peers"
 * import * as O from "effect/Option"
 * import { eq } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { objectType, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 * import { linkSet, LinkSetOperation, ShapeLinkSet, toObjectSet } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const ada = where(objectType("Employee"), eq("employeeId", 50030))
 * const reports = ShapeLinkSet.make({
 *   segments: linkSet(["reports"]).segments,
 *   where: O.some(eq("office", "Lyon")),
 *   operations: [LinkSetOperation.make({ operator: "subtract", other: linkSet(["peers"]) })],
 * })
 * const reached = toObjectSet(reports, ada)
 * const parts = reached.type === "filter" ? [reached.type, reached.objectSet.type, reached.where.type] : []
 * parts // => ["filter", "subtract", "eq"]
 * ```
 *
 * @param source - The object set holding the source object, usually its object type filtered by primary key.
 * @category projections
 * @since 0.0.0
 */
export const toObjectSet: {
  (source: ObjectSet): (self: ShapeLinkSet) => ObjectSet;
  (self: ShapeLinkSet, source: ObjectSet): ObjectSet;
} = dual(2, (self: ShapeLinkSet, source: ObjectSet): ObjectSet => {
  const reached = A.reduce(self.segments, source, (set, segment): ObjectSet => traverse(set, segment.link));
  const combined = A.reduce(self.operations, reached, (set, operation): ObjectSet => {
    const other = toObjectSet(operation.other, source);
    return LinkSetOperator.match(operation.operator, {
      union: (): ObjectSet => union(set, other),
      intersect: (): ObjectSet => intersect(set, other),
      subtract: (): ObjectSet => subtract(set, other),
    });
  });
  return O.match(self.where, {
    onNone: () => combined,
    onSome: (filter): ObjectSet => where(combined, filter),
  });
});

// -----------------------------------------------------------------------------
// Applying
// -----------------------------------------------------------------------------

type PropertyRecord = Readonly<Record<string, unknown>>;

type ShapedRecord = Readonly<Record<string, unknown>>;

const violated = (violation: ShapeViolation): ShapeRejection => ViolatedShape.make({ violations: [violation] });

const describeThrown = (thrown: unknown): string => (P.isError(thrown) ? thrown.message : Formatter.format(thrown));

// A decoded property is an `Option`. A property a model marks required, and a property read as raw JSON, is bare.
const presence = (held: unknown): O.Option<unknown> => (O.isOption(held) ? held : O.fromNullishOr(held));

// Dropping absorbs violating: an object the caller asked not to see has nothing to report.
const mergeRejections = (self: ShapeRejection, that: ShapeRejection): ShapeRejection =>
  ShapeRejection.match(self, {
    dropped: (dropped) =>
      ShapeRejection.match(that, {
        dropped: (other): ShapeRejection =>
          DroppedByShape.make({ properties: A.appendAll(dropped.properties, other.properties) }),
        violated: (): ShapeRejection => dropped,
      }),
    violated: (found) =>
      ShapeRejection.match(that, {
        dropped: (other): ShapeRejection => other,
        violated: (other): ShapeRejection =>
          ViolatedShape.make({ violations: A.appendAll(found.violations, other.violations) }),
      }),
  });

const shapeProperty = (
  self: Shape,
  properties: PropertyRecord,
  property: PropertyApiName,
  policy: NullPolicy
): Result.Result<unknown, ShapeRejection> => {
  const value = O.flatMap(R.get(properties, property), presence);
  return NullPolicy.match(policy, {
    select: (): Result.Result<unknown, ShapeRejection> => Result.succeed(value),
    require: (): Result.Result<unknown, ShapeRejection> =>
      Result.fromOption(value, () => violated(RequiredPropertyNull.make({ property }))),
    dropIfNull: (): Result.Result<unknown, ShapeRejection> =>
      Result.fromOption(value, () => DroppedByShape.make({ properties: [property] })),
    withDefault: ({ defaultValue }): Result.Result<unknown, ShapeRejection> =>
      Result.succeed(O.getOrElse(value, () => defaultValue)),
    withTransform: ({ transform }): Result.Result<unknown, ShapeRejection> =>
      O.match(R.get(self.transforms, transform), {
        onNone: () => Result.fail(violated(TransformMissing.make({ property, transform }))),
        onSome: (apply) =>
          Result.try({
            try: () => apply(value),
            catch: (thrown) => violated(TransformFailed.make({ property, transform, message: describeThrown(thrown) })),
          }),
      }),
  });
};

/**
 * Projects one object's properties through a shape, or says why there is no shaped object.
 *
 * **Details**
 *
 * `properties` is one object's property record. A property held as an
 * `Option` is null when it is `none`. A property held bare is null when it is
 * `null` or `undefined` and present otherwise. A property missing from the
 * record is null. So the function takes the three records this library
 * produces as they are: the all-`Option` record of a projected instance codec,
 * the properties of a typed model instance (whose primary key is bare), and
 * the raw JSON properties of an untyped object.
 *
 * On success the result holds exactly the properties the shape names. A
 * `select` property is an `Option`, however it was held. A `require`,
 * `dropIfNull` or `withDefault` property is the bare value, since it can no
 * longer be null. A `withTransform` property is whatever its function
 * returned.
 *
 * On failure the result is one of two things, and never a partial answer:
 *
 * - `dropped`, with every drop-if-null property that was null;
 * - `violated`, with every violation: each required property that was null,
 *   each transform that threw, each transform that was never supplied.
 *
 * `dropped` wins when both apply, whatever order the properties are listed
 * in. OSDK returns at the first drop or the first throwing transform it meets
 * in key order, so the answer depends on how the shape was written and later
 * problems stay hidden until the earlier ones are fixed.
 *
 * Every transform runs, including on an object that ends up dropped, so a
 * transform should be a pure function.
 *
 * This function is untyped: names are strings and values are `unknown`. A
 * typed variant over an object model would check property names against the
 * model, type each default and each transform's input by the property's value
 * codec, and compute the shaped record's static type per policy
 * (`Option<Value>` for `select`, `Value` for the null-removing policies, the
 * function's return type for a transform). It needs one more heterogeneous
 * map from policies to output codecs and a guard where a typed transform
 * meets the untyped record, and is left to the typed layer.
 *
 * **Example** (Collect every violation at once)
 *
 * ```ts import.meta.vitest name="Collect every violation at once"
 * import * as A from "effect/Array"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { applyShape, require, shape, ShapeRejection, withTransform } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const card = pipe(
 *   shape("Employee"),
 *   require(["fullName", "office"]),
 *   withTransform("badge", {
 *     name: "badgeLabel",
 *     apply: () => {
 *       throw new Error("no badge printer")
 *     },
 *   })
 * )
 * const found = Result.match(applyShape(card, { fullName: O.none(), office: O.none(), badge: O.some(7) }), {
 *   onSuccess: () => A.empty<string>(),
 *   onFailure: ShapeRejection.match({
 *     dropped: () => A.empty<string>(),
 *     violated: ({ violations }) => A.map(violations, (violation) => `${violation.type}:${violation.property}`),
 *   }),
 * })
 * found // => ["requiredPropertyNull:fullName", "requiredPropertyNull:office", "transformFailed:badge"]
 * ```
 *
 * @param shape - The shape to apply.
 * @param properties - The object's properties, keyed by property API name.
 * @returns The shaped record, or the reason there is none.
 * @category projections
 * @since 0.0.0
 */
export const applyShape: {
  (properties: PropertyRecord): (shape: Shape) => Result.Result<ShapedRecord, ShapeRejection>;
  (shape: Shape, properties: PropertyRecord): Result.Result<ShapedRecord, ShapeRejection>;
} = dual(2, (self: Shape, properties: PropertyRecord): Result.Result<ShapedRecord, ShapeRejection> => {
  const [kept, rejections] = A.separate(
    A.map(R.toEntries(self.definition.properties), ([property, policy]) =>
      Result.map(shapeProperty(self, properties, property, policy), (value) => Tuple.make(property, value))
    )
  );
  return A.match(rejections, {
    onEmpty: () => Result.succeed(R.fromEntries(kept)),
    onNonEmpty: (found) => Result.fail(A.reduce(A.tailNonEmpty(found), A.headNonEmpty(found), mergeRejections)),
  });
});

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

const encodeDefinition = S.encodeEffect(ShapeDefinition);

const encodeJsonText = S.encodeUnknownEffect(S.fromJsonString(S.Json));

const decodeShapeId = S.decodeEffect(ShapeId);

const isRecord = S.is(S.Record(S.String, S.Unknown));

const utf8 = new TextEncoder();

const byKey = Order.mapInput(Order.String, (entry: readonly [string, unknown]) => entry[0]);

// Arrays keep their order, because order means something in them. Record keys are sorted, because it does not.
const canonical = (value: unknown): unknown =>
  A.isArray(value)
    ? A.map(value, canonical)
    : isRecord(value)
      ? R.fromEntries(A.map(A.sort(R.toEntries(value), byKey), ([key, child]) => Tuple.make(key, canonical(child))))
      : value;

/**
 * The text a shape's identity is computed from: the definition's JSON with every record's keys sorted.
 *
 * **Details**
 *
 * Two definitions that are the same data produce the same text, whatever
 * order their properties, links or default-value fields were written in.
 * Arrays keep their order: the order of traversal segments and of set
 * operations is part of what a link set means.
 *
 * **Example** (Write the same shape in two orders)
 *
 * ```ts import.meta.vitest name="Write the same shape in two orders"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import { canonicalJson, require, select, shape } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const one = pipe(shape("Employee"), require(["fullName"]), select(["office"]))
 * const other = pipe(shape("Employee"), select(["office"]), require(["fullName"]))
 * const texts = await Effect.runPromise(Effect.all([canonicalJson(one.definition), canonicalJson(other.definition)]))
 * const facts = [texts[0] === texts[1], texts[0]]
 * facts // => [true, '{"links":{},"objectType":"Employee","properties":{"fullName":{"type":"require"},"office":{"type":"select"}}}']
 * ```
 *
 * @param definition - The shape definition to render.
 * @category serialization
 * @since 0.0.0
 */
export const canonicalJson = Effect.fn("Shape.canonicalJson")(function* (definition: ShapeDefinition) {
  const encoded = yield* encodeDefinition(definition);
  return yield* encodeJsonText(canonical(encoded));
}, Effect.orDie);

/**
 * Identity of a shape definition: the SHA-256 digest of its canonical JSON.
 *
 * **Details**
 *
 * The whole definition is hashed: the object type, every policy with its
 * default value or transform name, and every derived link with its link set
 * and nested shape. Nothing else exists to hash, because the argument is the
 * definition and not the shape. Transform functions are outside it. Their
 * names are inside it, so renaming a transform changes the identity and
 * swapping the function behind a name does not.
 *
 * OSDK hashes with a 32-bit djb2, records that a property has a transform
 * but not which one (two shapes with different transforms on one property
 * collide), and drops anything JSON cannot hold from link filters.
 *
 * The digest comes from the `Digest` service of `effect/crypto/Digest`.
 *
 * **Example** (Tell two shapes apart by a default value)
 *
 * ```ts import.meta.vitest name="Tell two shapes apart by a default value"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as Str from "effect/String"
 * import { shape, shapeId, withDefault } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const remote = pipe(shape("Employee"), withDefault("office", "Remote"))
 * const lyon = pipe(shape("Employee"), withDefault("office", "Lyon"))
 * const ids = await Effect.runPromise(
 *   Effect.all([shapeId(remote.definition), shapeId(remote.definition), shapeId(lyon.definition)]).pipe(
 *     Effect.provide(Digest.layerWebCrypto)
 *   )
 * )
 * const facts = [Str.length(ids[0]), ids[0] === ids[1], ids[0] === ids[2]]
 * facts // => [64, true, false]
 * ```
 *
 * @param definition - The shape definition to identify.
 * @category identifiers
 * @since 0.0.0
 */
export const shapeId = Effect.fn("Shape.shapeId")(function* (definition: ShapeDefinition) {
  const text = yield* canonicalJson(definition);
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, utf8.encode(text));
  return yield* decodeShapeId(hex);
}, Effect.orDie);
