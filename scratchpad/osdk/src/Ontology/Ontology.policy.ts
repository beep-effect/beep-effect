/**
 * What is wrong with an ontology taken as a whole: every name that points at something the ontology does not
 * define, reported as data.
 *
 * **Details**
 *
 * Each definition decodes on its own, so a payload can be well-formed piece by
 * piece and still not hang together: a link side whose target was never
 * loaded, an interface that extends itself through two others, a query that
 * returns an object type nobody defined. OSDK meets these one at a time, as
 * exceptions thrown from whichever converter trips first. Here
 * {@link validateOntology} returns all of them at once as a tagged union,
 * each case carrying exactly the names that locate it.
 *
 * There is no finding for a primary key or a title that is not a declared
 * property: an object type like that does not decode in the first place.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { ActionOperation, ActionParameterType, OntologyDataType } from "../Action/Action.model.ts";
import {
  ActionTypeApiName,
  InterfaceLinkTypeApiName,
  InterfacePropertyApiName,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  PropertyApiName,
  SharedPropertyTypeApiName,
  ValueTypeApiName,
} from "../Identifier/Identifier.model.ts";
import { LinkedEntity, LinkedObjectType, LinkedInterfaceType } from "../InterfaceType/InterfaceType.model.ts";
import {
  InterfacePropertyImplementation,
  StructFieldSource,
  UnreducedInterfacePropertyImplementation,
} from "../ObjectType/ObjectType.model.ts";
import { QueryDataType, TypeReferenceId } from "../Query/Query.model.ts";
import { claimedInterfaces, getReverseLinkSide, implementers, interfaceGraph } from "./Ontology.behavior.ts";
import { VersionedQueryApiName } from "./Ontology.model.ts";
import type { ActionType } from "../Action/Action.model.ts";
import type {
  LocalPropertyImplementation,
  StructFieldImplementation,
  StructImplementation,
} from "../ObjectType/ObjectType.model.ts";
import type { QueryType } from "../Query/Query.model.ts";
import type { OntologyDefinition } from "./Ontology.model.ts";

const $I = $ScratchpadId.create("osdk/Ontology/Ontology.policy");

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

/**
 * The kinds of finding {@link validateOntology} can report.
 *
 * **Example** (List the kinds of finding)
 *
 * ```ts import.meta.vitest name="List the kinds of finding"
 * import { OntologyFindingKind } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const facts = [OntologyFindingKind.literals.length, OntologyFindingKind.is.linkTargetMissing("linkTargetMissing")]
 * facts // => [14, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyFindingKind = LiteralKit([
  "linkTargetMissing",
  "linkReverseMissing",
  "interfaceParentMissing",
  "interfaceExtensionCycle",
  "claimedInterfaceMissing",
  "implementerNotClaiming",
  "implementedPropertyMissing",
  "interfaceLinkTargetMissing",
  "actionParameterTypeMissing",
  "actionOperationTypeMissing",
  "queryReferenceMissing",
  "typeReferenceDangling",
  "propertyValueTypeMissing",
  "sharedPropertyTypeMissing",
]).pipe(
  $I.annoteSchema("OntologyFindingKind", {
    description: "The kinds of finding a validation of a whole ontology can report.",
  })
);

/**
 * Runtime type of {@link OntologyFindingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyFindingKind = typeof OntologyFindingKind.Type;

/**
 * A link side points at an object type the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkTargetMissing extends S.Opaque<LinkTargetMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("linkTargetMissing"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type that holds the link side." }),
    linkType: LinkTypeApiName.annotateKey({ description: "The link side." }),
    targetObjectType: ObjectTypeApiName.annotateKey({ description: "The target that is not defined." }),
  }).pipe(
    $I.annoteSchema("LinkTargetMissing", {
      description: "A link side points at an object type the ontology does not define.",
    })
  )
) {}

/**
 * A link side has no answering side: its target holds no side of the same link type that leads back.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkReverseMissing extends S.Opaque<LinkReverseMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("linkReverseMissing"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type that holds the link side." }),
    linkType: LinkTypeApiName.annotateKey({ description: "The link side that is not answered." }),
    targetObjectType: ObjectTypeApiName.annotateKey({ description: "The target that should hold the answer." }),
  }).pipe(
    $I.annoteSchema("LinkReverseMissing", {
      description: "A link side whose target holds no side of the same link type that leads back.",
    })
  )
) {}

/**
 * An interface extends an interface the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceParentMissing extends S.Opaque<InterfaceParentMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceParentMissing"),
    interfaceType: InterfaceTypeApiName.annotateKey({ description: "The extending interface." }),
    parent: InterfaceTypeApiName.annotateKey({ description: "The extended interface that is not defined." }),
  }).pipe(
    $I.annoteSchema("InterfaceParentMissing", {
      description: "An interface extends an interface the ontology does not define.",
    })
  )
) {}

/**
 * Interfaces extend one another in a circle, so each of them is its own ancestor.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceExtensionCycle extends S.Opaque<InterfaceExtensionCycle, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceExtensionCycle"),
    interfaceTypes: S.NonEmptyArray(InterfaceTypeApiName).annotateKey({
      description: "Every interface on the circle: one that extends itself, or several that extend each other.",
    }),
  }).pipe(
    $I.annoteSchema("InterfaceExtensionCycle", {
      description: "Interfaces extend one another in a circle, so each of them is its own ancestor.",
    })
  )
) {}

/**
 * An object type claims to implement an interface the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimedInterfaceMissing extends S.Opaque<ClaimedInterfaceMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("claimedInterfaceMissing"),
    objectType: ObjectTypeApiName.annotateKey({ description: "The claiming object type." }),
    interfaceType: InterfaceTypeApiName.annotateKey({ description: "The claimed interface that is not defined." }),
  }).pipe(
    $I.annoteSchema("ClaimedInterfaceMissing", {
      description: "An object type claims to implement an interface the ontology does not define.",
    })
  )
) {}

/**
 * An interface lists an implementer that does not claim it: the object type is undefined, or names neither the
 * interface nor one that extends it.
 *
 * @category models
 * @since 0.0.0
 */
export class ImplementerNotClaiming extends S.Opaque<ImplementerNotClaiming, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("implementerNotClaiming"),
    interfaceType: InterfaceTypeApiName.annotateKey({ description: "The interface that lists the implementer." }),
    objectType: ObjectTypeApiName.annotateKey({ description: "The listed object type that does not claim it." }),
  }).pipe(
    $I.annoteSchema("ImplementerNotClaiming", {
      description: "An interface lists an implementer that does not claim the interface.",
    })
  )
) {}

/**
 * An object type implements an interface property with a property it does not declare.
 *
 * @category models
 * @since 0.0.0
 */
export class ImplementedPropertyMissing extends S.Opaque<
  ImplementedPropertyMissing,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("implementedPropertyMissing"),
    objectType: ObjectTypeApiName.annotateKey({ description: "The implementing object type." }),
    interfaceType: InterfaceTypeApiName.annotateKey({ description: "The implemented interface." }),
    interfaceProperty: InterfacePropertyApiName.annotateKey({ description: "The interface property implemented." }),
    property: PropertyApiName.annotateKey({ description: "The named property the object type does not declare." }),
  }).pipe(
    $I.annoteSchema("ImplementedPropertyMissing", {
      description: "An object type implements an interface property with a property it does not declare.",
    })
  )
) {}

/**
 * A link an interface declares points at an object type or interface the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceLinkTargetMissing extends S.Opaque<
  InterfaceLinkTargetMissing,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("interfaceLinkTargetMissing"),
    interfaceType: InterfaceTypeApiName.annotateKey({ description: "The interface that declares the link." }),
    link: InterfaceLinkTypeApiName.annotateKey({ description: "The interface link." }),
    missing: LinkedEntity.annotateKey({ description: "The object type or interface that is not defined." }),
  }).pipe(
    $I.annoteSchema("InterfaceLinkTargetMissing", {
      description: "A link an interface declares points at a type the ontology does not define.",
    })
  )
) {}

/**
 * The type of an action parameter refers to an object type or interface the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class ActionParameterTypeMissing extends S.Opaque<
  ActionParameterTypeMissing,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("actionParameterTypeMissing"),
    actionType: ActionTypeApiName.annotateKey({ description: "The action type." }),
    parameter: ParameterId.annotateKey({ description: "The parameter whose type refers to it." }),
    missing: LinkedEntity.annotateKey({ description: "The object type or interface that is not defined." }),
  }).pipe(
    $I.annoteSchema("ActionParameterTypeMissing", {
      description: "The type of an action parameter refers to a type the ontology does not define.",
    })
  )
) {}

/**
 * An operation an action declares edits an object type or interface the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class ActionOperationTypeMissing extends S.Opaque<
  ActionOperationTypeMissing,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("actionOperationTypeMissing"),
    actionType: ActionTypeApiName.annotateKey({ description: "The action type." }),
    operation: S.Int.check(S.isGreaterThanOrEqualTo(0)).annotateKey({
      description: "Position of the operation in the action type's list, counted from zero.",
    }),
    missing: LinkedEntity.annotateKey({ description: "The object type or interface that is not defined." }),
  }).pipe(
    $I.annoteSchema("ActionOperationTypeMissing", {
      description: "An operation an action declares edits a type the ontology does not define.",
    })
  )
) {}

/**
 * A query's parameters, output or named types refer to an object type or interface the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryReferenceMissing extends S.Opaque<QueryReferenceMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("queryReferenceMissing"),
    query: VersionedQueryApiName.annotateKey({ description: "The name the query type is filed under." }),
    missing: LinkedEntity.annotateKey({ description: "The object type or interface that is not defined." }),
  }).pipe(
    $I.annoteSchema("QueryReferenceMissing", {
      description: "A query's signature refers to a type the ontology does not define.",
    })
  )
) {}

/**
 * A query refers by name to a data type its own table of named types does not hold.
 *
 * @category models
 * @since 0.0.0
 */
export class TypeReferenceDangling extends S.Opaque<TypeReferenceDangling, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("typeReferenceDangling"),
    query: VersionedQueryApiName.annotateKey({ description: "The name the query type is filed under." }),
    typeId: TypeReferenceId.annotateKey({ description: "The referenced name that the query type does not define." }),
  }).pipe(
    $I.annoteSchema("TypeReferenceDangling", {
      description: "A query refers by name to a data type its own table of named types does not hold.",
    })
  )
) {}

/**
 * A property names a value type the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyValueTypeMissing extends S.Opaque<PropertyValueTypeMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("propertyValueTypeMissing"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type that declares the property." }),
    property: PropertyApiName.annotateKey({ description: "The property." }),
    valueType: ValueTypeApiName.annotateKey({ description: "The named value type that is not defined." }),
  }).pipe(
    $I.annoteSchema("PropertyValueTypeMissing", {
      description: "A property names a value type the ontology does not define.",
    })
  )
) {}

/**
 * An object type says a property carries a shared property type the ontology does not define.
 *
 * @category models
 * @since 0.0.0
 */
export class SharedPropertyTypeMissing extends S.Opaque<SharedPropertyTypeMissing, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("sharedPropertyTypeMissing"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type that maps the shared property type." }),
    property: PropertyApiName.annotateKey({ description: "The property said to carry it." }),
    sharedPropertyType: SharedPropertyTypeApiName.annotateKey({
      description: "The shared property type that is not defined.",
    }),
  }).pipe(
    $I.annoteSchema("SharedPropertyTypeMissing", {
      description: "An object type says a property carries a shared property type the ontology does not define.",
    })
  )
) {}

/**
 * One thing wrong with an ontology taken as a whole, with the names that locate it.
 *
 * **Example** (Render a finding as one line)
 *
 * ```ts import.meta.vitest name="Render a finding as one line"
 * import * as A from "effect/Array"
 * import { LinkTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { LinkTargetMissing, OntologyFinding } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const describe = OntologyFinding.matchOrElse(
 *   {
 *     linkTargetMissing: ({ objectType, linkType, targetObjectType }) =>
 *       `${objectType}.${linkType} points at undefined ${targetObjectType}`,
 *     interfaceExtensionCycle: ({ interfaceTypes }) => `cycle: ${A.join(interfaceTypes, " -> ")}`,
 *   },
 *   (finding) => finding.type
 * )
 * const line = describe(
 *   LinkTargetMissing.make({
 *     objectType: ObjectTypeApiName.make("Employee"),
 *     linkType: LinkTypeApiName.make("badge"),
 *     targetObjectType: ObjectTypeApiName.make("Badge"),
 *   })
 * )
 * line // => "Employee.badge points at undefined Badge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyFinding = OntologyFindingKind.mapMembers(() =>
  Tuple.make(
    LinkTargetMissing,
    LinkReverseMissing,
    InterfaceParentMissing,
    InterfaceExtensionCycle,
    ClaimedInterfaceMissing,
    ImplementerNotClaiming,
    ImplementedPropertyMissing,
    InterfaceLinkTargetMissing,
    ActionParameterTypeMissing,
    ActionOperationTypeMissing,
    QueryReferenceMissing,
    TypeReferenceDangling,
    PropertyValueTypeMissing,
    SharedPropertyTypeMissing
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("OntologyFinding", {
    description: "One thing wrong with an ontology taken as a whole, with the names that locate it.",
  })
);

/**
 * Runtime type of {@link OntologyFinding}.
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyFinding = typeof OntologyFinding.Type;

// -----------------------------------------------------------------------------
// What a definition mentions
// -----------------------------------------------------------------------------

const objectTypeNamed = (apiName: ObjectTypeApiName): LinkedEntity => LinkedObjectType.make({ apiName });

const interfaceTypeNamed = (apiName: InterfaceTypeApiName): LinkedEntity => LinkedInterfaceType.make({ apiName });

const noMentions: () => ReadonlyArray<LinkedEntity> = A.empty<LinkedEntity>;

const dedupeMentions = A.dedupeWith(S.toEquivalence(LinkedEntity));

// Whether the ontology lacks the object type or interface a definition mentions.
const isUndefinedIn = (ontology: OntologyDefinition): ((entity: LinkedEntity) => boolean) =>
  LinkedEntity.match({
    objectTypeApiName: ({ apiName }) => !R.has(ontology.objectTypes, apiName),
    interfaceTypeApiName: ({ apiName }) => !R.has(ontology.interfaceTypes, apiName),
  });

const structFieldMentions: (dataType: OntologyDataType) => ReadonlyArray<LinkedEntity> = OntologyDataType.matchOrElse(
  {
    array: ({ elementType }) => structFieldMentions(elementType),
    set: ({ elementType }) => structFieldMentions(elementType),
    map: ({ keyType, valueType }) => A.appendAll(structFieldMentions(keyType), structFieldMentions(valueType)),
    struct: ({ fields }) => A.flatMap(fields, (field) => structFieldMentions(field.fieldType)),
    object: ({ objectApiName, objectTypeApiName }) => A.map([objectTypeApiName, objectApiName], objectTypeNamed),
    objectSet: ({ objectApiName, objectTypeApiName }) =>
      A.map(A.getSomes([objectTypeApiName, objectApiName]), objectTypeNamed),
  },
  noMentions
);

const parameterMentions: (dataType: ActionParameterType) => ReadonlyArray<LinkedEntity> =
  ActionParameterType.matchOrElse(
    {
      array: ({ elementType }) => parameterMentions(elementType),
      struct: ({ fields }) => A.flatMap(fields, (field) => structFieldMentions(field.fieldType)),
      object: ({ objectApiName, objectTypeApiName }) => A.map([objectTypeApiName, objectApiName], objectTypeNamed),
      objectSet: ({ objectApiName, objectTypeApiName }) =>
        A.map(A.getSomes([objectTypeApiName, objectApiName]), objectTypeNamed),
      interfaceObject: ({ interfaceTypeApiName }) => A.map(A.fromOption(interfaceTypeApiName), interfaceTypeNamed),
    },
    noMentions
  );

const operationMentions: (operation: ActionOperation) => ReadonlyArray<LinkedEntity> = ActionOperation.match({
  createObject: ({ objectTypeApiName }) => [objectTypeNamed(objectTypeApiName)],
  modifyObject: ({ objectTypeApiName }) => [objectTypeNamed(objectTypeApiName)],
  deleteObject: ({ objectTypeApiName }) => [objectTypeNamed(objectTypeApiName)],
  createLink: ({ aSideObjectTypeApiName, bSideObjectTypeApiName }) =>
    A.map([aSideObjectTypeApiName, bSideObjectTypeApiName], objectTypeNamed),
  deleteLink: ({ aSideObjectTypeApiName, bSideObjectTypeApiName }) =>
    A.map([aSideObjectTypeApiName, bSideObjectTypeApiName], objectTypeNamed),
  createInterfaceObject: ({ interfaceTypeApiName }) => [interfaceTypeNamed(interfaceTypeApiName)],
  modifyInterfaceObject: ({ interfaceTypeApiName }) => [interfaceTypeNamed(interfaceTypeApiName)],
  deleteInterfaceObject: ({ interfaceTypeApiName }) => [interfaceTypeNamed(interfaceTypeApiName)],
  applyScenario: ({ objectTypeApiNames, linkTypes }) =>
    A.map(
      A.appendAll(
        objectTypeApiNames,
        A.map(linkTypes, (scope) => scope.objectTypeApiName)
      ),
      objectTypeNamed
    ),
});

const queryChildren: (dataType: QueryDataType) => ReadonlyArray<QueryDataType> = QueryDataType.matchOrElse(
  {
    array: ({ elementType }) => [elementType],
    set: ({ elementType }) => [elementType],
    entrySet: ({ keyType, valueType }) => [keyType, valueType],
    struct: ({ fields }) => A.map(fields, (field) => field.fieldType),
    union: ({ unionTypes }) => unionTypes,
  },
  A.empty<QueryDataType>
);

// A data type and everything nested inside it. By-name references are leaves: what they name is walked separately.
const queryNodes = (dataType: QueryDataType): ReadonlyArray<QueryDataType> =>
  A.prepend(A.flatMap(queryChildren(dataType), queryNodes), dataType);

const queryNodeMentions: (dataType: QueryDataType) => ReadonlyArray<LinkedEntity> = QueryDataType.matchOrElse(
  {
    object: ({ objectApiName, objectTypeApiName }) => A.map([objectTypeApiName, objectApiName], objectTypeNamed),
    objectSet: ({ objectApiName, objectTypeApiName }) =>
      A.map(A.getSomes([objectTypeApiName, objectApiName]), objectTypeNamed),
    interfaceObject: ({ interfaceTypeApiName }) => A.map(A.fromOption(interfaceTypeApiName), interfaceTypeNamed),
    interfaceObjectSet: ({ interfaceTypeApiName }) => [interfaceTypeNamed(interfaceTypeApiName)],
  },
  noMentions
);

// Every data type a query type states, flattened: parameters, output and the table of named types.
const signatureNodes = (queryType: QueryType): ReadonlyArray<QueryDataType> =>
  A.flatMap(
    A.appendAll(
      A.prepend(
        A.map(R.values(queryType.parameters), (parameter) => parameter.dataType),
        queryType.output
      ),
      R.values(queryType.typeReferences)
    ),
    queryNodes
  );

const localProperty = ({ propertyApiName }: LocalPropertyImplementation): ReadonlyArray<PropertyApiName> => [
  propertyApiName,
];

const structFieldProperty = ({ structFieldOfProperty }: StructFieldImplementation): ReadonlyArray<PropertyApiName> => [
  structFieldOfProperty.propertyApiName,
];

const structProperties = ({ mapping }: StructImplementation): ReadonlyArray<PropertyApiName> =>
  A.dedupe(
    A.map(
      R.values(mapping),
      StructFieldSource.match({
        property: ({ propertyApiName }) => propertyApiName,
        structFieldOfProperty: ({ propertyApiName }) => propertyApiName,
      })
    )
  );

const unreducedProperties: (
  implementation: UnreducedInterfacePropertyImplementation
) => ReadonlyArray<PropertyApiName> = UnreducedInterfacePropertyImplementation.match({
  localPropertyImplementation: localProperty,
  structFieldImplementation: structFieldProperty,
  structImplementation: structProperties,
});

// The object type's own properties an implementation of one interface property draws on.
const implementationProperties: (implementation: InterfacePropertyImplementation) => ReadonlyArray<PropertyApiName> =
  InterfacePropertyImplementation.match({
    localPropertyImplementation: localProperty,
    structFieldImplementation: structFieldProperty,
    structImplementation: structProperties,
    reducedPropertyImplementation: ({ implementation }) => unreducedProperties(implementation),
  });

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------

type Rule = (ontology: OntologyDefinition) => ReadonlyArray<OntologyFinding>;

// A link side must point at a defined object type, and that type must hold the side that leads back.
const linkRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.objectTypes), ([objectType, definition]) =>
    A.getSomes(
      A.map(definition.linkTypes, (side): O.Option<OntologyFinding> => {
        const located = { objectType, linkType: side.apiName, targetObjectType: side.targetObjectType };
        if (!R.has(ontology.objectTypes, side.targetObjectType)) {
          return O.some(LinkTargetMissing.make(located));
        }
        return O.isNone(getReverseLinkSide(ontology, objectType, side.apiName))
          ? O.some(LinkReverseMissing.make(located))
          : O.none();
      })
    )
  );

// An interface may only extend interfaces the ontology defines.
const interfaceParentRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.interfaceTypes), ([interfaceType, definition]) =>
    pipe(
      definition.extendsInterfaces,
      A.filter((parent) => !R.has(ontology.interfaceTypes, parent)),
      A.map((parent) => InterfaceParentMissing.make({ interfaceType, parent }))
    )
  );

// No interface may be its own ancestor. Each strongly connected group that holds a circle is one finding.
const interfaceCycleRule: Rule = (ontology) => {
  const graph = interfaceGraph(ontology);
  return Graph.isAcyclic(graph)
    ? A.empty<OntologyFinding>()
    : pipe(
        Graph.stronglyConnectedComponents(graph),
        A.filter(
          (component) => A.length(component) > 1 || A.some(component, (index) => Graph.hasEdge(graph, index, index))
        ),
        A.map((component) =>
          pipe(
            A.getSomes(A.map(component, (index) => Graph.getNode(graph, index))),
            A.match({
              onEmpty: O.none<OntologyFinding>,
              onNonEmpty: (interfaceTypes) => O.some<OntologyFinding>(InterfaceExtensionCycle.make({ interfaceTypes })),
            })
          )
        ),
        A.getSomes
      );
};

// An object type may only claim interfaces the ontology defines.
const claimedInterfaceRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.objectTypes), ([objectType, definition]) =>
    pipe(
      claimedInterfaces(definition),
      A.filter((interfaceType) => !R.has(ontology.interfaceTypes, interfaceType)),
      A.map((interfaceType) => ClaimedInterfaceMissing.make({ objectType, interfaceType }))
    )
  );

// Every implementer an interface lists must claim the interface, directly or through one that extends it.
const implementerRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.interfaceTypes), ([interfaceType, definition]) => {
    const claiming = implementers(ontology, interfaceType);
    return pipe(
      definition.implementedByObjectTypes,
      A.filter((objectType) => !A.contains(claiming, objectType)),
      A.map((objectType) => ImplementerNotClaiming.make({ interfaceType, objectType }))
    );
  });

// An implementation of an interface property may only draw on properties the object type declares.
const implementedPropertyRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.objectTypes), ([objectType, definition]) =>
    A.flatMap(R.toEntries(definition.interfaceImplementations), ([interfaceType, implementation]) =>
      A.flatMap(R.toEntries(implementation.propertyImplementations), ([interfaceProperty, propertyImplementation]) =>
        pipe(
          implementationProperties(propertyImplementation),
          A.filter((property) => !R.has(definition.objectType.properties, property)),
          A.map((property) =>
            ImplementedPropertyMissing.make({ objectType, interfaceType, interfaceProperty, property })
          )
        )
      )
    )
  );

// A link an interface declares must point at a defined object type or interface.
const interfaceLinkRule: Rule = (ontology) => {
  const isUndefined = isUndefinedIn(ontology);
  return A.flatMap(R.toEntries(ontology.interfaceTypes), ([interfaceType, definition]) =>
    pipe(
      R.toEntries(definition.ownLinks),
      A.filter(([, link]) => isUndefined(link.linkedEntity)),
      A.map(([link, { linkedEntity }]) =>
        InterfaceLinkTargetMissing.make({ interfaceType, link, missing: linkedEntity })
      )
    )
  );
};

const undefinedParameterTypes = (
  ontology: OntologyDefinition,
  actionType: ActionTypeApiName,
  definition: ActionType
): ReadonlyArray<OntologyFinding> =>
  A.flatMap(R.toEntries(definition.parameters), ([parameter, { dataType }]) =>
    pipe(
      dedupeMentions(parameterMentions(dataType)),
      A.filter(isUndefinedIn(ontology)),
      A.map((missing) => ActionParameterTypeMissing.make({ actionType, parameter, missing }))
    )
  );

const undefinedOperationTypes = (
  ontology: OntologyDefinition,
  actionType: ActionTypeApiName,
  definition: ActionType
): ReadonlyArray<OntologyFinding> =>
  A.flatMap(definition.operations, (operation, index) =>
    pipe(
      dedupeMentions(operationMentions(operation)),
      A.filter(isUndefinedIn(ontology)),
      A.map((missing) => ActionOperationTypeMissing.make({ actionType, operation: index, missing }))
    )
  );

// Parameter types and declared operations of an action may only refer to defined object types and interfaces.
const actionRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.actionTypes), ([actionType, definition]) =>
    A.appendAll(
      undefinedParameterTypes(ontology, actionType, definition),
      undefinedOperationTypes(ontology, actionType, definition)
    )
  );

// A query's signature may only refer to defined object types and interfaces.
const queryReferenceRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.queryTypes), ([query, queryType]) =>
    pipe(
      dedupeMentions(A.flatMap(signatureNodes(queryType), queryNodeMentions)),
      A.filter(isUndefinedIn(ontology)),
      A.map((missing) => QueryReferenceMissing.make({ query, missing }))
    )
  );

// Every by-name reference in a query's signature must name an entry of that query's table of named types.
const typeReferenceRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.queryTypes), ([query, queryType]) =>
    pipe(
      A.filter(signatureNodes(queryType), QueryDataType.guards.typeReference),
      A.map((reference) => reference.typeId),
      A.dedupe,
      A.filter((typeId) => !R.has(queryType.typeReferences, typeId)),
      A.map((typeId) => TypeReferenceDangling.make({ query, typeId }))
    )
  );

// A property may only name a value type the ontology defines.
const propertyValueTypeRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.objectTypes), ([objectType, definition]) =>
    A.getSomes(
      A.map(R.toEntries(definition.objectType.properties), ([property, { valueTypeApiName }]) =>
        pipe(
          valueTypeApiName,
          O.filter((valueType) => !R.has(ontology.valueTypes, valueType)),
          O.map((valueType) => PropertyValueTypeMissing.make({ objectType, property, valueType }))
        )
      )
    )
  );

// A property may only be said to carry a shared property type the ontology defines.
const sharedPropertyTypeRule: Rule = (ontology) =>
  A.flatMap(R.toEntries(ontology.objectTypes), ([objectType, definition]) =>
    pipe(
      R.toEntries(definition.sharedPropertyTypeMapping),
      A.filter(([sharedPropertyType]) => !R.has(ontology.sharedPropertyTypes, sharedPropertyType)),
      A.map(([sharedPropertyType, property]) =>
        SharedPropertyTypeMissing.make({ objectType, property, sharedPropertyType })
      )
    )
  );

const rules: ReadonlyArray<Rule> = [
  linkRule,
  interfaceParentRule,
  interfaceCycleRule,
  claimedInterfaceRule,
  implementerRule,
  implementedPropertyRule,
  interfaceLinkRule,
  actionRule,
  queryReferenceRule,
  typeReferenceRule,
  propertyValueTypeRule,
  sharedPropertyTypeRule,
];

/**
 * Everything wrong with an ontology taken as a whole. An empty list means every name in it leads somewhere.
 *
 * **Details**
 *
 * The rules, each a small function over the whole ontology, run one after
 * another and their findings are concatenated:
 *
 * - a link side points at a defined object type, and that type holds the side that leads back;
 * - an interface extends only defined interfaces, and never itself, however indirectly (found as the circles of
 *   the inheritance graph);
 * - an object type claims only defined interfaces, and every implementer an interface lists claims it;
 * - an interface property is implemented with properties the object type declares;
 * - an interface link, an action parameter type, an action operation and a query signature refer only to defined
 *   object types and interfaces;
 * - a by-name reference in a query names an entry of that query's own table;
 * - a property names a defined value type, and maps a defined shared property type.
 *
 * A finding is a fact about the value in hand, not a verdict on the platform:
 * an ontology loaded by naming a few types reports the links that lead out of
 * that selection.
 *
 * **Example** (Report a link side that nothing answers)
 *
 * ```ts import.meta.vitest name="Report a link side that nothing answers"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OntologyDefinition, validateOntology } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const objectType = (apiName: string, linkTypes: ReadonlyArray<unknown>) => ({
 *   objectType: {
 *     apiName,
 *     displayName: apiName,
 *     pluralDisplayName: apiName,
 *     status: "ACTIVE",
 *     icon: { type: "blueprint", color: "blue", name: "cube" },
 *     rid: `ri.ontology.main.object-type.${apiName}`,
 *     primaryKey: "id",
 *     titleProperty: "id",
 *     properties: { id: { dataType: { type: "string" }, rid: "ri.ontology.main.property.id" } },
 *   },
 *   linkTypes,
 *   implementsInterfaces: [],
 *   implementsInterfaces2: {},
 *   sharedPropertyTypeMapping: {},
 * })
 * const office = {
 *   apiName: "office",
 *   displayName: "Office",
 *   status: "ACTIVE",
 *   objectTypeApiName: "Office",
 *   cardinality: "ONE",
 *   linkTypeRid: "ri.ontology.main.link-type.occupancy",
 * }
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: { Employee: objectType("Employee", [office]), Office: objectType("Office", []) },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const kinds = A.map(validateOntology(ontology), (finding) => `${finding.type}`)
 * kinds // => ["linkReverseMissing"]
 * ```
 *
 * @param ontology - The ontology to check.
 * @returns Every finding, grouped by rule in the order listed above.
 * @category validation
 * @since 0.0.0
 */
export const validateOntology = (ontology: OntologyDefinition): ReadonlyArray<OntologyFinding> =>
  A.flatMap(rules, (rule) => rule(ontology));
