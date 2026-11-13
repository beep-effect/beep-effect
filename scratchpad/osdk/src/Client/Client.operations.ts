/**
 * The typed facade for actions and queries: calls that take a model and typed arguments.
 *
 * **Details**
 *
 * The transport applies an action from a record of JSON arguments and answers
 * a query call with JSON, because the wire does not say what an argument or a
 * result holds. A typed model does. The functions here put the two together:
 * they write the arguments with the model's codec, send them through
 * `OntologyTransport`, and read what comes back with the model's codec. A
 * value that does not fit, on the way out or on the way in, is a
 * `DecodeError`, never a defect; an `ApiError` or a `TransportError` of the
 * transport passes through unchanged.
 *
 * OSDK's counterparts are `client(action).applyAction(args, options)`, whose
 * return type is computed from the options with a conditional type, and
 * `client(query).executeFunction(args)`. Here what an applied action returns
 * is chosen by the function that is called: {@link applyAction} returns
 * nothing, {@link applyActionWithEdits} returns the edits. An application the
 * platform reports invalid fails with `ActionRejected`, which is declared with
 * the client's other errors in `Client.errors.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ActionArguments, ApplyActionOptions, ApplyActionRequest } from "../Action/Action.model.ts";
import { ActionTypeApiName, FunctionVersion, QueryApiName } from "../Identifier/Identifier.model.ts";
import { ExecuteQueryRequest } from "../Query/Query.model.ts";
import { ActionRejected, DecodeError } from "./Client.errors.ts";
import { OntologyTransport } from "./Client.service.ts";
import type { ReturnEditsMode } from "../Action/Action.values.ts";

// -----------------------------------------------------------------------------
// Models
// -----------------------------------------------------------------------------

/**
 * What the facade needs of a typed action: the name of its action type and the codec of its arguments.
 *
 * **Details**
 *
 * A model built with `Model.action` satisfies this. The codec writes the
 * `parameters` record of a request, so its encoded side is that record.
 *
 * @typeParam Arguments - The codec of the argument record.
 * @category models
 * @since 0.0.0
 */
export interface ActionModel<Arguments extends S.Top = S.Top> {
  readonly apiName: string;
  readonly Arguments: Arguments;
}

/**
 * What the facade needs of a typed query: its name, the version it pins and the codecs of its two ends.
 *
 * **Details**
 *
 * A model built with `Model.query` satisfies this. `version` none runs the
 * latest version of the function.
 *
 * @typeParam Parameters - The codec of the parameter record.
 * @typeParam Output - The codec of what a call returns.
 * @category models
 * @since 0.0.0
 */
export interface QueryModel<Parameters extends S.Top = S.Top, Output extends S.Top = S.Top> {
  readonly apiName: string;
  readonly version: O.Option<string>;
  readonly Parameters: Parameters;
  readonly Output: Output;
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

const decodeFailure = (cause: S.SchemaError): DecodeError => DecodeError.make({ message: cause.message, cause });

const decodeActionName = S.decodeEffect(ActionTypeApiName);
const decodeQueryName = S.decodeEffect(QueryApiName);
const decodeVersion = S.decodeEffect(S.Option(FunctionVersion));
const decodeActionArguments = S.decodeUnknownEffect(ActionArguments);
const decodeQueryRequest = S.decodeUnknownEffect(ExecuteQueryRequest);

// The typed arguments are written by the model's codec, then read as the request arguments the
// transport takes. A value the codec refuses, or a name that is not one, fails before anything is sent.
const actionRequest = Effect.fnUntraced(function* <Arguments extends S.Top>(
  action: ActionModel<Arguments>,
  args: Arguments["Type"]
) {
  const name = yield* decodeActionName(action.apiName);
  const wire = yield* S.encodeEffect(action.Arguments)(args);
  const parameters = yield* decodeActionArguments(wire);
  return { name, parameters };
}, Effect.mapError(decodeFailure));

const apply = Effect.fnUntraced(function* <Arguments extends S.Top>(
  action: ActionModel<Arguments>,
  args: Arguments["Type"],
  returnEdits: ReturnEditsMode
) {
  const transport = yield* OntologyTransport;
  const { name, parameters } = yield* actionRequest(action, args);
  const response = yield* transport.applyAction(
    name,
    ApplyActionRequest.make({ parameters, options: ApplyActionOptions.make({ returnEdits }) })
  );
  // An answer that reports the action invalid means nothing ran, whatever the status of the answer.
  const refused = O.filter(response.validation, (validation) => validation.result === "invalid");
  return yield* O.match(refused, {
    onNone: () => Effect.succeed(response),
    onSome: (validation) => Effect.fail(ActionRejected.make({ action: name, validation })),
  });
});

const applyActionImpl = Effect.fn("Client.applyAction")(function* <Arguments extends S.Top>(
  args: Arguments["Type"],
  action: ActionModel<Arguments>
) {
  yield* apply(action, args, "none");
});

/**
 * Applies an action with typed arguments and returns nothing.
 *
 * **Details**
 *
 * The arguments are written with the model's `Arguments` codec, so each one
 * reaches the platform in its documented spelling and an optional parameter
 * keeps its three intents: key absent leaves it untouched, `Option.none()`
 * clears it, `Option.some(value)` sets it. The request asks for no edits.
 *
 * It fails with `ActionRejected` when the platform reports the action
 * invalid, and with a `DecodeError` when the arguments do not fit the model's
 * codec or the model's API name is empty.
 *
 * The arguments are the data and the model says how to send them, so the
 * curried form names the model first, `applyAction(Rename)(args)`, and the
 * compiler checks the arguments against it in both forms.
 *
 * **Example** (Apply a typed action)
 *
 * ```ts import.meta.vitest name="Apply a typed action"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import { ApplyActionRequest, ApplyActionResponse } from "@beep/scratchpad/osdk/src/Action/index"
 * import { applyAction, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Rename = Model.action({
 *   apiName: "renameOffice",
 *   parameters: { officeId: Model.requiredParameter(Model.string), name: Model.optionalParameter(Model.string) },
 * })
 * const sent: Array<unknown> = []
 * const Recording = Layer.mock(OntologyTransport, {
 *   applyAction: (action, request) =>
 *     Effect.map(S.encodeEffect(ApplyActionRequest)(request), (wire) => {
 *       sent.push([action, wire.parameters])
 *       return ApplyActionResponse.make({})
 *     }).pipe(Effect.orDie),
 * })
 * await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Recording), (context) =>
 *       Effect.provide(applyAction(Rename)({ officeId: "NYC" }), context)
 *     )
 *   )
 * )
 * sent // => [["renameOffice", { officeId: "NYC" }]]
 * ```
 *
 * @param args - The arguments of this application.
 * @param action - The typed action model.
 * @category commands
 * @since 0.0.0
 */
export const applyAction: {
  <Arguments extends S.Top>(
    action: ActionModel<Arguments>
  ): (args: Arguments["Type"]) => ReturnType<typeof applyActionImpl<Arguments>>;
  <Arguments extends S.Top>(
    args: Arguments["Type"],
    action: ActionModel<Arguments>
  ): ReturnType<typeof applyActionImpl<Arguments>>;
} = dual(2, applyActionImpl);

const applyActionWithEditsImpl = Effect.fn("Client.applyActionWithEdits")(function* <Arguments extends S.Top>(
  args: Arguments["Type"],
  action: ActionModel<Arguments>
) {
  const response = yield* apply(action, args, "allV2WithDeletions");
  return yield* Effect.fromOption(response.edits, () =>
    DecodeError.make({ message: "The answer to an applied action holds no edits", cause: response })
  );
});

/**
 * Applies an action with typed arguments and returns what it changed.
 *
 * **Details**
 *
 * The request asks for every edit, deletions included. The result is an
 * `ActionEdits`: the list of edits with their counts, or only the edited
 * object types when there are too many to list. An answer without edits fails
 * with a `DecodeError`; everything else is as for {@link applyAction}.
 *
 * **Example** (Read the edits of an applied action)
 *
 * ```ts import.meta.vitest name="Read the edits of an applied action"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import { ActionEdits, ApplyActionResponse } from "@beep/scratchpad/osdk/src/Action/index"
 * import { applyActionWithEdits, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Open = Model.action({
 *   apiName: "openOffice",
 *   parameters: { officeId: Model.requiredParameter(Model.string) },
 * })
 * const Canned = Layer.mock(OntologyTransport, {
 *   applyAction: () =>
 *     Effect.orDie(
 *       S.decodeUnknownEffect(ApplyActionResponse)({
 *         edits: {
 *           type: "edits",
 *           edits: [{ type: "addObject", objectType: "Office", primaryKey: "LDN" }],
 *           addedObjectCount: 1,
 *           modifiedObjectsCount: 0,
 *           deletedObjectsCount: 0,
 *           addedLinksCount: 0,
 *           deletedLinksCount: 0,
 *         },
 *       })
 *     ),
 * })
 * const edits = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(applyActionWithEdits(Open)({ officeId: "LDN" }), context)
 *     )
 *   )
 * )
 * const added = ActionEdits.match(edits, {
 *   edits: ({ addedObjectCount }) => addedObjectCount,
 *   largeScaleEdits: () => -1,
 * })
 * added // => 1
 * ```
 *
 * @param args - The arguments of this application.
 * @param action - The typed action model.
 * @category commands
 * @since 0.0.0
 */
export const applyActionWithEdits: {
  <Arguments extends S.Top>(
    action: ActionModel<Arguments>
  ): (args: Arguments["Type"]) => ReturnType<typeof applyActionWithEditsImpl<Arguments>>;
  <Arguments extends S.Top>(
    args: Arguments["Type"],
    action: ActionModel<Arguments>
  ): ReturnType<typeof applyActionWithEditsImpl<Arguments>>;
} = dual(2, applyActionWithEditsImpl);

const validateActionImpl = Effect.fn("Client.validateAction")(function* <Arguments extends S.Top>(
  args: Arguments["Type"],
  action: ActionModel<Arguments>
) {
  const transport = yield* OntologyTransport;
  const { name, parameters } = yield* actionRequest(action, args);
  return yield* transport.validateAction(name, parameters);
});

/**
 * Validates one application of an action with typed arguments, without executing it.
 *
 * **Details**
 *
 * The result is the platform's validation report: an overall verdict, the
 * submission criteria and the evaluation of every parameter. An `invalid`
 * verdict is a value here, not a failure: asking is the point of the call.
 *
 * **Example** (Ask whether an application would be accepted)
 *
 * ```ts import.meta.vitest name="Ask whether an application would be accepted"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import { ActionValidation } from "@beep/scratchpad/osdk/src/Action/index"
 * import { OntologyTransport, validateAction } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Resize = Model.action({
 *   apiName: "resizeOffice",
 *   parameters: { officeId: Model.requiredParameter(Model.string), capacity: Model.requiredParameter(Model.integer) },
 * })
 * const Canned = Layer.mock(OntologyTransport, {
 *   validateAction: () =>
 *     Effect.orDie(
 *       S.decodeUnknownEffect(ActionValidation)({
 *         result: "INVALID",
 *         submissionCriteria: [],
 *         parameters: {
 *           capacity: { result: "INVALID", evaluatedConstraints: [{ type: "range", gte: 1 }], required: true },
 *         },
 *       })
 *     ),
 * })
 * const validation = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(validateAction(Resize)({ officeId: "NYC", capacity: 0 }), context)
 *     )
 *   )
 * )
 * validation.result // => "invalid"
 * ```
 *
 * @param args - The arguments to validate.
 * @param action - The typed action model.
 * @category queries
 * @since 0.0.0
 */
export const validateAction: {
  <Arguments extends S.Top>(
    action: ActionModel<Arguments>
  ): (args: Arguments["Type"]) => ReturnType<typeof validateActionImpl<Arguments>>;
  <Arguments extends S.Top>(
    args: Arguments["Type"],
    action: ActionModel<Arguments>
  ): ReturnType<typeof validateActionImpl<Arguments>>;
} = dual(2, validateActionImpl);

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

const queryRequest = Effect.fnUntraced(function* <Parameters extends S.Top, Output extends S.Top>(
  query: QueryModel<Parameters, Output>,
  parameters: Parameters["Type"]
) {
  const name = yield* decodeQueryName(query.apiName);
  const version = yield* decodeVersion(query.version);
  const wire = yield* S.encodeEffect(query.Parameters)(parameters);
  const request = yield* decodeQueryRequest({ parameters: wire });
  return { name, version, request };
}, Effect.mapError(decodeFailure));

const executeQueryImpl = Effect.fn("Client.executeQuery")(function* <Parameters extends S.Top, Output extends S.Top>(
  parameters: Parameters["Type"],
  query: QueryModel<Parameters, Output>
) {
  const transport = yield* OntologyTransport;
  const { name, version, request } = yield* queryRequest(query, parameters);
  const response = yield* transport.executeQuery(name, request, version);
  return yield* Effect.mapError(S.decodeEffect(query.Output)(response.value), decodeFailure);
});

/**
 * Calls a query with typed parameters and returns its typed output.
 *
 * **Details**
 *
 * The parameters are written with the model's `Parameters` codec and the
 * answer is read with its `Output` codec, so a returned set is a `HashSet`, a
 * map a `HashMap` and a nullable value an `Option`. The call runs the version
 * the model pins, or the latest when it pins none.
 *
 * It fails with a `DecodeError` when the parameters do not fit the model's
 * codec, when the model's name or version is malformed, or when the answer
 * does not fit the output codec.
 *
 * **Example** (Call a typed query)
 *
 * ```ts import.meta.vitest name="Call a typed query"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import { executeQuery, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { ExecuteQueryResponse } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const TitlesIn = Model.query({
 *   apiName: "titlesIn",
 *   version: O.none(),
 *   parameters: { officeId: Model.requiredParameter(Model.string) },
 *   output: Model.setOf(Model.string),
 * })
 * const Canned = Layer.mock(OntologyTransport, {
 *   executeQuery: () => Effect.succeed(ExecuteQueryResponse.make({ value: ["Director", "Engineer", "Director"] })),
 * })
 * const titles = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(executeQuery(TitlesIn)({ officeId: "NYC" }), context)
 *     )
 *   )
 * )
 * const facts = [HashSet.size(titles), HashSet.has(titles, "Engineer")]
 * facts // => [2, true]
 * ```
 *
 * @param parameters - The arguments of this call.
 * @param query - The typed query model.
 * @category queries
 * @since 0.0.0
 */
export const executeQuery: {
  <Parameters extends S.Top, Output extends S.Top>(
    query: QueryModel<Parameters, Output>
  ): (parameters: Parameters["Type"]) => ReturnType<typeof executeQueryImpl<Parameters, Output>>;
  <Parameters extends S.Top, Output extends S.Top>(
    parameters: Parameters["Type"],
    query: QueryModel<Parameters, Output>
  ): ReturnType<typeof executeQueryImpl<Parameters, Output>>;
} = dual(2, executeQueryImpl);
