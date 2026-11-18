/**
 * Interface types: named contracts of properties and links that object types implement.
 *
 * **Details**
 *
 * The wire `InterfaceType` carries the same information in several generations
 * at once: `properties` and `propertiesV2`, each with an `all*` twin, plus twins
 * for links and for extended interfaces. Nothing in those names says how they
 * differ. Here every wire field is kept, so a real payload decodes and encodes
 * back unchanged, but each has the name of what it holds: `own*` for what the
 * interface declares itself and `inheritedAndOwn*` for the closure over every
 * interface it extends. The must-implement flag, which the wire spells
 * `required` on two records and `requireImplementation` on two others, is
 * `requireImplementation` everywhere.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import {
  InterfaceLinkTypeApiName,
  InterfaceLinkTypeRid,
  InterfacePropertyApiName,
  InterfacePropertyTypeRid,
  InterfaceTypeApiName,
  InterfaceTypeRid,
  ObjectTypeApiName,
  SharedPropertyTypeApiName,
  SharedPropertyTypeRid,
  ValueTypeApiName,
} from "../Identifier/Identifier.model.ts";
import { TypeClass } from "../Metadata/Metadata.values.ts";
import { PropertyType } from "../Property/Property.model.ts";
import { ValueFormat } from "../ValueFormat/ValueFormat.model.ts";

const $I = $ScratchpadId.create("osdk/InterfaceType/InterfaceType.model");

// -----------------------------------------------------------------------------
// Interface properties
// -----------------------------------------------------------------------------

const describedPropertyFields = {
  displayName: S.String.annotateKey({ description: "Human-readable name." }),
  description: S.OptionFromOptionalKey(S.String).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "What the property means." })
  ),
  dataType: PropertyType.annotateKey({ description: "What the property holds." }),
  valueTypeApiName: S.OptionFromOptionalKey(ValueTypeApiName).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Value type that further constrains the property's values." })
  ),
};

const valueFormattingField = S.OptionFromOptionalKey(ValueFormat).pipe(
  S.withConstructorDefault(Effect.succeedNone),
  S.annotateKey({ description: "How to render values for display." })
);

const typeClassesField = S.Array(TypeClass).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<TypeClass>())),
  S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof TypeClass)["Encoded"]>())),
  S.annotateKey({ description: "Free-form rendering and behavior hints for client applications." })
);

const requireImplementationField = S.Boolean.annotateKey({
  description: "Whether every implementing object type must map this property to one of its own.",
});

const sharedPropertyFields = {
  rid: SharedPropertyTypeRid.annotateKey({ description: "Resource identifier of the backing shared property type." }),
  apiName: SharedPropertyTypeApiName.annotateKey({ description: "API name of the backing shared property type." }),
  ...describedPropertyFields,
  valueFormatting: valueFormattingField,
  typeClasses: typeClassesField,
  requireImplementation: requireImplementationField,
};

/**
 * An interface property that reuses a shared property type.
 *
 * **Details**
 *
 * The wire key of the must-implement flag is `required` on this record and
 * `requireImplementation` on the other two property records; the domain uses
 * the second name for all three. The wire sends this record tagged inside the
 * own-property union and untagged in the two older shared-property maps; both
 * positions decode to this one class.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceSharedPropertyType extends S.Opaque<
  InterfaceSharedPropertyType,
  { readonly brand: unique symbol }
>()(
  S.Struct({ type: S.tag("interfaceSharedPropertyType"), ...sharedPropertyFields }).pipe(
    S.encodeKeys({ requireImplementation: "required" }),
    $I.annoteSchema("InterfaceSharedPropertyType", {
      description: "An interface property that reuses a shared property type.",
    })
  )
) {}

/**
 * An interface property declared on the interface itself, with no shared property type behind it.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceDefinedPropertyType extends S.Opaque<
  InterfaceDefinedPropertyType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("interfaceDefinedPropertyType"),
    rid: InterfacePropertyTypeRid.annotateKey({ description: "Resource identifier of the interface property." }),
    apiName: InterfacePropertyApiName.annotateKey({ description: "Name of the property within its interface." }),
    ...describedPropertyFields,
    typeClasses: typeClassesField,
    requireImplementation: requireImplementationField,
  }).pipe(
    $I.annoteSchema("InterfaceDefinedPropertyType", {
      description: "An interface property declared on the interface itself, with no shared property type behind it.",
    })
  )
) {}

const InterfacePropertyTypeKind = LiteralKit(["interfaceDefinedPropertyType", "interfaceSharedPropertyType"]);

/**
 * A property an interface declares itself: defined on the interface, or backed by a shared property type.
 *
 * **Example** (Tell where an interface property comes from)
 *
 * ```ts import.meta.vitest name="Tell where an interface property comes from"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { InterfacePropertyApiName, InterfacePropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { InterfaceDefinedPropertyType, InterfacePropertyType } from "@beep/scratchpad/osdk/src/InterfaceType/index"
 *
 * const origin = InterfacePropertyType.match({
 *   interfaceDefinedPropertyType: () => "defined on the interface",
 *   interfaceSharedPropertyType: ({ apiName }) => `backed by shared property ${apiName}`,
 * })
 * const nickname = InterfaceDefinedPropertyType.make({
 *   rid: InterfacePropertyTypeRid.make("ri.interfacePropertyType.main.interfacePropertyType.1"),
 *   apiName: InterfacePropertyApiName.make("nickname"),
 *   displayName: "Nickname",
 *   dataType: StringType.make({}),
 *   requireImplementation: false,
 * })
 * const facts = [origin(nickname), InterfacePropertyType.guards.interfaceSharedPropertyType(nickname)]
 * facts // => ["defined on the interface", false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InterfacePropertyType = InterfacePropertyTypeKind.mapMembers(() =>
  Tuple.make(InterfaceDefinedPropertyType, InterfaceSharedPropertyType)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("InterfacePropertyType", {
    description: "A property an interface declares itself: defined on it, or backed by a shared property type.",
  })
);

/**
 * Runtime type of {@link InterfacePropertyType}.
 *
 * @category models
 * @since 0.0.0
 */
export type InterfacePropertyType = typeof InterfacePropertyType.Type;

/**
 * The untagged wire record of a shared-property-backed interface property, decoded to the tagged class.
 *
 * The two older shared-property maps of an interface send the record without its `type`. The tag is
 * added while decoding and removed while encoding, so one class serves every position.
 */
const InterfaceSharedPropertyTypeFromUntagged = S.toEncoded(
  S.Struct(sharedPropertyFields).pipe(S.encodeKeys({ requireImplementation: "required" }))
).pipe(
  S.decodeTo(
    InterfaceSharedPropertyType,
    SchemaTransformation.transform({
      decode: (untagged) => ({ ...untagged, type: InterfacePropertyTypeKind.Enum.interfaceSharedPropertyType }),
      encode: Struct.omit(["type"]),
    })
  ),
  $I.annoteSchema("InterfaceSharedPropertyTypeFromUntagged", {
    description: "A shared-property-backed interface property as the older maps send it: without its type tag.",
  })
);

/**
 * An interface property as an implementer sees it, after inheritance: own or inherited, shared or defined, flattened.
 *
 * **Details**
 *
 * This is the value of the closure map, which no longer distinguishes a
 * property backed by a shared property type from one defined on an interface,
 * nor an inherited property from an own one. Its `rid` is always an interface
 * property RID, even for a property whose shared property type has its own RID.
 *
 * **Example** (Describe a flattened interface property)
 *
 * ```ts import.meta.vitest name="Describe a flattened interface property"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ResolvedInterfacePropertyType } from "@beep/scratchpad/osdk/src/InterfaceType/index"
 *
 * const email = await Effect.runPromise(
 *   S.decodeUnknownEffect(ResolvedInterfacePropertyType)({
 *     rid: "ri.ontology.main.interface-property.2645943a",
 *     apiName: "email",
 *     displayName: "Email",
 *     dataType: { type: "string" },
 *     requireImplementation: true,
 *   })
 * )
 * const facts = [email.dataType.type, email.requireImplementation, O.isNone(email.valueFormatting)]
 * facts // => ["string", true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedInterfacePropertyType extends S.Opaque<
  ResolvedInterfacePropertyType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    rid: InterfacePropertyTypeRid.annotateKey({ description: "Resource identifier of the interface property." }),
    apiName: InterfacePropertyApiName.annotateKey({ description: "Name of the property within its interface." }),
    ...describedPropertyFields,
    valueFormatting: valueFormattingField,
    requireImplementation: requireImplementationField,
  }).pipe(
    $I.annoteSchema("ResolvedInterfacePropertyType", {
      description: "An interface property as an implementer sees it after inheritance, flattened to one shape.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Interface links
// -----------------------------------------------------------------------------

/**
 * How many targets one object may reach through an interface link: at most one, or any number.
 *
 * **Details**
 *
 * The wire declares this enum separately from the cardinality of an object
 * type's link side, with the same two literals. The authoring model spells the
 * first literal `SINGLE`; the wire never does, so it is rejected here.
 *
 * **Example** (Decode a cardinality and bound the number of targets)
 *
 * ```ts import.meta.vitest name="Decode a cardinality and bound the number of targets"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InterfaceLinkCardinality } from "@beep/scratchpad/osdk/src/InterfaceType/index"
 *
 * const isSingular = InterfaceLinkCardinality.To.match({ one: () => true, many: () => false })
 * const cardinality = await Effect.runPromise(S.decodeEffect(InterfaceLinkCardinality)("MANY"))
 * const facts = [cardinality, isSingular(cardinality)]
 * facts // => ["many", false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InterfaceLinkCardinality = MappedLiteralKit([
  ["ONE", "one"],
  ["MANY", "many"],
]).pipe(
  $I.annoteSchema("InterfaceLinkCardinality", {
    description: "How many targets one object may reach through an interface link: at most one, or any number.",
  })
);

/**
 * Runtime type of {@link InterfaceLinkCardinality}.
 *
 * @category models
 * @since 0.0.0
 */
export type InterfaceLinkCardinality = typeof InterfaceLinkCardinality.Type;

const LinkedEntityKind = LiteralKit(["objectTypeApiName", "interfaceTypeApiName"]);

/**
 * An interface link whose targets are objects of one object type.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkedObjectType extends S.Opaque<LinkedObjectType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectTypeApiName"),
    apiName: ObjectTypeApiName.annotateKey({ description: "API name of the linked object type." }),
  }).pipe(
    $I.annoteSchema("LinkedObjectType", {
      description: "An interface link whose targets are objects of one object type.",
    })
  )
) {}

/**
 * An interface link whose targets are objects of any type that implements one interface.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkedInterfaceType extends S.Opaque<LinkedInterfaceType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceTypeApiName"),
    apiName: InterfaceTypeApiName.annotateKey({ description: "API name of the linked interface type." }),
  }).pipe(
    $I.annoteSchema("LinkedInterfaceType", {
      description: "An interface link whose targets are objects of any type that implements one interface.",
    })
  )
) {}

/**
 * What an interface link points at: an object type, or an interface type.
 *
 * **Details**
 *
 * The tags are the wire's own. The wire calls the field holding this union
 * `linkedEntityApiName` although its value is a tagged record, not a name; the
 * union says what the record is.
 *
 * **Example** (Describe the target of an interface link)
 *
 * ```ts import.meta.vitest name="Describe the target of an interface link"
 * import { InterfaceTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { LinkedEntity, LinkedObjectType, LinkedInterfaceType } from "@beep/scratchpad/osdk/src/InterfaceType/index"
 *
 * const describe = LinkedEntity.match({
 *   objectTypeApiName: ({ apiName }) => `objects of type ${apiName}`,
 *   interfaceTypeApiName: ({ apiName }) => `objects implementing ${apiName}`,
 * })
 * const targets = [
 *   describe(LinkedObjectType.make({ apiName: ObjectTypeApiName.make("Office") })),
 *   describe(LinkedInterfaceType.make({ apiName: InterfaceTypeApiName.make("Person") })),
 * ]
 * targets // => ["objects of type Office", "objects implementing Person"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LinkedEntity = LinkedEntityKind.mapMembers(() => Tuple.make(LinkedObjectType, LinkedInterfaceType)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("LinkedEntity", {
    description: "What an interface link points at: an object type, or an interface type.",
  })
);

/**
 * Runtime type of {@link LinkedEntity}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinkedEntity = typeof LinkedEntity.Type;

/**
 * A link an interface promises: implementing object types supply the concrete link types behind it.
 *
 * **Details**
 *
 * Two keys are renamed against the wire. `linkedEntity` is the wire's
 * `linkedEntityApiName`, and `requireImplementation` is the wire's `required`,
 * the same flag the property records carry.
 *
 * **Example** (Decode an interface link from its wire record)
 *
 * ```ts import.meta.vitest name="Decode an interface link from its wire record"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InterfaceLinkType } from "@beep/scratchpad/osdk/src/InterfaceType/index"
 *
 * const office = await Effect.runPromise(
 *   S.decodeUnknownEffect(InterfaceLinkType)({
 *     rid: "ri.ontology.main.interface-link.1cfe8795",
 *     apiName: "office",
 *     displayName: "Office",
 *     linkedEntityApiName: { type: "objectTypeApiName", apiName: "Office" },
 *     cardinality: "ONE",
 *     required: false,
 *   })
 * )
 * const target = `${office.linkedEntity.type}:${office.linkedEntity.apiName}`
 * const facts = [target, office.cardinality, office.requireImplementation]
 * facts // => ["objectTypeApiName:Office", "one", false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceLinkType extends S.Opaque<InterfaceLinkType, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: InterfaceLinkTypeRid.annotateKey({ description: "Resource identifier of the interface link type." }),
    apiName: InterfaceLinkTypeApiName.annotateKey({ description: "Name of the link within its interface." }),
    displayName: S.String.annotateKey({ description: "Human-readable name." }),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the link means." })
    ),
    linkedEntity: LinkedEntity.annotateKey({ description: "The object type or interface type the link points at." }),
    cardinality: InterfaceLinkCardinality.annotateKey({
      description: "How many targets one object may reach through the link.",
    }),
    requireImplementation: S.Boolean.annotateKey({
      description: "Whether every implementing object type must supply at least one link type for this link.",
    }),
  }).pipe(
    S.encodeKeys({ linkedEntity: "linkedEntityApiName", requireImplementation: "required" }),
    $I.annoteSchema("InterfaceLinkType", {
      description: "A link an interface promises, implemented by the link types of the object types behind it.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The interface type
// -----------------------------------------------------------------------------

/**
 * A named contract of properties and links that object types implement, with what it inherits already resolved.
 *
 * **Details**
 *
 * Every wire field is modelled, so a payload decodes and encodes back
 * unchanged. Seven of them are renamed to say which generation and which scope
 * they hold:
 *
 * | Here | Wire | Holds |
 * | --- | --- | --- |
 * | `ownSharedProperties` | `properties` | own properties backed by a shared property type |
 * | `inheritedAndOwnSharedProperties` | `allProperties` | the same, plus those of every extended interface |
 * | `ownProperties` | `propertiesV2` | every own property, shared or defined, as a tagged union |
 * | `inheritedAndOwnProperties` | `allPropertiesV2` | every property an implementer sees, flattened |
 * | `ancestorInterfaces` | `allExtendsInterfaces` | interfaces extended directly or indirectly |
 * | `ownLinks` | `links` | links this interface declares |
 * | `inheritedAndOwnLinks` | `allLinks` | the same, plus those of every extended interface |
 *
 * **Gotchas**
 *
 * The codec does not check that each closure contains its own counterpart:
 * the platform computes both sides, and a payload is taken as sent. The
 * constructor defaults every collection to empty, so a value built by hand
 * must fill the `own*` field and its `inheritedAndOwn*` twin together.
 *
 * Saved ontology documents leave empty collections out, and documents saved
 * by an older platform lack the generations that platform did not know. Each
 * of the nine collections therefore decodes as empty when its key is absent,
 * and all nine are written on encode.
 *
 * **Example** (Decode an interface and compare what it declares with what it inherits)
 *
 * ```ts import.meta.vitest name="Decode an interface and compare what it declares with what it inherits"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { InterfaceType } from "@beep/scratchpad/osdk/src/InterfaceType/index"
 *
 * const link = {
 *   rid: "ri.interface.link.main.1",
 *   apiName: "manager",
 *   displayName: "Manager",
 *   linkedEntityApiName: { type: "interfaceTypeApiName", apiName: "Person" },
 *   cardinality: "ONE",
 *   required: true,
 * }
 * const employee = await Effect.runPromise(
 *   S.decodeUnknownEffect(InterfaceType)({
 *     rid: "ri.interface.main.interface.3",
 *     apiName: "Employee",
 *     displayName: "Employee",
 *     properties: {},
 *     allProperties: {},
 *     propertiesV2: {},
 *     allPropertiesV2: {},
 *     extendsInterfaces: ["Person"],
 *     allExtendsInterfaces: ["Person", "Named"],
 *     implementedByObjectTypes: ["Contractor"],
 *     links: {},
 *     allLinks: { manager: link },
 *   })
 * )
 * const counts = [
 *   employee.extendsInterfaces.length,
 *   employee.ancestorInterfaces.length,
 *   R.size(employee.ownLinks),
 *   R.size(employee.inheritedAndOwnLinks),
 * ]
 * counts // => [1, 2, 0, 1]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceType extends S.Opaque<InterfaceType, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: InterfaceTypeRid.annotateKey({ description: "Resource identifier of the interface type." }),
    apiName: InterfaceTypeApiName.annotateKey({ description: "Name under which code references the interface." }),
    displayName: S.String.annotateKey({ description: "Human-readable name." }),
    description: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "What the interface means." })
    ),
    ownSharedProperties: S.Record(SharedPropertyTypeApiName, InterfaceSharedPropertyTypeFromUntagged).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<SharedPropertyTypeApiName, InterfaceSharedPropertyType>())),
      S.withDecodingDefaultKey(
        Effect.succeed(R.empty<string, (typeof InterfaceSharedPropertyTypeFromUntagged)["Encoded"]>())
      ),
      S.annotateKey({
        description: "Own properties backed by a shared property type, keyed by that shared property type's API name.",
      })
    ),
    inheritedAndOwnSharedProperties: S.Record(SharedPropertyTypeApiName, InterfaceSharedPropertyTypeFromUntagged).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<SharedPropertyTypeApiName, InterfaceSharedPropertyType>())),
      S.withDecodingDefaultKey(
        Effect.succeed(R.empty<string, (typeof InterfaceSharedPropertyTypeFromUntagged)["Encoded"]>())
      ),
      S.annotateKey({
        description: "Shared-property-backed properties of this interface and of every interface it extends.",
      })
    ),
    ownProperties: S.Record(InterfacePropertyApiName, InterfacePropertyType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfacePropertyApiName, InterfacePropertyType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof InterfacePropertyType)["Encoded"]>())),
      S.annotateKey({
        description: "Every own property, whether backed by a shared property type or defined on the interface.",
      })
    ),
    inheritedAndOwnProperties: S.Record(InterfacePropertyApiName, ResolvedInterfacePropertyType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfacePropertyApiName, ResolvedInterfacePropertyType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof ResolvedInterfacePropertyType)["Encoded"]>())),
      S.annotateKey({
        description: "Every property an implementer sees: this interface's and those of all it extends, flattened.",
      })
    ),
    extendsInterfaces: S.Array(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<InterfaceTypeApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<string>())),
      S.annotateKey({ description: "Interfaces this one extends directly." })
    ),
    ancestorInterfaces: S.Array(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<InterfaceTypeApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<string>())),
      S.annotateKey({ description: "Interfaces this one extends directly or through another interface." })
    ),
    implementedByObjectTypes: S.Array(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<ObjectTypeApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<string>())),
      S.annotateKey({ description: "Object types that implement this interface." })
    ),
    ownLinks: S.Record(InterfaceLinkTypeApiName, InterfaceLinkType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfaceLinkTypeApiName, InterfaceLinkType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof InterfaceLinkType)["Encoded"]>())),
      S.annotateKey({ description: "Links this interface declares itself." })
    ),
    inheritedAndOwnLinks: S.Record(InterfaceLinkTypeApiName, InterfaceLinkType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfaceLinkTypeApiName, InterfaceLinkType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof InterfaceLinkType)["Encoded"]>())),
      S.annotateKey({
        description: "Links of this interface and of every interface it extends, directly or indirectly.",
      })
    ),
  }).pipe(
    S.encodeKeys({
      ownSharedProperties: "properties",
      inheritedAndOwnSharedProperties: "allProperties",
      ownProperties: "propertiesV2",
      inheritedAndOwnProperties: "allPropertiesV2",
      ancestorInterfaces: "allExtendsInterfaces",
      ownLinks: "links",
      inheritedAndOwnLinks: "allLinks",
    }),
    $I.annoteSchema("InterfaceType", {
      description: "A named contract of properties and links that object types implement, with inheritance resolved.",
    })
  )
) {}
