/**
 * Link types as an object type sees them: one outgoing side per direction.
 *
 * **Details**
 *
 * A link type connects two object types and has a name in each direction. The
 * platform never hands out the link as a whole; it lists, under each object
 * type, the sides that start there. {@link LinkTypeSide} is that record. OSDK
 * reduces it to `{ targetType, multiplicity: boolean }` and loses the status,
 * the foreign key and the identity of the link; here the wire record is kept
 * whole and the flag becomes the two-valued domain {@link LinkCardinality}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { MappedLiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LinkTypeApiName, LinkTypeRid, ObjectTypeApiName, PropertyApiName } from "../Identifier/Identifier.model.ts";
import { ReleaseStatus } from "../Metadata/Metadata.values.ts";

const $I = $ScratchpadId.create("osdk/LinkType/LinkType.model");

/**
 * How many objects one object can reach through a link side, decoded from the wire's upper-case enum.
 *
 * **Details**
 *
 * OSDK spells this as `multiplicity: boolean`, which reads the same for "is a
 * list" on properties and "reaches many" on links. A side with cardinality
 * `one` resolves to at most one object; `many` resolves to a set.
 *
 * **Example** (Choose the shape a traversal returns)
 *
 * ```ts import.meta.vitest name="Choose the shape a traversal returns"
 * import * as A from "effect/Array"
 * import { LinkCardinality } from "@beep/scratchpad/osdk/src/LinkType/index"
 *
 * const shape = LinkCardinality.To.match({ one: () => "at most one object", many: () => "an object set" })
 * const shapes = A.map(LinkCardinality.Pairs, ([, cardinality]) => shape(cardinality))
 * shapes // => ["at most one object", "an object set"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LinkCardinality = MappedLiteralKit([
  ["ONE", "one"],
  ["MANY", "many"],
]).pipe(
  $I.annoteSchema("LinkCardinality", {
    description: "How many objects one object can reach through a link side: at most one, or many.",
  })
);

/**
 * Runtime type of {@link LinkCardinality}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinkCardinality = typeof LinkCardinality.Type;

/**
 * One direction of a link type, as listed under the object type it starts from.
 *
 * **Details**
 *
 * The wire names the far end `objectTypeApiName`, which on a record that hangs
 * off an object type reads like the near end; here it is `targetObjectType`.
 * `foreignKeyProperty` (wire `foreignKeyPropertyApiName`) names a property of
 * the object type that holds this side. It is absent when the link is
 * many-to-many, or when the key lives on the target and this type only
 * contributes its primary key. The API name is unique only among the sides of
 * one object type, so two object types may each have a side called `owner`.
 *
 * **Example** (Describe a side that follows a foreign key)
 *
 * ```ts import.meta.vitest name="Describe a side that follows a foreign key"
 * import * as O from "effect/Option"
 * import { LinkTypeApiName, LinkTypeRid, ObjectTypeApiName, PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { LinkTypeSide } from "@beep/scratchpad/osdk/src/LinkType/index"
 *
 * const office = LinkTypeSide.make({
 *   apiName: LinkTypeApiName.make("officeLink"),
 *   displayName: "Office",
 *   status: "experimental",
 *   targetObjectType: ObjectTypeApiName.make("Office"),
 *   cardinality: "one",
 *   foreignKeyProperty: O.some(PropertyApiName.make("office")),
 *   linkTypeRid: LinkTypeRid.make("rid.link-type.324"),
 * })
 * const summary = `${office.apiName} -> ${office.cardinality} ${office.targetObjectType}`
 * summary // => "officeLink -> one Office"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkTypeSide extends S.Opaque<LinkTypeSide, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: LinkTypeApiName.annotateKey({
      description: "Name of this direction of the link, unique among the sides of the object type that holds it.",
    }),
    displayName: S.String.annotateKey({ description: "Human-readable name of this direction of the link." }),
    status: ReleaseStatus.annotateKey({ description: "How far along its lifecycle the link type is." }),
    targetObjectType: ObjectTypeApiName.annotateKey({
      description: "Object type at the far end: what following this side arrives at.",
    }),
    cardinality: LinkCardinality.annotateKey({
      description: "How many objects of the target type one object can reach through this side.",
    }),
    foreignKeyProperty: S.OptionFromOptionalKey(PropertyApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Property of the holding object type that stores the key of the linked object, when it has one.",
      })
    ),
    linkTypeRid: LinkTypeRid.annotateKey({
      description: "Resource identifier of the link type, shared by both of its directions.",
    }),
  }).pipe(
    S.encodeKeys({ targetObjectType: "objectTypeApiName", foreignKeyProperty: "foreignKeyPropertyApiName" }),
    $I.annoteSchema("LinkTypeSide", {
      description: "One direction of a link type, as listed under the object type it starts from.",
    })
  )
) {}
