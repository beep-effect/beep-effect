/**
 * The platform's ontology routes, declared as data: one HTTP API value that carries this library's schemas.
 *
 * **Details**
 *
 * OSDK reaches the platform through a generated client in which every route is
 * a tuple (`[method, path, flags]`) and a function with positional arguments.
 * Here the same routes are one `HttpApi` value: each endpoint names its method
 * and path and carries the schemas of its path parameters, query parameters,
 * request body and answer. A client, a server and an OpenAPI document can all
 * be derived from that one value, and none of them repeats a path.
 *
 * Every path, method and query parameter below was copied from the generated
 * client `@osdk/foundry.ontologies@2.87.0`, directory `build/esm/v2/public/`.
 * The tuple's first element is the method (`0` is `GET`, `1` is `POST`), and
 * `{0}`, `{1}` are the path arguments in order.
 *
 * | Endpoint | Tuple in the generated client | Source file | Query parameters declared |
 * | --- | --- | --- | --- |
 * | `ontologies.getFullMetadata` | `[0, "/v2/ontologies/{0}/fullMetadata", 2]` | `OntologyV2.js` | `branch`, `includeActionTypeFullMetadata`, `includeDatasources` |
 * | `ontologies.loadMetadata` | `[1, "/v2/ontologies/{0}/metadata", 3]` | `OntologyV2.js` | `branch`, `preview` |
 * | `objectSets.load` | `[1, "/v2/ontologies/{0}/objectSets/loadObjects", 7]` | `OntologyObjectSet.js` | `branch`, `transactionId`, `scenarioRid` |
 * | `objectSets.aggregate` | `[1, "/v2/ontologies/{0}/objectSets/aggregate", 7]` | `OntologyObjectSet.js` | `branch`, `transactionId`, `scenarioRid` |
 * | `objectSets.loadLinks` | `[1, "/v2/ontologies/{0}/objectSets/loadLinks", 7]` | `OntologyObjectSet.js` | `branch`, `preview` |
 * | `actions.apply` | `[1, "/v2/ontologies/{0}/actions/{1}/apply", 7]` | `Action.js` | `branch`, `transactionId`, `scenarioRid` |
 * | `actions.applyBatch` | `[1, "/v2/ontologies/{0}/actions/{1}/applyBatch", 3]` | `Action.js` | `branch`, `scenarioRid` |
 * | `queries.execute` | `[1, "/v2/ontologies/{0}/queries/{1}/execute", 7]` | `Query.js` | `version`, `branch`, `transactionId`, `scenarioRid` |
 * | `attachments.upload` | `[1, "/v2/ontologies/attachments/upload", 7, "*\/*"]` | `Attachment.js` | `filename` |
 * | `attachments.read` | `[0, "/v2/ontologies/attachments/{0}/content",,, "*\/*"]` | `Attachment.js` | none |
 *
 * The query parameters of each route are the ones its declaration file
 * (`OntologyV2.d.ts`, `OntologyObjectSet.d.ts`, `Action.d.ts`, `Query.d.ts`,
 * `Attachment.d.ts`) lists and a client scope can fill. The wire has no route
 * that only validates an action: validation is `actions.apply` with
 * `options.mode` set to `VALIDATE_ONLY`.
 *
 * **Gotchas**
 *
 * Three routes are marked `@alpha` in the generated client
 * (`getFullMetadata`, `loadMetadata`, `loadLinks`). OSDK calls two of them,
 * `loadMetadata` and `loadLinks`, with `preview=true`, the switch the platform
 * asks for on routes it has not declared stable, so `preview` is declared on
 * exactly those two. OSDK calls `getFullMetadata` without it, and so does a
 * client derived from this declaration.
 *
 * Left out on purpose: `sdkPackageRid` and `sdkVersion` (a scope names no SDK
 * package), `executeInMemoryOnly`, the `preview` parameter of
 * `getFullMetadata` (OSDK does not send it), and the `attribution`,
 * `traceParent` and `traceState` headers.
 *
 * `applyBatch` takes no `transactionId` and `loadLinks` takes neither
 * `transactionId` nor `scenarioRid`: the wire does not accept them there.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as S from "effect/Schema";
import {
  ApplyActionRequest,
  ApplyActionResponse,
  BatchApplyActionRequest,
  BatchApplyActionResponse,
} from "../Action/Action.model.ts";
import { AggregateResponse } from "../Aggregation/Aggregation.model.ts";
import { AttachmentMetadata, AttachmentUpload } from "../Attachment/Attachment.model.ts";
import { ApiErrorBody } from "../Client/Client.errors.ts";
import { AggregateObjectSetRequest, LoadObjectsRequest, LoadObjectsResponse } from "../Client/Client.model.ts";
import {
  ActionTypeApiName,
  AttachmentRid,
  FoundryBranch,
  FunctionVersion,
  OntologyIdentifier,
  OntologyScenarioRid,
  OntologyTransactionId,
  QueryApiName,
} from "../Identifier/Identifier.model.ts";
import { LinkPage, LoadLinksRequest } from "../Link/Link.model.ts";
import { OntologyDefinition, OntologySelection } from "../Ontology/Ontology.model.ts";
import { ExecuteQueryRequest, ExecuteQueryResponse } from "../Query/Query.model.ts";

// -----------------------------------------------------------------------------
// Parameters shared by the routes
// -----------------------------------------------------------------------------

// `{ontology}` of every route under `/v2/ontologies/{ontology}`: an API name or a resource identifier.
const ontology = OntologyIdentifier.annotateKey({
  description: "The ontology the request addresses, by API name or resource identifier.",
});

// The query parameters that place a request inside an ontology. An absent parameter means the
// default branch, no open transaction and no scenario.
const branch = S.OptionFromOptionalKey(FoundryBranch).annotateKey({
  description: "Branch to read from and write to; the default branch when absent.",
});
const transactionId = S.OptionFromOptionalKey(OntologyTransactionId).annotateKey({
  description: "Open transaction whose uncommitted edits the request sees and extends.",
});
const scenarioRid = S.OptionFromOptionalKey(OntologyScenarioRid).annotateKey({
  description: "Scenario whose hypothetical edits the request sees and extends.",
});

// The switch the platform asks for on routes it has not declared stable.
const preview = S.OptionFromOptionalKey(S.Boolean).annotateKey({
  description: "Whether the caller accepts a route that may still change.",
});

// What a read of the whole ontology brings along besides the types themselves. Absent leaves it to the platform.
const includeActionTypeFullMetadata = S.OptionFromOptionalKey(S.Boolean).annotateKey({
  description: "Whether each action type comes with its logic rules as well.",
});
const includeDatasources = S.OptionFromOptionalKey(S.Boolean).annotateKey({
  description: "Whether each object type comes with the datasources behind it that the caller may see.",
});

// The bytes of a file, sent and received as they are.
const FileContent = S.Uint8Array.pipe(HttpApiSchema.asUint8Array());

// -----------------------------------------------------------------------------
// Groups
// -----------------------------------------------------------------------------

// Source: OntologyV2.js / OntologyV2.d.ts
const Ontologies = HttpApiGroup.make("ontologies").add(
  // const _getFullMetadata = [0, "/v2/ontologies/{0}/fullMetadata", 2];
  HttpApiEndpoint.get("getFullMetadata", "/v2/ontologies/:ontology/fullMetadata", {
    params: { ontology },
    query: { branch, includeActionTypeFullMetadata, includeDatasources },
    success: OntologyDefinition,
    error: ApiErrorBody,
  }),
  // const _loadMetadata = [1, "/v2/ontologies/{0}/metadata", 3];
  HttpApiEndpoint.post("loadMetadata", "/v2/ontologies/:ontology/metadata", {
    params: { ontology },
    query: { branch, preview },
    payload: OntologySelection,
    success: OntologyDefinition,
    error: ApiErrorBody,
  })
);

// Source: OntologyObjectSet.js / OntologyObjectSet.d.ts
const ObjectSets = HttpApiGroup.make("objectSets").add(
  // const _load = [1, "/v2/ontologies/{0}/objectSets/loadObjects", 7];
  HttpApiEndpoint.post("load", "/v2/ontologies/:ontology/objectSets/loadObjects", {
    params: { ontology },
    query: { branch, transactionId, scenarioRid },
    payload: LoadObjectsRequest,
    success: LoadObjectsResponse,
    error: ApiErrorBody,
  }),
  // const _aggregate = [1, "/v2/ontologies/{0}/objectSets/aggregate", 7];
  HttpApiEndpoint.post("aggregate", "/v2/ontologies/:ontology/objectSets/aggregate", {
    params: { ontology },
    query: { branch, transactionId, scenarioRid },
    payload: AggregateObjectSetRequest,
    success: AggregateResponse,
    error: ApiErrorBody,
  }),
  // const _loadLinks = [1, "/v2/ontologies/{0}/objectSets/loadLinks", 7];
  HttpApiEndpoint.post("loadLinks", "/v2/ontologies/:ontology/objectSets/loadLinks", {
    params: { ontology },
    query: { branch, preview },
    payload: LoadLinksRequest,
    success: LinkPage,
    error: ApiErrorBody,
  })
);

// Source: Action.js / Action.d.ts
const Actions = HttpApiGroup.make("actions").add(
  // const _apply = [1, "/v2/ontologies/{0}/actions/{1}/apply", 7];
  HttpApiEndpoint.post("apply", "/v2/ontologies/:ontology/actions/:action/apply", {
    params: { ontology, action: ActionTypeApiName },
    query: { branch, transactionId, scenarioRid },
    payload: ApplyActionRequest,
    success: ApplyActionResponse,
    error: ApiErrorBody,
  }),
  // const _applyBatch = [1, "/v2/ontologies/{0}/actions/{1}/applyBatch", 3];
  HttpApiEndpoint.post("applyBatch", "/v2/ontologies/:ontology/actions/:action/applyBatch", {
    params: { ontology, action: ActionTypeApiName },
    query: { branch, scenarioRid },
    payload: BatchApplyActionRequest,
    success: BatchApplyActionResponse,
    error: ApiErrorBody,
  })
);

// Source: Query.js / Query.d.ts
const Queries = HttpApiGroup.make("queries").add(
  // const _execute = [1, "/v2/ontologies/{0}/queries/{1}/execute", 7];
  HttpApiEndpoint.post("execute", "/v2/ontologies/:ontology/queries/:queryApiName/execute", {
    params: { ontology, queryApiName: QueryApiName },
    query: {
      version: S.OptionFromOptionalKey(FunctionVersion).annotateKey({
        description: "Version of the query to call; the latest published version when absent.",
      }),
      branch,
      transactionId,
      scenarioRid,
    },
    payload: ExecuteQueryRequest,
    success: ExecuteQueryResponse,
    error: ApiErrorBody,
  })
);

// Source: Attachment.js / Attachment.d.ts. These two routes name no ontology.
const Attachments = HttpApiGroup.make("attachments").add(
  // const _upload = [1, "/v2/ontologies/attachments/upload", 7, "*/*"];
  HttpApiEndpoint.post("upload", "/v2/ontologies/attachments/upload", {
    query: AttachmentUpload,
    payload: FileContent,
    success: AttachmentMetadata,
    error: ApiErrorBody,
  }),
  // const _read = [0, "/v2/ontologies/attachments/{0}/content",,, "*/*"];
  HttpApiEndpoint.get("read", "/v2/ontologies/attachments/:attachmentRid/content", {
    params: { attachmentRid: AttachmentRid },
    success: FileContent,
    error: ApiErrorBody,
  })
);

// -----------------------------------------------------------------------------
// The API
// -----------------------------------------------------------------------------

/**
 * The platform's ontology routes as one declared HTTP API.
 *
 * **Details**
 *
 * Five groups, named as the generated client names its modules: `ontologies`
 * (the definition of an ontology, whole or selected), `objectSets` (load,
 * aggregate, load links), `actions` (apply, apply in a batch), `queries`
 * (execute) and `attachments` (upload, read). Bodies and answers are the
 * schemas of the other concepts, so the JSON a derived client sends is exactly
 * what those schemas encode, and what it returns is already a domain value.
 * The one answer that is not read to the end is a page of objects:
 * `objectSets.load` answers with `LoadObjectsResponse`, an envelope whose rows
 * are still the flat wire records, because the route does not know which
 * codec its caller reads a row with.
 *
 * Every endpoint declares `ApiErrorBody` as the body of a failed request. The
 * platform sends that one record with whatever status fits the failure (400,
 * 404, 409 and so on), and a declared error has a single status, so the
 * declaration says what the body is and the transport layer pairs it with the
 * status the response actually carries.
 *
 * **Example** (Build the address of a load request on a branch)
 *
 * ```ts import.meta.vitest name="Build the address of a load request on a branch"
 * import * as HttpApiClient from "effect/http-api/HttpApiClient"
 * import * as O from "effect/Option"
 * import { OntologyApi } from "@beep/scratchpad/osdk/src/Api/index"
 * import { FoundryBranch, OntologyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const address = HttpApiClient.urlBuilder(OntologyApi, { baseUrl: "https://stack.example.com" })
 * const url = address.objectSets.load({
 *   params: { ontology: OntologyApiName.make("default-ontology") },
 *   query: { branch: O.some(FoundryBranch.make("feature-1")), transactionId: O.none(), scenarioRid: O.none() },
 * })
 * url // => "https://stack.example.com/v2/ontologies/default-ontology/objectSets/loadObjects?branch=feature-1"
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const OntologyApi = HttpApi.make("FoundryOntologies").add(Ontologies, ObjectSets, Actions, Queries, Attachments);
