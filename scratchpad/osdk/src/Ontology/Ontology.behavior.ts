/**
 * Questions an ontology answers about itself: lookups by name, the graph its links form, interface ancestry and
 * API namespaces.
 *
 * **Details**
 *
 * Every function here is total. A name the ontology does not define is `none`
 * or an empty list, never an exception, because an ontology in hand is often a
 * partial one. The two graphs are `effect/Graph` values, so reachability,
 * components and cycles are the library's algorithms rather than loops written
 * here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { ApiNameParts } from "./Ontology.model.ts";
import type { ActionType } from "../Action/Action.model.ts";
import type {
  ActionTypeApiName,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectTypeApiName,
} from "../Identifier/Identifier.model.ts";
import type { InterfaceType } from "../InterfaceType/InterfaceType.model.ts";
import type { LinkTypeSide } from "../LinkType/LinkType.model.ts";
import type { ObjectTypeDefinition } from "../ObjectType/ObjectType.model.ts";
import type { QueryType } from "../Query/Query.model.ts";
import type { OntologyDefinition, QuerySelector } from "./Ontology.model.ts";

// -----------------------------------------------------------------------------
// Lookups
// -----------------------------------------------------------------------------

/**
 * The object type with the given API name, with its link sides and interface implementations.
 *
 * **Example** (Find a defined object type and miss an undefined one)
 *
 * ```ts import.meta.vitest name="Find a defined object type and miss an undefined one"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getObjectType, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Office: {
 *         objectType: {
 *           apiName: "Office",
 *           displayName: "Office",
 *           pluralDisplayName: "Offices",
 *           status: "ACTIVE",
 *           icon: { type: "blueprint", color: "blue", name: "office" },
 *           rid: "ri.ontology.main.object-type.office",
 *           primaryKey: "officeId",
 *           titleProperty: "officeId",
 *           properties: { officeId: { dataType: { type: "string" }, rid: "ri.ontology.main.property.office-id" } },
 *         },
 *         linkTypes: [],
 *         implementsInterfaces: [],
 *         implementsInterfaces2: {},
 *         sharedPropertyTypeMapping: {},
 *       },
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const found = [
 *   O.isSome(getObjectType(ontology, ObjectTypeApiName.make("Office"))),
 *   O.isSome(getObjectType(ontology, ObjectTypeApiName.make("Employee"))),
 * ]
 * found // => [true, false]
 * ```
 *
 * @param ontology - The ontology to search.
 * @param name - API name of the object type.
 * @returns The object type definition, or none when the ontology does not define the name.
 * @category getters
 * @since 0.0.0
 */
export const getObjectType: {
  (name: ObjectTypeApiName): (ontology: OntologyDefinition) => O.Option<ObjectTypeDefinition>;
  (ontology: OntologyDefinition, name: ObjectTypeApiName): O.Option<ObjectTypeDefinition>;
} = dual(
  2,
  (ontology: OntologyDefinition, name: ObjectTypeApiName): O.Option<ObjectTypeDefinition> =>
    R.get(ontology.objectTypes, name)
);

/**
 * The interface type with the given API name.
 *
 * **Example** (Find an interface by name)
 *
 * ```ts import.meta.vitest name="Find an interface by name"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InterfaceTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getInterfaceType, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {},
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {
 *       Named: {
 *         rid: "ri.interface.main.interface.named",
 *         apiName: "Named",
 *         displayName: "Named",
 *         properties: {},
 *         allProperties: {},
 *         propertiesV2: {},
 *         allPropertiesV2: {},
 *         extendsInterfaces: [],
 *         allExtendsInterfaces: [],
 *         implementedByObjectTypes: [],
 *         links: {},
 *         allLinks: {},
 *       },
 *     },
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const displayName = O.getOrNull(
 *   O.map(getInterfaceType(ontology, InterfaceTypeApiName.make("Named")), (named) => named.displayName)
 * )
 * displayName // => "Named"
 * ```
 *
 * @param ontology - The ontology to search.
 * @param name - API name of the interface type.
 * @returns The interface type, or none when the ontology does not define the name.
 * @category getters
 * @since 0.0.0
 */
export const getInterfaceType: {
  (name: InterfaceTypeApiName): (ontology: OntologyDefinition) => O.Option<InterfaceType>;
  (ontology: OntologyDefinition, name: InterfaceTypeApiName): O.Option<InterfaceType>;
} = dual(
  2,
  (ontology: OntologyDefinition, name: InterfaceTypeApiName): O.Option<InterfaceType> =>
    R.get(ontology.interfaceTypes, name)
);

/**
 * The action type with the given API name.
 *
 * **Example** (Find an action and read what it edits)
 *
 * ```ts import.meta.vitest name="Find an action and read what it edits"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ActionTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getActionType, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {},
 *     actionTypes: {
 *       closeOffice: {
 *         apiName: "closeOffice",
 *         rid: "ri.ontology.main.action-type.close-office",
 *         status: "ACTIVE",
 *         parameters: {},
 *         operations: [{ type: "deleteObject", objectTypeApiName: "Office" }],
 *       },
 *     },
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const operations = O.getOrNull(
 *   O.map(getActionType(ontology, ActionTypeApiName.make("closeOffice")), (action) =>
 *     A.map(action.operations, (operation) => operation.type)
 *   )
 * )
 * operations // => ["deleteObject"]
 * ```
 *
 * @param ontology - The ontology to search.
 * @param name - API name of the action type.
 * @returns The action type, or none when the ontology does not define the name.
 * @category getters
 * @since 0.0.0
 */
export const getActionType: {
  (name: ActionTypeApiName): (ontology: OntologyDefinition) => O.Option<ActionType>;
  (ontology: OntologyDefinition, name: ActionTypeApiName): O.Option<ActionType>;
} = dual(
  2,
  (ontology: OntologyDefinition, name: ActionTypeApiName): O.Option<ActionType> => R.get(ontology.actionTypes, name)
);

const sameText = (left: string, right: string): boolean => left === right;

const filedAsLatest = (key: string, apiName: string): boolean =>
  sameText(key, apiName) || sameText(key, `${apiName}:latest`);

/**
 * The query type a selector asks for: a named version, or the latest one when the selector names none.
 *
 * **Details**
 *
 * A pinned version is found wherever it is filed, by the version the query
 * type itself states. "Latest" is found only where the ontology says so: under
 * the bare API name, or under the name followed by `:latest`. An ontology that
 * was loaded with pinned versions alone does not know which of them is the
 * latest, and this function does not guess.
 *
 * **Example** (Find a pinned version and refuse to guess the latest)
 *
 * ```ts import.meta.vitest name="Find a pinned version and refuse to guess the latest"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FunctionVersion, QueryApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getQueryType, OntologyDefinition, QuerySelector } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {},
 *     actionTypes: {},
 *     queryTypes: {
 *       "addOne:0.0.9": {
 *         apiName: "addOne",
 *         parameters: { n: { dataType: { type: "integer" }, required: true } },
 *         output: { type: "integer" },
 *         rid: "ri.function-registry.main.function.abd64ff3-276e-48c5-afee-5a6ef0b2ea47",
 *         version: "0.0.9",
 *       },
 *     },
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const addOne = QueryApiName.make("addOne")
 * const pinned = QuerySelector.make({ apiName: addOne, version: O.some(FunctionVersion.make("0.0.9")) })
 * const latest = QuerySelector.make({ apiName: addOne })
 * const found = [O.isSome(getQueryType(ontology, pinned)), O.isSome(getQueryType(ontology, latest))]
 * found // => [true, false]
 * ```
 *
 * @param ontology - The ontology to search.
 * @param selector - Which query, and which version of it.
 * @returns The query type, or none when the ontology does not hold what the selector asks for.
 * @category getters
 * @since 0.0.0
 */
export const getQueryType: {
  (selector: QuerySelector): (ontology: OntologyDefinition) => O.Option<QueryType>;
  (ontology: OntologyDefinition, selector: QuerySelector): O.Option<QueryType>;
} = dual(
  2,
  (ontology: OntologyDefinition, selector: QuerySelector): O.Option<QueryType> =>
    pipe(
      R.toEntries(ontology.queryTypes),
      A.findFirst(
        ([key, queryType]) =>
          queryType.apiName === selector.apiName &&
          O.match(selector.version, {
            onNone: () => filedAsLatest(key, selector.apiName),
            onSome: (version) => queryType.version === version,
          })
      ),
      O.map(([, queryType]) => queryType)
    )
);

const sidesOf = (ontology: OntologyDefinition, objectType: ObjectTypeApiName): ReadonlyArray<LinkTypeSide> =>
  pipe(
    R.get(ontology.objectTypes, objectType),
    O.match({ onNone: A.empty<LinkTypeSide>, onSome: (definition) => definition.linkTypes })
  );

/**
 * The link side an object type holds under the given name: one direction of a link type, starting from that type.
 *
 * **Example** (Follow a link side to its target)
 *
 * ```ts import.meta.vitest name="Follow a link side to its target"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getLinkSide, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
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
 * const side = (apiName: string, target: string) => ({
 *   apiName,
 *   displayName: apiName,
 *   status: "ACTIVE",
 *   objectTypeApiName: target,
 *   cardinality: "MANY",
 *   linkTypeRid: "ri.ontology.main.link-type.occupancy",
 * })
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Employee: objectType("Employee", [side("office", "Office")]),
 *       Office: objectType("Office", [side("occupants", "Employee")]),
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const target = O.getOrNull(
 *   O.map(
 *     getLinkSide(ontology, ObjectTypeApiName.make("Employee"), LinkTypeApiName.make("office")),
 *     (found) => found.targetObjectType
 *   )
 * )
 * target // => "Office"
 * ```
 *
 * @param ontology - The ontology to search.
 * @param objectType - API name of the object type the side starts from.
 * @param linkType - API name of the side, unique among the sides of that object type.
 * @returns The link side, or none when the object type or the side is not defined.
 * @category getters
 * @since 0.0.0
 */
export const getLinkSide: {
  (objectType: ObjectTypeApiName, linkType: LinkTypeApiName): (ontology: OntologyDefinition) => O.Option<LinkTypeSide>;
  (ontology: OntologyDefinition, objectType: ObjectTypeApiName, linkType: LinkTypeApiName): O.Option<LinkTypeSide>;
} = dual(
  3,
  (ontology: OntologyDefinition, objectType: ObjectTypeApiName, linkType: LinkTypeApiName): O.Option<LinkTypeSide> =>
    A.findFirst(sidesOf(ontology, objectType), (side) => side.apiName === linkType)
);

/**
 * The other direction of a link: the side its target object type holds that leads back to where this side starts.
 *
 * **Details**
 *
 * The wire has no record for a link type, only its two sides, each filed under
 * the object type it starts from. Two sides belong together when they share a
 * link type RID and each targets the other's holder. For a link from a type to
 * itself both sides sit under the same object type, and the reverse is the
 * other one of the pair.
 *
 * **Example** (Find the side that answers a link)
 *
 * ```ts import.meta.vitest name="Find the side that answers a link"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { getReverseLinkSide, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
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
 * const side = (apiName: string, target: string) => ({
 *   apiName,
 *   displayName: apiName,
 *   status: "ACTIVE",
 *   objectTypeApiName: target,
 *   cardinality: "MANY",
 *   linkTypeRid: "ri.ontology.main.link-type.occupancy",
 * })
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Employee: objectType("Employee", [side("office", "Office")]),
 *       Office: objectType("Office", [side("occupants", "Employee")]),
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const reverse = O.getOrNull(
 *   O.map(
 *     getReverseLinkSide(ontology, ObjectTypeApiName.make("Employee"), LinkTypeApiName.make("office")),
 *     (found) => found.apiName
 *   )
 * )
 * reverse // => "occupants"
 * ```
 *
 * @param ontology - The ontology to search.
 * @param objectType - API name of the object type the known side starts from.
 * @param linkType - API name of the known side.
 * @returns The answering side, or none when the known side, its target or the answer is not defined.
 * @category getters
 * @since 0.0.0
 */
export const getReverseLinkSide: {
  (objectType: ObjectTypeApiName, linkType: LinkTypeApiName): (ontology: OntologyDefinition) => O.Option<LinkTypeSide>;
  (ontology: OntologyDefinition, objectType: ObjectTypeApiName, linkType: LinkTypeApiName): O.Option<LinkTypeSide>;
} = dual(
  3,
  (ontology: OntologyDefinition, objectType: ObjectTypeApiName, linkType: LinkTypeApiName): O.Option<LinkTypeSide> =>
    pipe(
      getLinkSide(ontology, objectType, linkType),
      O.flatMap((side) =>
        A.findFirst(
          sidesOf(ontology, side.targetObjectType),
          (candidate) =>
            candidate.linkTypeRid === side.linkTypeRid &&
            candidate.targetObjectType === objectType &&
            !(side.targetObjectType === objectType && candidate.apiName === side.apiName)
        )
      )
    )
);

// -----------------------------------------------------------------------------
// Graphs
// -----------------------------------------------------------------------------

// Builds a directed graph from adjacency lists keyed by name. An edge to a name that is not a node is left out.
const graphOf = <Name, Link>(
  adjacency: ReadonlyArray<readonly [name: Name, links: ReadonlyArray<readonly [target: Name, link: Link]>]>
): Graph.DirectedGraph<Name, Link> =>
  Graph.directed<Name, Link>((mutable) => {
    const placed = A.map(adjacency, ([name, links]) => ({ name, links, index: Graph.addNode(mutable, name) }));
    const indexByName = HashMap.fromIterable(A.map(placed, ({ name, index }) => Tuple.make(name, index)));
    A.forEach(placed, ({ index, links }) => {
      A.forEach(links, ([target, link]) => {
        const targetIndex = HashMap.get(indexByName, target);
        if (O.isSome(targetIndex)) {
          Graph.addEdge(mutable, index, targetIndex.value, link);
        }
      });
    });
  });

const namesAt = <Name, Link>(
  graph: Graph.DirectedGraph<Name, Link>,
  indices: ReadonlyArray<Graph.NodeIndex>
): ReadonlyArray<Name> => A.getSomes(A.map(indices, (index) => Graph.getNode(graph, index)));

// Every node reachable from the named one by following edges forward, the named one first.
const reachableFrom = <Name, Link>(graph: Graph.DirectedGraph<Name, Link>, name: Name): ReadonlyArray<Name> =>
  pipe(
    Graph.findNode(graph, (candidate) => candidate === name),
    O.match({
      onNone: A.empty<Name>,
      onSome: (start) => pipe(Graph.dfs(graph, { start: [start] }), Graph.values, A.fromIterable),
    })
  );

/**
 * The ontology's links as a directed graph: one node per object type, one edge per link side, from holder to target.
 *
 * **Details**
 *
 * Node data is the object type's API name; edge data is the whole link side.
 * A link type contributes two edges, one for each of its sides. A side whose
 * target the ontology does not define has nowhere to point and is left out;
 * `validateOntology` reports it.
 *
 * **Example** (Count the object types and link sides of an ontology)
 *
 * ```ts import.meta.vitest name="Count the object types and link sides of an ontology"
 * import * as Effect from "effect/Effect"
 * import * as Graph from "effect/Graph"
 * import * as S from "effect/Schema"
 * import { linkGraph, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
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
 * const side = (apiName: string, target: string) => ({
 *   apiName,
 *   displayName: apiName,
 *   status: "ACTIVE",
 *   objectTypeApiName: target,
 *   cardinality: "MANY",
 *   linkTypeRid: "ri.ontology.main.link-type.occupancy",
 * })
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Employee: objectType("Employee", [side("office", "Office"), side("badge", "Badge")]),
 *       Office: objectType("Office", [side("occupants", "Employee")]),
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const graph = linkGraph(ontology)
 * const counts = [Graph.nodeCount(graph), Graph.edgeCount(graph)]
 * counts // => [2, 2]
 * ```
 *
 * @param ontology - The ontology whose links to lay out.
 * @returns A directed graph of object type names joined by link sides.
 * @category projections
 * @since 0.0.0
 */
export const linkGraph = (ontology: OntologyDefinition): Graph.DirectedGraph<ObjectTypeApiName, LinkTypeSide> =>
  graphOf(
    A.map(R.toEntries(ontology.objectTypes), ([name, definition]) =>
      Tuple.make(
        name,
        A.map(definition.linkTypes, (side) => Tuple.make(side.targetObjectType, side))
      )
    )
  );

/**
 * Every object type one can arrive at from the given one by following link sides, the given one first.
 *
 * **Details**
 *
 * This is the reach of a traversal: an object set of the starting type can be
 * moved onto each of these types by some chain of links, and onto no other.
 * The order is depth-first from the start. An object type the ontology does
 * not define reaches nothing, itself included.
 *
 * **Example** (List what a chain of links can reach)
 *
 * ```ts import.meta.vitest name="List what a chain of links can reach"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { OntologyDefinition, reachableObjectTypes } from "@beep/scratchpad/osdk/src/Ontology/index"
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
 * const side = (apiName: string, target: string) => ({
 *   apiName,
 *   displayName: apiName,
 *   status: "ACTIVE",
 *   objectTypeApiName: target,
 *   cardinality: "MANY",
 *   linkTypeRid: `ri.ontology.main.link-type.${apiName}`,
 * })
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Employee: objectType("Employee", [side("office", "Office")]),
 *       Office: objectType("Office", [side("building", "Building")]),
 *       Building: objectType("Building", []),
 *       Vendor: objectType("Vendor", []),
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const reach = [
 *   reachableObjectTypes(ontology, ObjectTypeApiName.make("Employee")),
 *   reachableObjectTypes(ontology, ObjectTypeApiName.make("Building")),
 * ]
 * reach // => [["Employee", "Office", "Building"], ["Building"]]
 * ```
 *
 * @param ontology - The ontology whose links to follow.
 * @param from - API name of the object type to start from.
 * @returns The reachable object types in depth-first order, or an empty list when `from` is not defined.
 * @category projections
 * @since 0.0.0
 */
export const reachableObjectTypes: {
  (from: ObjectTypeApiName): (ontology: OntologyDefinition) => ReadonlyArray<ObjectTypeApiName>;
  (ontology: OntologyDefinition, from: ObjectTypeApiName): ReadonlyArray<ObjectTypeApiName>;
} = dual(
  2,
  (ontology: OntologyDefinition, from: ObjectTypeApiName): ReadonlyArray<ObjectTypeApiName> =>
    reachableFrom(linkGraph(ontology), from)
);

/**
 * The islands of an ontology: groups of object types joined by links in either direction, with no link between groups.
 *
 * **Details**
 *
 * One group means every object type can be related to every other by some
 * chain of links; an object type alone in its group has no link to or from
 * anything the ontology defines. These are the weakly connected components of
 * {@link linkGraph}.
 *
 * **Example** (Tell a linked pair from an isolated type)
 *
 * ```ts import.meta.vitest name="Tell a linked pair from an isolated type"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { linkComponents, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
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
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Employee: objectType("Employee", [
 *         {
 *           apiName: "office",
 *           displayName: "Office",
 *           status: "ACTIVE",
 *           objectTypeApiName: "Office",
 *           cardinality: "ONE",
 *           linkTypeRid: "ri.ontology.main.link-type.occupancy",
 *         },
 *       ]),
 *       Office: objectType("Office", []),
 *       Vendor: objectType("Vendor", []),
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {},
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * linkComponents(ontology) // => [["Employee", "Office"], ["Vendor"]]
 * ```
 *
 * @param ontology - The ontology whose links to group by.
 * @returns The groups of mutually linked object types.
 * @category projections
 * @since 0.0.0
 */
export const linkComponents = (ontology: OntologyDefinition): ReadonlyArray<ReadonlyArray<ObjectTypeApiName>> => {
  const graph = linkGraph(ontology);
  return A.map(Graph.weaklyConnectedComponents(graph), (component) => namesAt(graph, component));
};

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

const extendsEdge: "extends" = "extends";

/**
 * The ontology's interface inheritance as a directed graph: one node per interface, one edge from each interface to
 * each interface it extends directly.
 *
 * **Details**
 *
 * The graph is built from `extendsInterfaces` alone, the one statement of
 * inheritance an interface makes itself. The closure the wire also sends
 * (`ancestorInterfaces`) is a claim about this graph, not an input to it. An
 * extended interface the ontology does not define has no node and so no edge.
 *
 * **Example** (Detect that inheritance runs in a circle)
 *
 * ```ts import.meta.vitest name="Detect that inheritance runs in a circle"
 * import * as Effect from "effect/Effect"
 * import * as Graph from "effect/Graph"
 * import * as S from "effect/Schema"
 * import { interfaceGraph, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const interfaceType = (apiName: string, extendsInterfaces: ReadonlyArray<string>) => ({
 *   rid: `ri.interface.main.interface.${apiName}`,
 *   apiName,
 *   displayName: apiName,
 *   properties: {},
 *   allProperties: {},
 *   propertiesV2: {},
 *   allPropertiesV2: {},
 *   extendsInterfaces,
 *   allExtendsInterfaces: extendsInterfaces,
 *   implementedByObjectTypes: [],
 *   links: {},
 *   allLinks: {},
 * })
 * const ontologyOf = (interfaceTypes: Record<string, unknown>) =>
 *   Effect.runPromise(
 *     S.decodeUnknownEffect(OntologyDefinition)({
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {},
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes,
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     })
 *   )
 * const sound = await ontologyOf({ Lead: interfaceType("Lead", ["Person"]), Person: interfaceType("Person", []) })
 * const circular = await ontologyOf({ A: interfaceType("A", ["B"]), B: interfaceType("B", ["A"]) })
 * const verdicts = [Graph.isAcyclic(interfaceGraph(sound)), Graph.isAcyclic(interfaceGraph(circular))]
 * verdicts // => [true, false]
 * ```
 *
 * @param ontology - The ontology whose interfaces to lay out.
 * @returns A directed graph of interface names, each pointing at the interfaces it extends.
 * @category projections
 * @since 0.0.0
 */
export const interfaceGraph = (ontology: OntologyDefinition): Graph.DirectedGraph<InterfaceTypeApiName, "extends"> =>
  graphOf(
    A.map(R.toEntries(ontology.interfaceTypes), ([name, interfaceType]) =>
      Tuple.make(
        name,
        A.map(interfaceType.extendsInterfaces, (parent) => Tuple.make(parent, extendsEdge))
      )
    )
  );

const ancestorsIn = (
  graph: Graph.DirectedGraph<InterfaceTypeApiName, "extends">,
  name: InterfaceTypeApiName
): ReadonlyArray<InterfaceTypeApiName> => A.filter(reachableFrom(graph, name), (ancestor) => ancestor !== name);

/**
 * Every interface the given one extends, directly or through another interface.
 *
 * **Details**
 *
 * The answer is computed by walking {@link interfaceGraph}, which visits each
 * interface once, so inheritance that runs in a circle still terminates. The
 * interface itself is never among its ancestors, circle or not, and neither is
 * an extended interface the ontology does not define.
 *
 * **Example** (Collect ancestors across two levels)
 *
 * ```ts import.meta.vitest name="Collect ancestors across two levels"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InterfaceTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { interfaceAncestors, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const interfaceType = (apiName: string, extendsInterfaces: ReadonlyArray<string>) => ({
 *   rid: `ri.interface.main.interface.${apiName}`,
 *   apiName,
 *   displayName: apiName,
 *   properties: {},
 *   allProperties: {},
 *   propertiesV2: {},
 *   allPropertiesV2: {},
 *   extendsInterfaces,
 *   allExtendsInterfaces: extendsInterfaces,
 *   implementedByObjectTypes: [],
 *   links: {},
 *   allLinks: {},
 * })
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {},
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: {
 *       Manager: interfaceType("Manager", ["Employee"]),
 *       Employee: interfaceType("Employee", ["Person"]),
 *       Person: interfaceType("Person", []),
 *     },
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * interfaceAncestors(ontology, InterfaceTypeApiName.make("Manager")) // => ["Employee", "Person"]
 * ```
 *
 * @param ontology - The ontology whose interfaces to walk.
 * @param name - API name of the interface whose ancestors are wanted.
 * @returns The ancestors, nearest first, or an empty list when the interface is not defined.
 * @category getters
 * @since 0.0.0
 */
export const interfaceAncestors: {
  (name: InterfaceTypeApiName): (ontology: OntologyDefinition) => ReadonlyArray<InterfaceTypeApiName>;
  (ontology: OntologyDefinition, name: InterfaceTypeApiName): ReadonlyArray<InterfaceTypeApiName>;
} = dual(
  2,
  (ontology: OntologyDefinition, name: InterfaceTypeApiName): ReadonlyArray<InterfaceTypeApiName> =>
    ancestorsIn(interfaceGraph(ontology), name)
);

/**
 * The interfaces an object type says it implements, whichever of its two wire fields says so.
 *
 * **Details**
 *
 * The wire states this twice: as a plain list of names and as the keys of the
 * implementation record. They agree on every payload seen, but nothing forces
 * them to, so a name in either one counts.
 *
 * **Example** (Read the interfaces an object type claims)
 *
 * ```ts import.meta.vitest name="Read the interfaces an object type claims"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectTypeDefinition } from "@beep/scratchpad/osdk/src/ObjectType/index"
 * import { claimedInterfaces } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const employee = await Effect.runPromise(
 *   S.decodeUnknownEffect(ObjectTypeDefinition)({
 *     objectType: {
 *       apiName: "Employee",
 *       displayName: "Employee",
 *       pluralDisplayName: "Employees",
 *       status: "ACTIVE",
 *       icon: { type: "blueprint", color: "blue", name: "person" },
 *       rid: "ri.ontology.main.object-type.employee",
 *       primaryKey: "employeeId",
 *       titleProperty: "employeeId",
 *       properties: { employeeId: { dataType: { type: "integer" }, rid: "ri.ontology.main.property.employee-id" } },
 *     },
 *     linkTypes: [],
 *     implementsInterfaces: ["Person"],
 *     implementsInterfaces2: { Person: { properties: {}, propertiesV2: {}, links: {}, actionTypes: {} } },
 *     sharedPropertyTypeMapping: {},
 *   })
 * )
 * claimedInterfaces(employee) // => ["Person"]
 * ```
 *
 * @param definition - The object type definition to read.
 * @returns The claimed interface names, each once.
 * @category getters
 * @since 0.0.0
 */
export const claimedInterfaces = (definition: ObjectTypeDefinition): ReadonlyArray<InterfaceTypeApiName> =>
  A.dedupe(A.appendAll(definition.implementsInterfaces, R.keys(definition.interfaceImplementations)));

/**
 * The object types that implement an interface: those that claim it, and those that claim an interface extending it.
 *
 * **Details**
 *
 * The answer is read from the object types, not from the list the interface
 * keeps of its implementers (`implementedByObjectTypes`); `validateOntology`
 * compares the two. Implementing an interface implements everything it
 * extends, so claims are followed up {@link interfaceAncestors}.
 *
 * **Example** (Find implementers through an extending interface)
 *
 * ```ts import.meta.vitest name="Find implementers through an extending interface"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InterfaceTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { implementers, OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const interfaceType = (apiName: string, extendsInterfaces: ReadonlyArray<string>) => ({
 *   rid: `ri.interface.main.interface.${apiName}`,
 *   apiName,
 *   displayName: apiName,
 *   properties: {},
 *   allProperties: {},
 *   propertiesV2: {},
 *   allPropertiesV2: {},
 *   extendsInterfaces,
 *   allExtendsInterfaces: extendsInterfaces,
 *   implementedByObjectTypes: [],
 *   links: {},
 *   allLinks: {},
 * })
 * const objectType = (apiName: string, implementsInterfaces: ReadonlyArray<string>) => ({
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
 *   linkTypes: [],
 *   implementsInterfaces,
 *   implementsInterfaces2: {},
 *   sharedPropertyTypeMapping: {},
 * })
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *     objectTypes: {
 *       Contractor: objectType("Contractor", ["Person"]),
 *       Director: objectType("Director", ["Manager"]),
 *       Office: objectType("Office", []),
 *     },
 *     actionTypes: {},
 *     queryTypes: {},
 *     interfaceTypes: { Manager: interfaceType("Manager", ["Person"]), Person: interfaceType("Person", []) },
 *     sharedPropertyTypes: {},
 *     valueTypes: {},
 *   })
 * )
 * const answers = [
 *   implementers(ontology, InterfaceTypeApiName.make("Person")),
 *   implementers(ontology, InterfaceTypeApiName.make("Manager")),
 * ]
 * answers // => [["Contractor", "Director"], ["Director"]]
 * ```
 *
 * @param ontology - The ontology whose object types to search.
 * @param name - API name of the interface.
 * @returns The implementing object types, in the ontology's order.
 * @category getters
 * @since 0.0.0
 */
export const implementers: {
  (name: InterfaceTypeApiName): (ontology: OntologyDefinition) => ReadonlyArray<ObjectTypeApiName>;
  (ontology: OntologyDefinition, name: InterfaceTypeApiName): ReadonlyArray<ObjectTypeApiName>;
} = dual(2, (ontology: OntologyDefinition, name: InterfaceTypeApiName): ReadonlyArray<ObjectTypeApiName> => {
  const graph = interfaceGraph(ontology);
  return pipe(
    R.toEntries(ontology.objectTypes),
    A.filter(([, definition]) =>
      A.some(
        claimedInterfaces(definition),
        (claimed) => claimed === name || A.contains(ancestorsIn(graph, claimed), name)
      )
    ),
    A.map(([objectType]) => objectType)
  );
});

// -----------------------------------------------------------------------------
// API namespaces
// -----------------------------------------------------------------------------

/**
 * Takes a dotted API name apart at its LAST dot: the namespace before it, the name's own part after it.
 *
 * **Details**
 *
 * A namespace may itself contain dots (`com.example`), a local name never
 * does, so only the last dot separates the two. A name without a dot has no
 * namespace. OSDK's authoring helpers split at the same place and keep the
 * trailing dot on the namespace; here the dot belongs to neither part.
 *
 * **Example** (Split a namespaced and a bare name)
 *
 * ```ts import.meta.vitest name="Split a namespaced and a bare name"
 * import * as O from "effect/Option"
 * import { splitApiName } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const namespaced = splitApiName("com.example.Employee")
 * const bare = splitApiName("Employee")
 * const parts = [O.getOrNull(namespaced.namespace), namespaced.localName, O.getOrNull(bare.namespace), bare.localName]
 * parts // => ["com.example", "Employee", null, "Employee"]
 * ```
 *
 * @param apiName - The API name to take apart.
 * @returns The namespace, when the name has one, and the local name.
 * @category destructors
 * @since 0.0.0
 */
export const splitApiName = (apiName: string): ApiNameParts =>
  pipe(
    Str.lastIndexOf(".")(apiName),
    O.match({
      onNone: () => ApiNameParts.make({ localName: apiName }),
      onSome: (at) =>
        ApiNameParts.make({
          namespace: O.liftPredicate(Str.slice(0, at)(apiName), Str.isNonEmpty),
          localName: Str.slice(at + 1)(apiName),
        }),
    })
  );

/**
 * Puts a local API name into a namespace, leaving a name that already has one as it is.
 *
 * **Details**
 *
 * This is the rule the authoring model applies wherever one definition names
 * another: a name with a dot is taken as already qualified. The namespace may
 * be given with or without its trailing dot; the empty namespace qualifies
 * nothing.
 *
 * **Example** (Qualify a local name once)
 *
 * ```ts import.meta.vitest name="Qualify a local name once"
 * import { pipe } from "effect/Function"
 * import { qualifyApiName } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const names = [
 *   qualifyApiName("Employee", "com.example"),
 *   pipe("Employee", qualifyApiName("com.example."), qualifyApiName("org.other")),
 *   qualifyApiName("Employee", ""),
 * ]
 * names // => ["com.example.Employee", "com.example.Employee", "Employee"]
 * ```
 *
 * @param apiName - The API name to qualify.
 * @param namespace - The namespace to put it in, with or without a trailing dot.
 * @returns The qualified name, or `apiName` unchanged when it has a dot already or the namespace is empty.
 * @category combinators
 * @since 0.0.0
 */
export const qualifyApiName: {
  (namespace: string): (apiName: string) => string;
  (apiName: string, namespace: string): string;
} = dual(2, (apiName: string, namespace: string): string =>
  Str.isEmpty(namespace) || Str.includes(".")(apiName)
    ? apiName
    : `${Str.endsWith(".")(namespace) ? namespace : `${namespace}.`}${apiName}`
);
