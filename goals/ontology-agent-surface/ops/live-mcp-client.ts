/** Host-side live MCP client proof for the professional desktop sidecar. */

import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import {
  CapabilityMetadataResponse,
  OntologySparqlQueryRequest,
  OntologySparqlQueryResponse,
} from "@beep/ontology-use-cases/tools";
import { NodeRuntime } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { rpcSessionAuthorizationHeader } from "../../../apps/professional-desktop/server/RpcSessionAuth.ts";

const url = Effect.runSync(Config.string("ONTOLOGY_MCP_URL"));
const origin = Effect.runSync(Config.string("ONTOLOGY_MCP_ORIGIN"));
const token = Effect.runSync(Config.redacted("BEEP_DESKTOP_RPC_SESSION_TOKEN"));
const ontologyPath = Effect.runSync(Config.string("ONTOLOGY_MCP_ONTOLOGY_PATH"));

let sessionId: string | null = null;
function sessionFetch(
  input: Parameters<typeof globalThis.fetch>[0],
  init?: Parameters<typeof globalThis.fetch>[1]
): ReturnType<typeof globalThis.fetch> {
  const request = new Request(input, init);
  if (sessionId !== null) {
    request.headers.set("Mcp-Session-Id", sessionId);
  }
  return globalThis.fetch(request).then((response) => {
    const nextSessionId = response.headers.get("Mcp-Session-Id");
    if (nextSessionId !== null) {
      sessionId = nextSessionId;
    }
    return response;
  });
}

const HttpLive = FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, sessionFetch)));
const ClientLive = RpcClient.layerProtocolHttp({
  url,
  transformClient: HttpClient.mapRequest(
    HttpClientRequest.setHeaders({
      authorization: rpcSessionAuthorizationHeader(token),
      origin,
    })
  ),
}).pipe(Layer.provideMerge(RpcSerialization.layerJsonRpc()), Layer.provideMerge(HttpLive));

const program = Effect.gen(function* () {
  const path = yield* S.decodeUnknownEffect(OntologyFilePath)(ontologyPath);
  const client = yield* RpcClient.make(McpSchema.ClientRpcs);
  const initialized = yield* client.initialize({
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "beep-ontology-live-proof", version: "0.0.0" },
  });
  yield* Effect.log("initialize", {
    protocolVersion: initialized.protocolVersion,
    server: initialized.serverInfo.name,
  });

  const listed = yield* client["tools/list"](undefined);
  yield* Effect.log("tools/list", { tools: A.map(listed.tools, (tool) => tool.name) });

  const metadataCall = yield* client["tools/call"]({ name: "ontology_capability_metadata", arguments: {} });
  const metadata = yield* S.decodeUnknownEffect(CapabilityMetadataResponse)(metadataCall.structuredContent);
  yield* Effect.log("tools/call ontology_capability_metadata", {
    isError: metadataCall.isError,
    maxQueryResults: metadata.budgets.maxQueryResults,
    reasonerProfile: metadata.reasonerProfile,
  });

  const queryRequest = yield* S.encodeUnknownEffect(OntologySparqlQueryRequest)(
    OntologySparqlQueryRequest.make({
      path,
      profile: "select",
      query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }",
    })
  );
  const queryCall = yield* client["tools/call"]({ name: "ontology_sparql_query", arguments: queryRequest });
  const query = yield* S.decodeUnknownEffect(OntologySparqlQueryResponse)(queryCall.structuredContent);
  yield* Effect.log("tools/call ontology_sparql_query", {
    displayedResultCount: query.query.displayedResultCount,
    effectiveLimit: query.query.effectiveLimit,
    isError: queryCall.isError,
    truncated: query.query.truncated,
  });
});

program.pipe(Effect.provide(ClientLive), Effect.scoped, NodeRuntime.runMain);
