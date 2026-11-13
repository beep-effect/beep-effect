/**
 * Nominal identifiers for everything an ontology names: API names, resource
 * identifiers and opaque tokens.
 *
 * **Details**
 *
 * The Foundry wire contract brands these strings loosely (documentation only),
 * and real payloads carry RIDs such as `"ri.a.b.c.d"` next to canonical ones.
 * The brands here therefore promise exactly what the wire promises: a
 * non-empty string of a given *kind*. Kind mix-ups (passing a link name where
 * a property name is expected) are compile errors; character-level naming
 * conventions live in {@link ResourceIdentifier} and the authoring checks, where
 * they are actually enforced.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";

const $I = $ScratchpadId.create("osdk/Identifier/Identifier.model");

// -----------------------------------------------------------------------------
// API names
// -----------------------------------------------------------------------------

/**
 * API name of an ontology, the human-chosen handle used in request paths.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OntologyApiName = S.NonEmptyString.pipe(
  S.brand("OntologyApiName"),
  $I.annoteSchema("OntologyApiName", {
    description: "API name of an ontology, the human-chosen handle used in request paths.",
  })
);

/**
 * Runtime type of {@link OntologyApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type OntologyApiName = typeof OntologyApiName.Type;

/**
 * API name of an object type, unique within its ontology.
 *
 * **Example** (Brand an object type name)
 *
 * ```ts import.meta.vitest name="Brand an object type name"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const employee = ObjectTypeApiName.make("Employee")
 * const accepted = S.is(ObjectTypeApiName)(employee)
 * accepted // => true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ObjectTypeApiName = S.NonEmptyString.pipe(
  S.brand("ObjectTypeApiName"),
  $I.annoteSchema("ObjectTypeApiName", {
    description: "API name of an object type, unique within its ontology.",
  })
);

/**
 * Runtime type of {@link ObjectTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ObjectTypeApiName = typeof ObjectTypeApiName.Type;

/**
 * API name of a property, unique within the object or interface type that declares it.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PropertyApiName = S.NonEmptyString.pipe(
  S.brand("PropertyApiName"),
  $I.annoteSchema("PropertyApiName", {
    description: "API name of a property, unique within the object or interface type that declares it.",
  })
);

/**
 * Runtime type of {@link PropertyApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type PropertyApiName = typeof PropertyApiName.Type;

/**
 * API name of one field inside a struct property.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const StructFieldApiName = S.NonEmptyString.pipe(
  S.brand("StructFieldApiName"),
  $I.annoteSchema("StructFieldApiName", {
    description: "API name of one field inside a struct property.",
  })
);

/**
 * Runtime type of {@link StructFieldApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type StructFieldApiName = typeof StructFieldApiName.Type;

/**
 * API name of one side of a link type, unique only within its source object type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const LinkTypeApiName = S.NonEmptyString.pipe(
  S.brand("LinkTypeApiName"),
  $I.annoteSchema("LinkTypeApiName", {
    description: "API name of one side of a link type, unique only within its source object type.",
  })
);

/**
 * Runtime type of {@link LinkTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type LinkTypeApiName = typeof LinkTypeApiName.Type;

/**
 * API name of an interface type, conventionally UpperCamelCase and optionally namespaced with dots.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfaceTypeApiName = S.NonEmptyString.pipe(
  S.brand("InterfaceTypeApiName"),
  $I.annoteSchema("InterfaceTypeApiName", {
    description: "API name of an interface type, conventionally UpperCamelCase and optionally namespaced with dots.",
  })
);

/**
 * Runtime type of {@link InterfaceTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfaceTypeApiName = typeof InterfaceTypeApiName.Type;

/**
 * API name of a property declared on an interface type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfacePropertyApiName = S.NonEmptyString.pipe(
  S.brand("InterfacePropertyApiName"),
  $I.annoteSchema("InterfacePropertyApiName", {
    description: "API name of a property declared on an interface type.",
  })
);

/**
 * Runtime type of {@link InterfacePropertyApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfacePropertyApiName = typeof InterfacePropertyApiName.Type;

/**
 * API name of a link declared on an interface type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfaceLinkTypeApiName = S.NonEmptyString.pipe(
  S.brand("InterfaceLinkTypeApiName"),
  $I.annoteSchema("InterfaceLinkTypeApiName", {
    description: "API name of a link declared on an interface type.",
  })
);

/**
 * Runtime type of {@link InterfaceLinkTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfaceLinkTypeApiName = typeof InterfaceLinkTypeApiName.Type;

/**
 * API name of a shared property type, a property definition reused across object and interface types.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SharedPropertyTypeApiName = S.NonEmptyString.pipe(
  S.brand("SharedPropertyTypeApiName"),
  $I.annoteSchema("SharedPropertyTypeApiName", {
    description: "API name of a shared property type, a property definition reused across object and interface types.",
  })
);

/**
 * Runtime type of {@link SharedPropertyTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SharedPropertyTypeApiName = typeof SharedPropertyTypeApiName.Type;

/**
 * API name of a value type, a reusable constrained base type that properties may reference.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ValueTypeApiName = S.NonEmptyString.pipe(
  S.brand("ValueTypeApiName"),
  $I.annoteSchema("ValueTypeApiName", {
    description: "API name of a value type, a reusable constrained base type that properties may reference.",
  })
);

/**
 * Runtime type of {@link ValueTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ValueTypeApiName = typeof ValueTypeApiName.Type;

/**
 * API name of an action type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ActionTypeApiName = S.NonEmptyString.pipe(
  S.brand("ActionTypeApiName"),
  $I.annoteSchema("ActionTypeApiName", {
    description: "API name of an action type.",
  })
);

/**
 * Runtime type of {@link ActionTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ActionTypeApiName = typeof ActionTypeApiName.Type;

/**
 * Identifier of one parameter of an action or query, unique within that action or query.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ParameterId = S.NonEmptyString.pipe(
  S.brand("ParameterId"),
  $I.annoteSchema("ParameterId", {
    description: "Identifier of one parameter of an action or query, unique within that action or query.",
  })
);

/**
 * Runtime type of {@link ParameterId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ParameterId = typeof ParameterId.Type;

/**
 * API name of a query, the ontology-facing name of a function.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const QueryApiName = S.NonEmptyString.pipe(
  S.brand("QueryApiName"),
  $I.annoteSchema("QueryApiName", {
    description: "API name of a query, the ontology-facing name of a function.",
  })
);

/**
 * Runtime type of {@link QueryApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type QueryApiName = typeof QueryApiName.Type;

/**
 * Caller-chosen name under which a derived property is returned on loaded objects.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DerivedPropertyApiName = S.NonEmptyString.pipe(
  S.brand("DerivedPropertyApiName"),
  $I.annoteSchema("DerivedPropertyApiName", {
    description: "Caller-chosen name under which a derived property is returned on loaded objects.",
  })
);

/**
 * Runtime type of {@link DerivedPropertyApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type DerivedPropertyApiName = typeof DerivedPropertyApiName.Type;

/**
 * API name of an object type or of an interface type, where only the ontology knows which of the two it is.
 *
 * **Details**
 *
 * A type cast names its target by API name alone. Object types and interface
 * types share one namespace on the wire, so the name does not say which kind
 * it denotes.
 *
 * **Example** (Brand the target of a cast)
 *
 * ```ts import.meta.vitest name="Brand the target of a cast"
 * import * as S from "effect/Schema"
 * import { EntityTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const verdicts = [S.is(EntityTypeApiName)("Person"), S.is(EntityTypeApiName)("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EntityTypeApiName = S.NonEmptyString.pipe(
  S.brand("EntityTypeApiName"),
  $I.annoteSchema("EntityTypeApiName", {
    description: "API name of an object type or of an interface type; only the ontology knows which.",
  })
);

/**
 * Runtime type of {@link EntityTypeApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type EntityTypeApiName = typeof EntityTypeApiName.Type;

// -----------------------------------------------------------------------------
// Resource identifiers
// -----------------------------------------------------------------------------

const resourceIdentifierPattern = /^ri\.([a-z][a-z0-9-]*)\.([a-z0-9][a-z0-9-]*)?\.([a-z][a-z0-9-]*)\.([a-zA-Z0-9_\-.]+)$/;

// The one statement of the canonical form. `ResourceIdentifier` is text that satisfies it, and
// `OntologyIdentifier` uses it to tell a resource identifier from an API name.
const hasResourceIdentifierForm = S.isPattern(
  resourceIdentifierPattern,
  $I.annote("ResourceIdentifierCheck", {
    title: "Resource Identifier",
    description: "A string of the form ri.<service>.<instance>.<type>.<locator> with lowercase service and type.",
    message: "Expected a resource identifier of the form ri.<service>.<instance>.<type>.<locator>",
  })
);

/**
 * Canonical Palantir resource identifier: `ri.<service>.<instance>.<type>.<locator>`.
 *
 * **Details**
 *
 * This is the strict form. Wire payloads are not required to satisfy it, so
 * the kind-specific brands such as {@link ObjectTypeRid} stay permissive; use
 * this schema when a value must be a well-formed RID, and
 * {@link ResourceIdentifierParts} to read its segments.
 *
 * **Example** (Tell a canonical RID from a loose one)
 *
 * ```ts import.meta.vitest name="Tell a canonical RID from a loose one"
 * import * as S from "effect/Schema"
 * import { ResourceIdentifier } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const isCanonical = S.is(ResourceIdentifier)
 * const verdicts = [
 *   isCanonical("ri.ontology.main.object-type.401ac022-89eb-4591-8b7e-0a912b9efb44"),
 *   isCanonical("rid"),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ResourceIdentifier = S.NonEmptyString.check(hasResourceIdentifierForm).pipe(
  S.brand("ResourceIdentifier"),
  $I.annoteSchema("ResourceIdentifier", {
    description: "Canonical resource identifier with service, instance, type and locator segments.",
  })
);

/**
 * Runtime type of {@link ResourceIdentifier}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ResourceIdentifier = typeof ResourceIdentifier.Type;

// Segment grammars of a resource identifier. They constrain the decoded struct as well as the parsed
// string, so every value the type side admits can be encoded.
const ResourceService = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9-]*$/,
    $I.annote("ResourceServiceCheck", {
      title: "Resource service",
      description: "A lowercase service name that starts with a letter.",
      message: "Expected a lowercase service segment such as ontology",
    })
  )
);
const ResourceInstance = S.String.check(
  S.isPattern(
    /^([a-z0-9][a-z0-9-]*)?$/,
    $I.annote("ResourceInstanceCheck", {
      title: "Resource instance",
      description: "A lowercase instance name, which may be empty.",
      message: "Expected a lowercase instance segment such as main, or an empty segment",
    })
  )
);
const ResourceType = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9-]*$/,
    $I.annote("ResourceTypeCheck", {
      title: "Resource type",
      description: "A lowercase resource type that starts with a letter.",
      message: "Expected a lowercase type segment such as object-type",
    })
  )
);
const ResourceLocator = S.String.check(
  S.isPattern(
    /^[a-zA-Z0-9_\-.]+$/,
    $I.annote("ResourceLocatorCheck", {
      title: "Resource locator",
      description: "A non-empty locator of letters, digits, underscores, hyphens and dots.",
      message: "Expected a locator of letters, digits, underscores, hyphens and dots",
    })
  )
);

/**
 * The four segments of a {@link ResourceIdentifier}, decoded from and encoded to its string form.
 *
 * **Example** (Read the segments of a RID)
 *
 * ```ts import.meta.vitest name="Read the segments of a RID"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ResourceIdentifierParts } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const parts = await Effect.runPromise(
 *   S.decodeUnknownEffect(ResourceIdentifierParts)("ri.ontology.main.object-type.employee")
 * )
 * const summary = `${parts.service}/${parts.type}/${parts.locator}`
 * summary // => "ontology/object-type/employee"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ResourceIdentifierParts = S.TemplateLiteralParser([
  "ri.",
  ResourceService,
  ".",
  ResourceInstance,
  ".",
  ResourceType,
  ".",
  ResourceLocator,
]).pipe(
  S.decodeTo(
    S.Struct({
      service: ResourceService,
      instance: ResourceInstance,
      type: ResourceType,
      locator: ResourceLocator,
    }),
    SchemaTransformation.transform({
      decode: ([, service, , instance, , type, , locator]) => ({ service, instance, type, locator }),
      encode: ({ service, instance, type, locator }) =>
        Tuple.make("ri.", service, ".", instance, ".", type, ".", locator),
    })
  ),
  $I.annoteSchema("ResourceIdentifierParts", {
    description: "Service, instance, type and locator segments parsed from a canonical resource identifier.",
  })
);

/**
 * Runtime type of {@link ResourceIdentifierParts}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ResourceIdentifierParts = typeof ResourceIdentifierParts.Type;

/**
 * Resource identifier of an ontology.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OntologyRid = S.NonEmptyString.pipe(
  S.brand("OntologyRid"),
  $I.annoteSchema("OntologyRid", { description: "Resource identifier of an ontology." })
);

/**
 * Runtime type of {@link OntologyRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type OntologyRid = typeof OntologyRid.Type;

/**
 * Names an ontology the way the platform's routes accept it: by resource identifier or by API name.
 *
 * **Details**
 *
 * The platform accepts either spelling in the same path segment
 * (`/v2/ontologies/{ontology}/...`), and both are plain text. This union tells
 * them apart the only way text allows, by form: text of the canonical
 * resource-identifier form (`ri.<service>.<instance>.<type>.<locator>`) is an
 * {@link OntologyRid}, any other non-empty text is an {@link OntologyApiName}.
 * The bare `OntologyRid` brand stays as loose as the wire leaves it; only its
 * membership here is gated by the form, so the union never calls an API name a
 * resource identifier.
 *
 * **Gotchas**
 *
 * A brand is a static fact and leaves no mark on the text. To ask a decoded
 * value which spelling it is, test it with `S.is(ResourceIdentifier)`.
 *
 * **Example** (Tell the two spellings of an ontology apart)
 *
 * ```ts import.meta.vitest name="Tell the two spellings of an ontology apart"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyIdentifier, ResourceIdentifier } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const decode = S.decodeUnknownOption(OntologyIdentifier)
 * const isRid = O.exists(S.is(ResourceIdentifier))
 * const verdicts = [
 *   isRid(decode("ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361")),
 *   isRid(decode("default-ontology")),
 *   O.isSome(decode("default-ontology")),
 *   O.isSome(decode("")),
 * ]
 * verdicts // => [true, false, true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OntologyIdentifier = S.Union([OntologyRid.check(hasResourceIdentifierForm), OntologyApiName]).pipe(
  $I.annoteSchema("OntologyIdentifier", {
    description: "Names an ontology the way the platform's routes accept it: by resource identifier or by API name.",
  })
);

/**
 * Runtime type of {@link OntologyIdentifier}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type OntologyIdentifier = typeof OntologyIdentifier.Type;

/**
 * Resource identifier of an object type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ObjectTypeRid = S.NonEmptyString.pipe(
  S.brand("ObjectTypeRid"),
  $I.annoteSchema("ObjectTypeRid", { description: "Resource identifier of an object type." })
);

/**
 * Runtime type of {@link ObjectTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ObjectTypeRid = typeof ObjectTypeRid.Type;

/**
 * Resource identifier of a property type declared on an object type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PropertyTypeRid = S.NonEmptyString.pipe(
  S.brand("PropertyTypeRid"),
  $I.annoteSchema("PropertyTypeRid", { description: "Resource identifier of a property type declared on an object type." })
);

/**
 * Runtime type of {@link PropertyTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type PropertyTypeRid = typeof PropertyTypeRid.Type;

/**
 * Resource identifier of a shared property type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SharedPropertyTypeRid = S.NonEmptyString.pipe(
  S.brand("SharedPropertyTypeRid"),
  $I.annoteSchema("SharedPropertyTypeRid", { description: "Resource identifier of a shared property type." })
);

/**
 * Runtime type of {@link SharedPropertyTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SharedPropertyTypeRid = typeof SharedPropertyTypeRid.Type;

/**
 * Resource identifier of one field type inside a struct property.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const StructFieldTypeRid = S.NonEmptyString.pipe(
  S.brand("StructFieldTypeRid"),
  $I.annoteSchema("StructFieldTypeRid", { description: "Resource identifier of one field type inside a struct property." })
);

/**
 * Runtime type of {@link StructFieldTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type StructFieldTypeRid = typeof StructFieldTypeRid.Type;

/**
 * Resource identifier of a link type, shared by both of its sides.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const LinkTypeRid = S.NonEmptyString.pipe(
  S.brand("LinkTypeRid"),
  $I.annoteSchema("LinkTypeRid", { description: "Resource identifier of a link type, shared by both of its sides." })
);

/**
 * Runtime type of {@link LinkTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type LinkTypeRid = typeof LinkTypeRid.Type;

/**
 * Resource identifier of an interface type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfaceTypeRid = S.NonEmptyString.pipe(
  S.brand("InterfaceTypeRid"),
  $I.annoteSchema("InterfaceTypeRid", { description: "Resource identifier of an interface type." })
);

/**
 * Runtime type of {@link InterfaceTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfaceTypeRid = typeof InterfaceTypeRid.Type;

/**
 * Resource identifier of a property declared on an interface type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfacePropertyTypeRid = S.NonEmptyString.pipe(
  S.brand("InterfacePropertyTypeRid"),
  $I.annoteSchema("InterfacePropertyTypeRid", {
    description: "Resource identifier of a property declared on an interface type.",
  })
);

/**
 * Runtime type of {@link InterfacePropertyTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfacePropertyTypeRid = typeof InterfacePropertyTypeRid.Type;

/**
 * Resource identifier of a link declared on an interface type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfaceLinkTypeRid = S.NonEmptyString.pipe(
  S.brand("InterfaceLinkTypeRid"),
  $I.annoteSchema("InterfaceLinkTypeRid", { description: "Resource identifier of a link declared on an interface type." })
);

/**
 * Runtime type of {@link InterfaceLinkTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfaceLinkTypeRid = typeof InterfaceLinkTypeRid.Type;

/**
 * Resource identifier of an action type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ActionTypeRid = S.NonEmptyString.pipe(
  S.brand("ActionTypeRid"),
  $I.annoteSchema("ActionTypeRid", { description: "Resource identifier of an action type." })
);

/**
 * Runtime type of {@link ActionTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ActionTypeRid = typeof ActionTypeRid.Type;

/**
 * Resource identifier of the function that backs a query.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const FunctionRid = S.NonEmptyString.pipe(
  S.brand("FunctionRid"),
  $I.annoteSchema("FunctionRid", { description: "Resource identifier of the function that backs a query." })
);

/**
 * Runtime type of {@link FunctionRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type FunctionRid = typeof FunctionRid.Type;

/**
 * Resource identifier of a value type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ValueTypeRid = S.NonEmptyString.pipe(
  S.brand("ValueTypeRid"),
  $I.annoteSchema("ValueTypeRid", { description: "Resource identifier of a value type." })
);

/**
 * Runtime type of {@link ValueTypeRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ValueTypeRid = typeof ValueTypeRid.Type;

/**
 * Resource identifier of one object instance.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ObjectRid = S.NonEmptyString.pipe(
  S.brand("ObjectRid"),
  $I.annoteSchema("ObjectRid", { description: "Resource identifier of one object instance." })
);

/**
 * Runtime type of {@link ObjectRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ObjectRid = typeof ObjectRid.Type;

/**
 * Resource identifier of a saved or temporary object set.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ObjectSetRid = S.NonEmptyString.pipe(
  S.brand("ObjectSetRid"),
  $I.annoteSchema("ObjectSetRid", { description: "Resource identifier of a saved or temporary object set." })
);

/**
 * Runtime type of {@link ObjectSetRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ObjectSetRid = typeof ObjectSetRid.Type;

/**
 * Resource identifier of an uploaded attachment.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AttachmentRid = S.NonEmptyString.pipe(
  S.brand("AttachmentRid"),
  $I.annoteSchema("AttachmentRid", { description: "Resource identifier of an uploaded attachment." })
);

/**
 * Runtime type of {@link AttachmentRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AttachmentRid = typeof AttachmentRid.Type;

/**
 * Resource identifier of a media set.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MediaSetRid = S.NonEmptyString.pipe(
  S.brand("MediaSetRid"),
  $I.annoteSchema("MediaSetRid", { description: "Resource identifier of a media set." })
);

/**
 * Runtime type of {@link MediaSetRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type MediaSetRid = typeof MediaSetRid.Type;

/**
 * Resource identifier of a view over a media set.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MediaSetViewRid = S.NonEmptyString.pipe(
  S.brand("MediaSetViewRid"),
  $I.annoteSchema("MediaSetViewRid", { description: "Resource identifier of a view over a media set." })
);

/**
 * Runtime type of {@link MediaSetViewRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type MediaSetViewRid = typeof MediaSetViewRid.Type;

/**
 * Resource identifier of one item stored in a media set.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MediaItemRid = S.NonEmptyString.pipe(
  S.brand("MediaItemRid"),
  $I.annoteSchema("MediaItemRid", { description: "Resource identifier of one item stored in a media set." })
);

/**
 * Runtime type of {@link MediaItemRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type MediaItemRid = typeof MediaItemRid.Type;

/**
 * Resource identifier of an ontology scenario, an isolated what-if overlay of edits.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OntologyScenarioRid = S.NonEmptyString.pipe(
  S.brand("OntologyScenarioRid"),
  $I.annoteSchema("OntologyScenarioRid", {
    description: "Resource identifier of an ontology scenario, an isolated what-if overlay of edits.",
  })
);

/**
 * Runtime type of {@link OntologyScenarioRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type OntologyScenarioRid = typeof OntologyScenarioRid.Type;

/**
 * Identifier of an open ontology transaction whose edits are not yet committed.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const OntologyTransactionId = S.NonEmptyString.pipe(
  S.brand("OntologyTransactionId"),
  $I.annoteSchema("OntologyTransactionId", {
    description: "Identifier of an open ontology transaction whose edits are not yet committed.",
  })
);

/**
 * Runtime type of {@link OntologyTransactionId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type OntologyTransactionId = typeof OntologyTransactionId.Type;

/**
 * Identifier of a security marking, either a classification or a mandatory marking.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MarkingId = S.NonEmptyString.pipe(
  S.brand("MarkingId"),
  $I.annoteSchema("MarkingId", {
    description: "Identifier of a security marking, either a classification or a mandatory marking.",
  })
);

/**
 * Runtime type of {@link MarkingId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type MarkingId = typeof MarkingId.Type;

// -----------------------------------------------------------------------------
// Platform identifiers that are not part of an ontology
// -----------------------------------------------------------------------------

/**
 * Identifier of a Foundry branch, today its resource identifier.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const FoundryBranch = S.NonEmptyString.pipe(
  S.brand("FoundryBranch"),
  $I.annoteSchema("FoundryBranch", {
    description: "Identifier of a Foundry branch, today its resource identifier.",
  })
);

/**
 * Runtime type of {@link FoundryBranch}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type FoundryBranch = typeof FoundryBranch.Type;

/**
 * Identifier of a user or service known to the platform, such as the publisher of an agent version.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PrincipalId = S.NonEmptyString.pipe(
  S.brand("PrincipalId"),
  $I.annoteSchema("PrincipalId", { description: "Identifier of a user or service known to the platform." })
);

/**
 * Runtime type of {@link PrincipalId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type PrincipalId = typeof PrincipalId.Type;

/**
 * Name of a failure the platform reports, such as `ObjectTypeNotFound`.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ErrorName = S.NonEmptyString.pipe(
  S.brand("ErrorName"),
  $I.annoteSchema("ErrorName", {
    description: "Name of a failure the platform reports, such as ObjectTypeNotFound.",
  })
);

/**
 * Runtime type of {@link ErrorName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ErrorName = typeof ErrorName.Type;

// -----------------------------------------------------------------------------
// Versions
// -----------------------------------------------------------------------------

/**
 * Version of a function: `<major>.<minor>.<patch>` with an optional `-<tag>` suffix.
 *
 * **Example** (Accept release and tagged versions)
 *
 * ```ts import.meta.vitest name="Accept release and tagged versions"
 * import * as S from "effect/Schema"
 * import { FunctionVersion } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const isVersion = S.is(FunctionVersion)
 * const verdicts = [isVersion("1.2.3"), isVersion("1.2.3-rc1"), isVersion("latest")]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const FunctionVersion = S.NonEmptyString.check(
  S.isPattern(
    /^\d+\.\d+\.\d+(?:-[0-9a-zA-Z][0-9a-zA-Z.-]*)?$/,
    $I.annote("FunctionVersionCheck", {
      title: "Function Version",
      description: "A version of the form <major>.<minor>.<patch> with an optional -<tag> suffix.",
      message: "Expected a function version such as 1.2.3 or 1.2.3-rc1",
    })
  )
).pipe(
  S.brand("FunctionVersion"),
  $I.annoteSchema("FunctionVersion", {
    description: "Version of a function: major.minor.patch with an optional tag suffix.",
  })
);

/**
 * Runtime type of {@link FunctionVersion}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type FunctionVersion = typeof FunctionVersion.Type;
