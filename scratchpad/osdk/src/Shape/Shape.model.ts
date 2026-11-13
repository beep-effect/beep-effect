/**
 * Shapes: which properties of an object a caller needs, what to do when one is null, and which linked objects to bring along.
 *
 * **Details**
 *
 * A shape is a client-side projection of one object type. It never travels to
 * the platform: it is applied to an object that was already loaded. OSDK keeps
 * a shape as a frozen bag of `__`-prefixed fields in which data, phantom types
 * and functions sit side by side, and then hashes the bag while silently
 * skipping whatever JSON cannot hold.
 *
 * Here the two halves are separate types, and the split is the point:
 *
 * - {@link ShapeDefinition} is data. It is a schema, so it serialises, compares
 *   structurally and has an identity (`shapeId`). Everything in it is hashed.
 * - {@link Shape} pairs a definition with the transform functions the
 *   definition names. Functions are not data: they do not serialise, they have
 *   no identity a hash could read, and they are never hashed.
 *
 * A transform is therefore named. The definition holds the name
 * ({@link TransformPolicy}), the name takes part in the identity, and the
 * function is supplied beside the definition under that name. Two shapes that
 * differ only in a transform differ in its name. OSDK gives them the same id.
 *
 * There is no wire form to stay faithful to. The encoded side is this
 * library's own JSON, chosen so that a definition can be stored and compared.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { ObjectFilter } from "../Filter/Filter.model.ts";
import { LinkTypeApiName, ObjectTypeApiName, PropertyApiName } from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { OrderBy } from "../ObjectSet/ObjectSet.model.ts";
import type * as O from "effect/Option";

const $I = $ScratchpadId.create("osdk/Shape/Shape.model");

// -----------------------------------------------------------------------------
// Names and small values
// -----------------------------------------------------------------------------

/**
 * Name under which a transform function is registered, standing in for the function wherever data is needed.
 *
 * **Details**
 *
 * A function has no identity that survives serialisation, so a shape
 * definition refers to a transform by name and the name is what gets hashed.
 * Give two different functions two different names: one name means one
 * behaviour.
 *
 * **Example** (Name a transform)
 *
 * ```ts import.meta.vitest name="Name a transform"
 * import * as S from "effect/Schema"
 * import { TransformName } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const verdicts = [S.is(TransformName)("initials"), S.is(TransformName)("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TransformName = S.NonEmptyString.pipe(
  S.brand("TransformName"),
  $I.annoteSchema("TransformName", {
    description: "Name under which a transform function is registered, standing in for the function in data.",
  })
);

/**
 * Runtime type of {@link TransformName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TransformName = typeof TransformName.Type;

/**
 * Name a shape gives to one of its derived links: the key the linked objects come back under.
 *
 * **Example** (Name a derived link)
 *
 * ```ts import.meta.vitest name="Name a derived link"
 * import * as S from "effect/Schema"
 * import { DerivedLinkName } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const verdicts = [S.is(DerivedLinkName)("reports"), S.is(DerivedLinkName)("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DerivedLinkName = S.NonEmptyString.pipe(
  S.brand("DerivedLinkName"),
  $I.annoteSchema("DerivedLinkName", {
    description: "Name a shape gives to one of its derived links: the key the linked objects come back under.",
  })
);

/**
 * Runtime type of {@link DerivedLinkName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type DerivedLinkName = typeof DerivedLinkName.Type;

/**
 * A value that replaces a null property: any JSON value except `null`.
 *
 * **Details**
 *
 * A default is data, so it is JSON. It is the property's value in its wire
 * form: a date default is ISO text. `null` is excluded because defaulting a
 * null to null says nothing.
 *
 * **Example** (Accept every JSON value but null)
 *
 * ```ts import.meta.vitest name="Accept every JSON value but null"
 * import * as S from "effect/Schema"
 * import { DefaultValue } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const accepts = S.is(DefaultValue)
 * const verdicts = [accepts("n/a"), accepts(0), accepts(["a"]), accepts({ city: "Lyon" }), accepts(null)]
 * verdicts // => [true, true, true, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DefaultValue = S.Union([S.String, S.Finite, S.Boolean, S.Array(S.Json), S.Record(S.String, S.Json)]).pipe(
  $I.annoteSchema("DefaultValue", {
    description: "A value that replaces a null property: any JSON value except null.",
  })
);

/**
 * Runtime type of {@link DefaultValue}.
 *
 * @category models
 * @since 0.0.0
 */
export type DefaultValue = typeof DefaultValue.Type;

/**
 * The most linked objects a derived link asks for: a positive whole number.
 *
 * **Example** (Reject a limit of zero)
 *
 * ```ts import.meta.vitest name="Reject a limit of zero"
 * import * as S from "effect/Schema"
 * import { LinkLimit } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const verdicts = [S.is(LinkLimit)(10), S.is(LinkLimit)(0), S.is(LinkLimit)(2.5)]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LinkLimit = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("LinkLimit", {
    description: "The most linked objects a derived link asks for: a positive whole number.",
  })
);

/**
 * Runtime type of {@link LinkLimit}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinkLimit = typeof LinkLimit.Type;

/**
 * Identity of a shape definition: the SHA-256 digest of its canonical JSON, as 64 lower-case hex characters.
 *
 * **Details**
 *
 * OSDK's shape id is a 32-bit djb2 hash, eight hex characters, used as a cache
 * key and as equality. With thirty-two bits, two of about 77,000 distinct
 * shapes are more likely than not to share an id. This one is a cryptographic
 * digest of the whole definition.
 *
 * **Example** (Recognise a shape id)
 *
 * ```ts import.meta.vitest name="Recognise a shape id"
 * import * as S from "effect/Schema"
 * import { ShapeId } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const verdicts = [
 *   S.is(ShapeId)("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   S.is(ShapeId)("1a2b3c4d"),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ShapeId = Sha256Hex.pipe(
  S.brand("ShapeId"),
  $I.annoteSchema("ShapeId", {
    description: "Identity of a shape definition: the SHA-256 digest of its canonical JSON, in lower-case hex.",
  })
);

/**
 * Runtime type of {@link ShapeId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ShapeId = typeof ShapeId.Type;

// -----------------------------------------------------------------------------
// Null policies
// -----------------------------------------------------------------------------

const NullPolicyKind = LiteralKit(["select", "require", "dropIfNull", "withDefault", "withTransform"]);

/**
 * Takes the property as it is: a null stays a null.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectPolicy extends S.Opaque<SelectPolicy, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("select") }).pipe(
    $I.annoteSchema("SelectPolicy", { description: "Takes the property as it is: a null stays a null." })
  )
) {}

/**
 * Insists the property has a value: a null is a violation of the shape.
 *
 * @category models
 * @since 0.0.0
 */
export class RequirePolicy extends S.Opaque<RequirePolicy, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("require") }).pipe(
    $I.annoteSchema("RequirePolicy", {
      description: "Insists the property has a value: a null is a violation of the shape.",
    })
  )
) {}

/**
 * Leaves the whole object out when the property is null, without treating that as an error.
 *
 * @category models
 * @since 0.0.0
 */
export class DropIfNullPolicy extends S.Opaque<DropIfNullPolicy, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("dropIfNull") }).pipe(
    $I.annoteSchema("DropIfNullPolicy", {
      description: "Leaves the whole object out when the property is null, without treating that as an error.",
    })
  )
) {}

/**
 * Replaces a null with a fixed value.
 *
 * @category models
 * @since 0.0.0
 */
export class DefaultPolicy extends S.Opaque<DefaultPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("withDefault"),
    defaultValue: DefaultValue.annotateKey({ description: "Value the property takes when it is null." }),
  }).pipe($I.annoteSchema("DefaultPolicy", { description: "Replaces a null with a fixed value." }))
) {}

/**
 * Passes the property, null or not, through a named transform function.
 *
 * **Details**
 *
 * This record holds the transform's name, not the transform. The function
 * lives in {@link Shape}, beside the definition, under the same name. A
 * definition decoded from JSON therefore needs its functions supplied again
 * before it can be applied.
 *
 * @category models
 * @since 0.0.0
 */
export class TransformPolicy extends S.Opaque<TransformPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("withTransform"),
    transform: TransformName.annotateKey({ description: "Name of the function that computes the property's value." }),
  }).pipe(
    $I.annoteSchema("TransformPolicy", {
      description: "Passes the property, null or not, through a named transform function.",
    })
  )
) {}

/**
 * What a shape does with one property, and in particular with its null.
 *
 * **Details**
 *
 * The five cases are OSDK's five nullability operations, under their own
 * tags. All five are data. The fifth, `withTransform`, is data only because
 * it names its function instead of holding it.
 *
 * **Example** (Say what each policy does with a null)
 *
 * ```ts import.meta.vitest name="Say what each policy does with a null"
 * import * as A from "effect/Array"
 * import { DefaultPolicy, NullPolicy, RequirePolicy, SelectPolicy } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const onNull = NullPolicy.match({
 *   select: () => "stays null",
 *   require: () => "violation",
 *   dropIfNull: () => "object dropped",
 *   withDefault: ({ defaultValue }) => `becomes ${defaultValue}`,
 *   withTransform: ({ transform }) => `given to ${transform}`,
 * })
 * const policies = [SelectPolicy.make({}), RequirePolicy.make({}), DefaultPolicy.make({ defaultValue: "n/a" })]
 * const verdicts = A.map(policies, onNull)
 * verdicts // => ["stays null", "violation", "becomes n/a"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NullPolicy = NullPolicyKind.mapMembers(() =>
  Tuple.make(SelectPolicy, RequirePolicy, DropIfNullPolicy, DefaultPolicy, TransformPolicy)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("NullPolicy", {
    description: "What a shape does with one property, and in particular with its null.",
  })
);

/**
 * Runtime type of {@link NullPolicy}.
 *
 * @category models
 * @since 0.0.0
 */
export type NullPolicy = typeof NullPolicy.Type;

// -----------------------------------------------------------------------------
// Link sets
// -----------------------------------------------------------------------------

/**
 * One step of a derived link: follow a link type from the objects reached so far.
 *
 * **Details**
 *
 * OSDK's segment also carries a `type` that has one possible value, a
 * `sourceType` that is an API name for the first segment and a dotted debug
 * path after it, and a `targetType` nothing ever fills in. Only the link name
 * means something.
 *
 * @category models
 * @since 0.0.0
 */
export class TraversalSegment extends S.Opaque<TraversalSegment, { readonly brand: unique symbol }>()(
  S.Struct({
    link: LinkTypeApiName.annotateKey({ description: "Link type to follow." }),
  }).pipe(
    $I.annoteSchema("TraversalSegment", {
      description: "One step of a derived link: follow a link type from the objects reached so far.",
    })
  )
) {}

/**
 * How two link sets combine: pooled, narrowed to what they share, or the first without the second.
 *
 * **Example** (Describe a set operator)
 *
 * ```ts import.meta.vitest name="Describe a set operator"
 * import { LinkSetOperator } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const describe = LinkSetOperator.match({
 *   union: () => "in either",
 *   intersect: () => "in both",
 *   subtract: () => "in the first only",
 * })
 * describe("subtract") // => "in the first only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LinkSetOperator = LiteralKit(["union", "intersect", "subtract"]).pipe(
  $I.annoteSchema("LinkSetOperator", {
    description: "How two link sets combine: pooled, narrowed to what they share, or the first without the second.",
  })
);

/**
 * Runtime type of {@link LinkSetOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinkSetOperator = typeof LinkSetOperator.Type;

const suspendedLinkSet = S.suspend((): S.ConstraintCodec<ShapeLinkSet, ShapeLinkSet.Encoded> => ShapeLinkSet);

/**
 * Combines the link set it belongs to with another link set rooted at the same source object.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkSetOperation extends S.Opaque<LinkSetOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    operator: LinkSetOperator.annotateKey({ description: "How the two link sets combine." }),
    other: suspendedLinkSet,
  }).pipe(
    $I.annoteSchema("LinkSetOperation", {
      description: "Combines the link set it belongs to with another link set rooted at the same source object.",
    })
  )
) {}

/**
 * Companion namespace for {@link LinkSetOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LinkSetOperation {
  /**
   * Encoded form of {@link LinkSetOperation}, declared explicitly because link sets are recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly operator: LinkSetOperator;
    readonly other: ShapeLinkSet.Encoded;
  }
}

/**
 * Which objects a derived link reaches from one source object, and how many of them in what order.
 *
 * **Details**
 *
 * `segments` are followed in order, starting at the source object. Each
 * entry of `operations` then combines the result so far with another link set
 * that starts from the same source object, in the order listed. `where` keeps
 * the objects of the combined result that match. `order`, `limit` and
 * `distinct` apply to the final result and mean nothing on a link set used as
 * an operand.
 *
 * OSDK stores the same fields and evaluates them the same way, except that
 * it never applies `distinct` to a query. It also lets a filter mention the
 * source object's primary key through a placeholder symbol, which its hash
 * cannot see. A filter here is plain data and has no such placeholder.
 *
 * **Example** (Describe the first five reports that are not also peers)
 *
 * ```ts import.meta.vitest name="Describe the first five reports that are not also peers"
 * import * as O from "effect/Option"
 * import {
 *   LinkLimit,
 *   LinkSetOperation,
 *   ShapeLinkSet,
 *   TraversalSegment,
 * } from "@beep/scratchpad/osdk/src/Shape/index"
 * import { LinkTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const along = (link: string) => TraversalSegment.make({ link: LinkTypeApiName.make(link) })
 * const reports = ShapeLinkSet.make({
 *   segments: [along("reports")],
 *   limit: O.some(LinkLimit.make(5)),
 *   operations: [
 *     LinkSetOperation.make({ operator: "subtract", other: ShapeLinkSet.make({ segments: [along("peers")] }) }),
 *   ],
 * })
 * const facts = [reports.segments.length, reports.distinct, reports.operations.length, O.isNone(reports.where)]
 * facts // => [1, false, 1, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShapeLinkSet extends S.Opaque<ShapeLinkSet, { readonly brand: unique symbol }>()(
  S.Struct({
    segments: S.Array(TraversalSegment).annotateKey({
      description: "Link types to follow from the source object, in order.",
    }),
    where: S.OptionFromOptionalKey(ObjectFilter).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Filter the combined result must satisfy." })
    ),
    order: S.OptionFromOptionalKey(OrderBy).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Order of the final result." })
    ),
    limit: S.OptionFromOptionalKey(LinkLimit).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The most objects of the final result to load." })
    ),
    distinct: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false)),
      S.annotateKey({ description: "Whether an object reached along several paths counts once." })
    ),
    operations: S.Array(LinkSetOperation)
      .check(RecursiveArraySizeHint)
      .pipe(
        S.withConstructorDefault(Effect.succeed(A.empty<LinkSetOperation>())),
        S.withDecodingDefaultKey(Effect.succeed(A.empty<LinkSetOperation.Encoded>())),
        S.annotateKey({ description: "Other link sets to combine with this one, applied in order." })
      ),
  }).pipe(
    $I.annoteSchema("ShapeLinkSet", {
      description: "Which objects a derived link reaches from one source object, and how many in what order.",
    })
  )
) {}

/**
 * Companion namespace for {@link ShapeLinkSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ShapeLinkSet {
  /**
   * Encoded form of {@link ShapeLinkSet}, declared explicitly because link sets are recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly segments: ReadonlyArray<(typeof TraversalSegment)["Encoded"]>;
    readonly where?: ObjectFilter.Encoded;
    readonly order?: (typeof OrderBy)["Encoded"];
    readonly limit?: number;
    readonly distinct?: boolean;
    readonly operations?: ReadonlyArray<LinkSetOperation.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// Shape definitions
// -----------------------------------------------------------------------------

const suspendedShapeDefinition = S.suspend(
  (): S.ConstraintCodec<ShapeDefinition, ShapeDefinition.Encoded> => ShapeDefinition
);

/**
 * A derived link of a shape: the linked objects to bring along, and the shape each of them takes.
 *
 * **Details**
 *
 * The link's name is its key in {@link ShapeDefinition}'s `links`, so two
 * links of one shape cannot share a name. OSDK keeps a list and does not check
 * it. OSDK's `defer` flag is absent: when to load a link is the consumer's
 * decision, not part of what the shape is.
 *
 * @category models
 * @since 0.0.0
 */
export class DerivedLink extends S.Opaque<DerivedLink, { readonly brand: unique symbol }>()(
  S.Struct({
    linkSet: ShapeLinkSet,
    shape: suspendedShapeDefinition,
  }).pipe(
    $I.annoteSchema("DerivedLink", {
      description: "A derived link of a shape: the linked objects to bring along, and the shape each of them takes.",
    })
  )
) {}

/**
 * Companion namespace for {@link DerivedLink}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DerivedLink {
  /**
   * Encoded form of {@link DerivedLink}, declared explicitly because shapes are recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly linkSet: ShapeLinkSet.Encoded;
    readonly shape: ShapeDefinition.Encoded;
  }
}

/**
 * The serialisable part of a shape: its object type, a null policy per property, and its derived links.
 *
 * **Details**
 *
 * Every field is data, and every field takes part in the shape's identity. A
 * property the shape does not list is not part of the shaped result. A
 * transform appears here by name only (see {@link TransformPolicy}).
 *
 * A property has at most one policy because `properties` is keyed by property
 * name. OSDK enforces that with a type-level `Exclude`, lets its builder
 * overwrite silently at runtime, and throws from its inline form.
 *
 * **Example** (Decode a stored shape definition)
 *
 * ```ts import.meta.vitest name="Decode a stored shape definition"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { ShapeDefinition } from "@beep/scratchpad/osdk/src/Shape/index"
 *
 * const stored = {
 *   objectType: "Employee",
 *   properties: {
 *     fullName: { type: "require" },
 *     office: { type: "withDefault", defaultValue: "Remote" },
 *   },
 *   links: {
 *     lead: {
 *       linkSet: { segments: [{ link: "lead" }] },
 *       shape: { objectType: "Employee", properties: { fullName: { type: "select" } } },
 *     },
 *   },
 * }
 * const definition = await Effect.runPromise(S.decodeUnknownEffect(ShapeDefinition)(stored))
 * const facts = [definition.objectType, R.size(definition.properties), R.keys(definition.links)]
 * facts // => ["Employee", 2, ["lead"]]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShapeDefinition extends S.Opaque<ShapeDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type the shape projects." }),
    properties: S.Record(PropertyApiName, NullPolicy).annotateKey({
      description: "The properties the shape keeps, each with what to do when it is null.",
    }),
    links: S.Record(DerivedLinkName, DerivedLink).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultKey(Effect.succeed({})),
      S.annotateKey({ description: "Linked objects to bring along, keyed by the name they come back under." })
    ),
  }).pipe(
    $I.annoteSchema("ShapeDefinition", {
      description: "The serialisable part of a shape: its object type, a null policy per property, and its links.",
    })
  )
) {}

/**
 * Companion namespace for {@link ShapeDefinition}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ShapeDefinition {
  /**
   * Encoded form of {@link ShapeDefinition}, declared explicitly because shapes are recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly objectType: string;
    readonly properties: { readonly [property: string]: (typeof NullPolicy)["Encoded"] };
    readonly links?: { readonly [name: string]: DerivedLink.Encoded };
  }
}

// -----------------------------------------------------------------------------
// The part that is not data
// -----------------------------------------------------------------------------

/**
 * A transform function together with the name a shape definition refers to it by.
 *
 * **Details**
 *
 * This is a plain interface, not a schema, because it holds a function. It
 * cannot be serialised or hashed. Only `name` reaches the definition. The
 * function receives the property as an `Option`, so it sees a null as `none`
 * and decides for itself what a null becomes. If it throws, applying the shape
 * reports a `transformFailed` violation instead of throwing.
 *
 * @typeParam Value - What the property holds when it is not null.
 * @typeParam Output - What the transform returns.
 * @category models
 * @since 0.0.0
 */
export interface PropertyTransform<Value = unknown, Output = unknown> {
  readonly name: string;
  readonly apply: (value: O.Option<Value>) => Output;
}

/**
 * A shape ready to apply: a definition plus the transform functions it names.
 *
 * **Details**
 *
 * This is a plain interface, not a schema. `definition` is the serialisable,
 * hashable part. `transforms` is not: it maps each transform name used
 * anywhere in the definition, nested shapes included, to its function. Store
 * or send the definition, and rebuild the shape by supplying the functions
 * again.
 *
 * @category models
 * @since 0.0.0
 */
export interface Shape {
  readonly definition: ShapeDefinition;
  readonly transforms: Readonly<Record<string, PropertyTransform["apply"]>>;
}

// -----------------------------------------------------------------------------
// Outcomes
// -----------------------------------------------------------------------------

const ShapeViolationKind = LiteralKit(["requiredPropertyNull", "transformMissing", "transformFailed"]);

/**
 * A property the shape requires was null.
 *
 * @category models
 * @since 0.0.0
 */
export class RequiredPropertyNull extends S.Opaque<RequiredPropertyNull, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("requiredPropertyNull"),
    property: PropertyApiName.annotateKey({ description: "The required property that was null." }),
  }).pipe($I.annoteSchema("RequiredPropertyNull", { description: "A property the shape requires was null." }))
) {}

/**
 * The shape names a transform for a property, and no function was supplied under that name.
 *
 * @category models
 * @since 0.0.0
 */
export class TransformMissing extends S.Opaque<TransformMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("transformMissing"),
    property: PropertyApiName.annotateKey({ description: "The property whose transform is missing." }),
    transform: TransformName.annotateKey({ description: "The name no function was supplied under." }),
  }).pipe(
    $I.annoteSchema("TransformMissing", {
      description: "The shape names a transform for a property, and no function was supplied under that name.",
    })
  )
) {}

/**
 * A transform function threw while computing a property.
 *
 * @category models
 * @since 0.0.0
 */
export class TransformFailed extends S.Opaque<TransformFailed, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("transformFailed"),
    property: PropertyApiName.annotateKey({ description: "The property whose transform threw." }),
    transform: TransformName.annotateKey({ description: "The name of the transform that threw." }),
    message: S.String.annotateKey({ description: "What was thrown, rendered as text." }),
  }).pipe($I.annoteSchema("TransformFailed", { description: "A transform function threw while computing a property." }))
) {}

/**
 * One way an object fails to fit a shape, naming the property at fault.
 *
 * **Details**
 *
 * OSDK lists three constraint kinds: `require`, `dropIfNull` and
 * `transformError`. Dropping an object is not a violation here: it is what
 * the shape asked for, and it is reported as its own outcome
 * ({@link ShapeRejection}). `transformMissing` is new, and exists because a
 * definition can be decoded from JSON without its functions.
 *
 * **Example** (Name the property at fault)
 *
 * ```ts import.meta.vitest name="Name the property at fault"
 * import { RequiredPropertyNull, ShapeViolation } from "@beep/scratchpad/osdk/src/Shape/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const explain = ShapeViolation.match({
 *   requiredPropertyNull: ({ property }) => `${property} is required and was null`,
 *   transformMissing: ({ property, transform }) => `${property} needs the transform ${transform}`,
 *   transformFailed: ({ property, message }) => `${property} could not be computed: ${message}`,
 * })
 * explain(RequiredPropertyNull.make({ property: PropertyApiName.make("fullName") })) // => "fullName is required and was null"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShapeViolation = ShapeViolationKind.mapMembers(() =>
  Tuple.make(RequiredPropertyNull, TransformMissing, TransformFailed)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ShapeViolation", {
    description: "One way an object fails to fit a shape, naming the property at fault.",
  })
);

/**
 * Runtime type of {@link ShapeViolation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ShapeViolation = typeof ShapeViolation.Type;

const ShapeRejectionKind = LiteralKit(["dropped", "violated"]);

/**
 * The shape leaves the object out: at least one property it drops on was null.
 *
 * @category models
 * @since 0.0.0
 */
export class DroppedByShape extends S.Opaque<DroppedByShape, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("dropped"),
    properties: S.NonEmptyArray(PropertyApiName).annotateKey({
      description: "Every drop-if-null property that was null.",
    }),
  }).pipe(
    $I.annoteSchema("DroppedByShape", {
      description: "The shape leaves the object out: at least one property it drops on was null.",
    })
  )
) {}

/**
 * The object does not fit the shape, with every violation found.
 *
 * @category models
 * @since 0.0.0
 */
export class ViolatedShape extends S.Opaque<ViolatedShape, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("violated"),
    violations: S.NonEmptyArray(ShapeViolation).annotateKey({
      description: "Every violation found, in the order the shape lists its properties.",
    }),
  }).pipe(
    $I.annoteSchema("ViolatedShape", {
      description: "The object does not fit the shape, with every violation found.",
    })
  )
) {}

/**
 * Why applying a shape produced no shaped object: the shape drops it, or the object violates the shape.
 *
 * **Details**
 *
 * The two cases are different in kind. `dropped` is the shape working as
 * written: count it and move on. `violated` is a defect in the data or in the
 * shape. When both would apply, the object is `dropped`: an object the caller
 * asked not to see has nothing to report.
 *
 * **Example** (Tell a dropped object from a violating one)
 *
 * ```ts import.meta.vitest name="Tell a dropped object from a violating one"
 * import { DroppedByShape, ShapeRejection } from "@beep/scratchpad/osdk/src/Shape/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const isDefect = ShapeRejection.match({ dropped: () => false, violated: () => true })
 * isDefect(DroppedByShape.make({ properties: [PropertyApiName.make("office")] })) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShapeRejection = ShapeRejectionKind.mapMembers(() => Tuple.make(DroppedByShape, ViolatedShape)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ShapeRejection", {
    description: "Why applying a shape produced no shaped object: the shape drops it, or the object violates it.",
  })
);

/**
 * Runtime type of {@link ShapeRejection}.
 *
 * @category models
 * @since 0.0.0
 */
export type ShapeRejection = typeof ShapeRejection.Type;
