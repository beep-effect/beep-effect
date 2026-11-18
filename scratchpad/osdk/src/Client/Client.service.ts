/**
 * The two services a client is made of: the one port to the platform, and the scope requests are sent in.
 *
 * **Details**
 *
 * OSDK's `MinimalClient` is a bag that holds a base URL, a `fetch`, a token
 * provider, an ontology RID, a branch, a transaction, a scenario, a metadata
 * cache and three factories, and every function of the client reaches into
 * it. Here that bag is two contracts.
 *
 * {@link OntologyTransport} is everything the platform can be asked, one
 * member per request, in the domain types the other concepts define. It says
 * nothing about HTTP: an implementation over `effect/http` and one over an
 * in-memory ontology satisfy the same contract, and everything above it (the
 * typed facade in `Client.behavior.ts`) is written once against it.
 *
 * {@link OntologyContext} is the answer to "which ontology, on which branch,
 * inside which transaction or scenario". A transport implementation reads it;
 * callers swap it to point the same program somewhere else.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type {
  ActionArguments,
  ActionValidation,
  ApplyActionRequest,
  ApplyActionResponse,
  BatchApplyActionRequest,
  BatchApplyActionResponse,
} from "../Action/Action.model.ts";
import type { AggregateResponse } from "../Aggregation/Aggregation.model.ts";
import type { AttachmentMetadata, AttachmentUpload } from "../Attachment/Attachment.model.ts";
import type {
  ActionTypeApiName,
  AttachmentRid,
  FunctionVersion,
  QueryApiName,
} from "../Identifier/Identifier.model.ts";
import type { LinkPage, LoadLinksRequest } from "../Link/Link.model.ts";
import type { OntologyDefinition, OntologyInclusions, OntologySelection } from "../Ontology/Ontology.model.ts";
import type { ExecuteQueryRequest, ExecuteQueryResponse } from "../Query/Query.model.ts";
import type { TransportFailure } from "./Client.errors.ts";
import type {
  AggregateObjectSetRequest,
  LoadObjectsRequest,
  LoadObjectsResponse,
  OntologyScope,
} from "./Client.model.ts";

const $I = $ScratchpadId.create("osdk/Client/Client.service");

/**
 * The one port to the platform: every request a client can make, in domain types.
 *
 * **Details**
 *
 * Each member takes the decoded request and returns the decoded answer.
 * Encoding the request, sending it, and decoding the answer or the error body
 * are the implementation's job, which is why every member can fail with any
 * `TransportFailure`: an `ApiError` when the platform answers with an error, a
 * `TransportError` when it does not answer, a `DecodeError` when a body does
 * not match its schema.
 *
 * One answer is decoded only as far as a transport can decode it. A page of
 * objects comes back with its envelope read and its rows as the flat wire
 * records the platform sent (`ObjectRecord`): what a property holds is known
 * to the reader's codec, not to the port, so a row is read once, by the read
 * facade, with the codec of the set that was asked for.
 *
 * Which ontology, branch, transaction and scenario a request addresses is not
 * a parameter. An implementation takes it from {@link OntologyContext}.
 *
 * **Example** (Answer a load request from a canned page)
 *
 * ```ts import.meta.vitest name="Answer a load request from a canned page"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import { LoadObjectsRequest, LoadObjectsResponse, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { BaseObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Canned = Layer.mock(OntologyTransport, {
 *   loadObjects: () =>
 *     Effect.orDie(
 *       S.decodeUnknownEffect(LoadObjectsResponse)({
 *         data: [{ __apiName: "Office", __primaryKey: "NYC" }],
 *         totalCount: "1",
 *         propertySecurities: [],
 *       })
 *     ),
 * })
 * const program = Effect.gen(function* () {
 *   const transport = yield* OntologyTransport
 *   const offices = BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Office") })
 *   const page = yield* transport.loadObjects(LoadObjectsRequest.make({ objectSet: offices }))
 *   return page.data
 * })
 * const rows = await Effect.runPromise(
 *   Effect.scoped(Effect.flatMap(Layer.build(Canned), (context) => Effect.provide(program, context)))
 * )
 * rows // => [{ __apiName: "Office", __primaryKey: "NYC" }]
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class OntologyTransport extends Context.Service<
  OntologyTransport,
  {
    /**
     * Loads the definition of the ontology: every type when `selection` is none, or only the types it names.
     * `inclusions` says what a read of every type brings along (action logic rules, datasources) and is not
     * read when a selection is given, which states its own.
     */
    readonly loadOntology: (
      selection: O.Option<OntologySelection>,
      inclusions?: OntologyInclusions
    ) => Effect.Effect<OntologyDefinition, TransportFailure>;
    /**
     * Loads one page of the objects of an object set. Each row is the flat wire record, not yet read.
     */
    readonly loadObjects: (request: LoadObjectsRequest) => Effect.Effect<LoadObjectsResponse, TransportFailure>;
    /**
     * Loads one page of the links that leave the objects of an object set.
     */
    readonly loadLinks: (request: LoadLinksRequest) => Effect.Effect<LinkPage, TransportFailure>;
    /**
     * Computes metrics over the objects of an object set, optionally per group.
     */
    readonly aggregate: (request: AggregateObjectSetRequest) => Effect.Effect<AggregateResponse, TransportFailure>;
    /**
     * Applies one action, in the mode and with the edit reporting the request's options ask for.
     */
    readonly applyAction: (
      action: ActionTypeApiName,
      request: ApplyActionRequest
    ) => Effect.Effect<ApplyActionResponse, TransportFailure>;
    /**
     * Validates one application of an action without executing it.
     */
    readonly validateAction: (
      action: ActionTypeApiName,
      parameters: ActionArguments
    ) => Effect.Effect<ActionValidation, TransportFailure>;
    /**
     * Applies the same action several times in one request, each time with its own arguments.
     */
    readonly applyActionBatch: (
      action: ActionTypeApiName,
      request: BatchApplyActionRequest
    ) => Effect.Effect<BatchApplyActionResponse, TransportFailure>;
    /**
     * Calls a query at the given version, or at its latest version when `version` is none.
     */
    readonly executeQuery: (
      query: QueryApiName,
      request: ExecuteQueryRequest,
      version: O.Option<FunctionVersion>
    ) => Effect.Effect<ExecuteQueryResponse, TransportFailure>;
    /**
     * Uploads a file so that an attachment property or action parameter can refer to it.
     */
    readonly uploadAttachment: (
      upload: AttachmentUpload,
      content: Uint8Array
    ) => Effect.Effect<AttachmentMetadata, TransportFailure>;
    /**
     * Reads the content of an uploaded attachment.
     */
    readonly readAttachment: (attachment: AttachmentRid) => Effect.Effect<Uint8Array, TransportFailure>;
  }
>()($I`OntologyTransport`) {}

/**
 * Where requests land: which ontology, and optionally which branch, transaction and scenario.
 *
 * **Details**
 *
 * The service is a value, an `OntologyScope`. Provide a different one to run
 * the same program against another ontology or on a branch; nothing else in a
 * program names them.
 *
 * **Example** (Read the scope a program runs in)
 *
 * ```ts import.meta.vitest name="Read the scope a program runs in"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { OntologyContext, OntologyScope } from "@beep/scratchpad/osdk/src/Client/index"
 * import { OntologyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const scope = OntologyScope.make({ ontology: OntologyApiName.make("default-ontology") })
 * const describe = Effect.map(OntologyContext, ({ ontology, branch }) => [ontology, O.isNone(branch)])
 * const facts = await Effect.runPromise(Effect.provideService(describe, OntologyContext, scope))
 * facts // => ["default-ontology", true]
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyContext extends Context.Service<OntologyContext, OntologyScope>()($I`OntologyContext`) {}
