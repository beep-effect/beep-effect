/**
 * The client's one port, implemented over a world held in memory.
 *
 * **Details**
 *
 * {@link layer} turns a `FauxWorld` and two tables of handlers into an
 * `OntologyTransport`. Reads are answered by the evaluators of
 * `Faux.behavior.ts` from the current world. An action runs the handler
 * registered under its API name, which returns the next world; the world is
 * replaced atomically, so the next read sees the change. A query runs the
 * handler registered under its API name against the current world.
 *
 * Everything the port offers beyond that is refused with a typed `ApiError`:
 * batches of actions, pages of links and attachments. The transport ignores
 * the `OntologyContext`: there is one world, whichever ontology, branch,
 * transaction or scenario a program names.
 *
 * This is a transport for tests and local development, not a model of the
 * platform's performance, permissions or limits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as SynchronizedRef from "effect/SynchronizedRef";
import * as Tuple from "effect/Tuple";
import { ActionValidation, ApplyActionResponse, ObjectEdits } from "../Action/Action.model.ts";
import { ApiError } from "../Client/Client.errors.ts";
import { OntologyTransport } from "../Client/Client.service.ts";
import { ErrorName } from "../Identifier/Identifier.model.ts";
import { OntologyDefinition } from "../Ontology/Ontology.model.ts";
import { ExecuteQueryResponse } from "../Query/Query.model.ts";
import { aggregateObjects, loadObjects } from "./Faux.behavior.ts";
import type * as S from "effect/Schema";
import type { ActionArguments, ApplyActionRequest, ObjectEdit } from "../Action/Action.model.ts";
import type { AggregateObjectSetRequest, LoadObjectsRequest } from "../Client/Client.model.ts";
import type { ActionTypeApiName, ParameterId, QueryApiName } from "../Identifier/Identifier.model.ts";
import type { OntologySelection } from "../Ontology/Ontology.model.ts";
import type { ExecuteQueryRequest } from "../Query/Query.model.ts";
import type { FauxErrorName, FauxWorld } from "./Faux.model.ts";

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

/**
 * What applying an action did: the world after it, and the edits to report to the caller.
 *
 * @category models
 * @since 0.0.0
 */
export interface FauxActionOutcome {
  readonly world: FauxWorld;
  readonly edits: ReadonlyArray<ObjectEdit>;
}

/**
 * The logic of one action type: from the decoded arguments and the current world to the next world and its edits.
 *
 * **Details**
 *
 * A handler that fails leaves the world as it was, and its failure is the
 * failure of the request.
 *
 * @category handlers
 * @since 0.0.0
 */
export type FauxActionHandler = (
  parameters: ActionArguments,
  world: FauxWorld
) => Effect.Effect<FauxActionOutcome, ApiError>;

/**
 * The logic of one query type: from the arguments of a call and the current world to the value the call returns.
 *
 * @category handlers
 * @since 0.0.0
 */
export type FauxQueryHandler = (
  parameters: Readonly<Record<ParameterId, S.Json>>,
  world: FauxWorld
) => Effect.Effect<S.Json, ApiError>;

/**
 * Everything an in-memory transport is made of: the world it starts from and the handlers it can run.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface FauxOptions {
  /** The world the transport starts from. */
  readonly world: FauxWorld;
  /** The handler of every action the transport can apply, by action type API name. */
  readonly actions: Readonly<Record<string, FauxActionHandler>>;
  /** The handler of every query the transport can call, by query API name. */
  readonly queries: Readonly<Record<string, FauxQueryHandler>>;
}

// -----------------------------------------------------------------------------
// Refusals
// -----------------------------------------------------------------------------

const refusal = (
  status: number,
  errorCode: string,
  errorName: FauxErrorName,
  description: string,
  parameters: Readonly<Record<string, S.Json>>
): ApiError =>
  ApiError.make({
    status,
    errorCode,
    errorName: ErrorName.make(errorName),
    errorInstanceId: "faux",
    errorDescription: O.some(description),
    parameters,
  });

const unsupportedRequest = (request: string): ApiError =>
  refusal(400, "INVALID_ARGUMENT", "FauxUnsupportedFeature", `The in-memory transport does not answer ${request}`, {
    feature: `transport.${request}`,
  });

const registered = <Handler>(
  handlers: Readonly<Record<string, Handler>>,
  kind: "action" | "query",
  name: string
): Effect.Effect<Handler, ApiError> =>
  Effect.fromOption(R.get(handlers, name), () =>
    refusal(404, "NOT_FOUND", "FauxUnregisteredHandler", `No handler is registered for the ${kind} "${name}"`, {
      kind,
      name,
    })
  );

// -----------------------------------------------------------------------------
// Answers
// -----------------------------------------------------------------------------

// Object, action, query and interface types are narrowed to the named ones; everything else is returned whole.
const select = (ontology: OntologyDefinition, selection: OntologySelection): OntologyDefinition =>
  OntologyDefinition.make({
    ...ontology,
    objectTypes: R.filter(ontology.objectTypes, (_, name) => A.contains(selection.objectTypes, name)),
    actionTypes: R.filter(ontology.actionTypes, (_, name) => A.contains(selection.actionTypes, name)),
    queryTypes: R.filter(ontology.queryTypes, (_, name) => A.contains(selection.queryTypes, name)),
    interfaceTypes: R.filter(ontology.interfaceTypes, (_, name) => A.contains(selection.interfaceTypes, name)),
  });

const valid = ActionValidation.make({ result: "valid", submissionCriteria: A.empty(), parameters: R.empty() });

const countOf = (edits: ReadonlyArray<ObjectEdit>, kind: ObjectEdit["type"]): number =>
  A.filter(edits, (edit) => edit.type === kind).length;

const reportOf = (edits: ReadonlyArray<ObjectEdit>): ObjectEdits =>
  ObjectEdits.make({
    edits,
    addedObjectCount: countOf(edits, "addObject"),
    modifiedObjectsCount: countOf(edits, "modifyObject"),
    deletedObjectsCount: countOf(edits, "deleteObject"),
    addedLinksCount: countOf(edits, "addLink"),
    deletedLinksCount: countOf(edits, "deleteLink"),
  });

// -----------------------------------------------------------------------------
// The transport
// -----------------------------------------------------------------------------

/**
 * An `OntologyTransport` that answers from a world held in memory.
 *
 * **Details**
 *
 * `loadOntology`, `loadObjects` and `aggregate` read the current world. A
 * page of objects leaves as the platform would send it, every object written
 * as its flat wire record, so a read decodes it exactly as it decodes a page
 * that came over HTTP.
 * `applyAction` runs the handler registered for the action and replaces the
 * world with the one it returns; with the `validateOnly` mode it reports the
 * action as valid without running it, and it lists the handler's edits unless
 * the request asks for none. `validateAction` reports every registered action
 * as valid. `executeQuery` runs the handler registered for the query, whatever
 * version the call names. An action or query without a handler fails with
 * `FauxUnregisteredHandler`.
 *
 * `applyActionBatch`, `loadLinks`, `uploadAttachment` and `readAttachment`
 * fail with `FauxUnsupportedFeature`.
 *
 * Every layer built from the same options starts from the same world; a world
 * changed by actions lives as long as the layer.
 *
 * **Example** (Query a world, change it with an action, and query it again)
 *
 * ```ts import.meta.vitest name="Query a world, change it with an action, and query it again"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import { AddedObject, ApplyActionRequest } from "@beep/scratchpad/osdk/src/Action/index"
 * import { count, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import { addObject, FauxWorld, layer } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { ActionTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { OntologyObject } from "@beep/scratchpad/osdk/src/Object/index"
 * import { objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const world = await Effect.runPromise(
 *   S.decodeUnknownEffect(FauxWorld)({
 *     ontology: {
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {
 *         Office: {
 *           objectType: {
 *             apiName: "Office",
 *             displayName: "Office",
 *             pluralDisplayName: "Offices",
 *             icon: { type: "blueprint", color: "blue", name: "office" },
 *             primaryKey: "officeId",
 *             titleProperty: "officeId",
 *             properties: { officeId: { dataType: { type: "string" }, rid: "ri.property.officeId" } },
 *             rid: "ri.ontology.main.object-type.office",
 *             status: "ACTIVE",
 *           },
 *           linkTypes: [],
 *           implementsInterfaces: [],
 *           implementsInterfaces2: {},
 *           sharedPropertyTypeMapping: {},
 *         },
 *       },
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes: {},
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     },
 *     objects: [{ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC" }],
 *   })
 * )
 * const london = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyObject)({ __apiName: "Office", __primaryKey: "LDN", officeId: "LDN" })
 * )
 * const Faux = layer({
 *   world,
 *   actions: {
 *     openLondon: (_, current) =>
 *       Effect.succeed({
 *         world: addObject(current, london),
 *         edits: [AddedObject.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "LDN" })],
 *       }),
 *   },
 *   queries: {},
 * })
 * const program = Effect.gen(function* () {
 *   const before = yield* count(objectType("Office"))
 *   const transport = yield* OntologyTransport
 *   yield* transport.applyAction(ActionTypeApiName.make("openLondon"), ApplyActionRequest.make({ parameters: {} }))
 *   const after = yield* count(objectType("Office"))
 *   return [before, after]
 * })
 * const counts = await Effect.runPromise(
 *   Effect.scoped(Effect.flatMap(Layer.build(Faux), (context) => Effect.provide(program, context)))
 * )
 * counts // => [1, 2]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (options: FauxOptions): Layer.Layer<OntologyTransport> =>
  Layer.effect(OntologyTransport)(
    Effect.map(SynchronizedRef.make(options.world), (state) =>
      OntologyTransport.of({
        loadOntology: Effect.fn("Faux.loadOntology")(function* (selection: O.Option<OntologySelection>) {
          const { ontology } = yield* SynchronizedRef.get(state);
          return O.match(selection, {
            onNone: () => ontology,
            onSome: (chosen) => select(ontology, chosen),
          });
        }),
        loadObjects: Effect.fn("Faux.loadObjects")(function* (request: LoadObjectsRequest) {
          const world = yield* SynchronizedRef.get(state);
          return yield* loadObjects(world, request);
        }),
        loadLinks: Effect.fn("Faux.loadLinks")(() => Effect.fail(unsupportedRequest("loadLinks"))),
        aggregate: Effect.fn("Faux.aggregate")(function* (request: AggregateObjectSetRequest) {
          const world = yield* SynchronizedRef.get(state);
          return yield* aggregateObjects(world, request);
        }),
        applyAction: Effect.fn("Faux.applyAction")(function* (action: ActionTypeApiName, request: ApplyActionRequest) {
          const handler = yield* registered(options.actions, "action", action);
          if (request.options.mode === "validateOnly") {
            return ApplyActionResponse.make({ validation: O.some(valid) });
          }
          const edits = yield* SynchronizedRef.modifyEffect(state, (world) =>
            Effect.map(handler(request.parameters, world), (outcome) => Tuple.make(outcome.edits, outcome.world))
          );
          return ApplyActionResponse.make({
            validation: O.some(valid),
            edits: request.options.returnEdits === "none" ? O.none() : O.some(reportOf(edits)),
          });
        }),
        validateAction: Effect.fn("Faux.validateAction")(function* (action: ActionTypeApiName) {
          yield* registered(options.actions, "action", action);
          return valid;
        }),
        applyActionBatch: Effect.fn("Faux.applyActionBatch")(() => Effect.fail(unsupportedRequest("applyActionBatch"))),
        executeQuery: Effect.fn("Faux.executeQuery")(function* (query: QueryApiName, request: ExecuteQueryRequest) {
          const handler = yield* registered(options.queries, "query", query);
          const world = yield* SynchronizedRef.get(state);
          const value = yield* handler(request.parameters, world);
          return ExecuteQueryResponse.make({ value });
        }),
        uploadAttachment: Effect.fn("Faux.uploadAttachment")(() => Effect.fail(unsupportedRequest("uploadAttachment"))),
        readAttachment: Effect.fn("Faux.readAttachment")(() => Effect.fail(unsupportedRequest("readAttachment"))),
      })
    )
  );
