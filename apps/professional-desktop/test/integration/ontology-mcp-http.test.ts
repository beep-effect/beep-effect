/** @effect-diagnostics nodeBuiltinImport:skip-file */
import { createServer } from "node:http";
import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import {
  CapabilityMetadataResponse,
  OntologySparqlQueryRequest,
  OntologySparqlQueryResponse,
  OntologyToolFailure,
  OpenInspectRequest,
  OpenInspectResponse,
  ProposeChangeBatchRequest,
  ProposeChangeBatchResponse,
  ProposeChangeBatchTool,
} from "@beep/ontology-use-cases/tools";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Config, ConfigProvider, Effect, FileSystem, Layer, Path, pipe, Redacted, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import { HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/unstable/http";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { makeOntologyMcpTransportLayer } from "../../server/OntologyMcpTransport.js";
import { rpcSessionAuthorizationHeader } from "../../server/RpcSessionAuth.js";
import type { Scope } from "effect";

const token = Redacted.make("ontology-mcp-http-test-token");
const allowedOrigin = "http://127.0.0.1:1421";
const useSocketTransport = Effect.runSync(
  Config.boolean("BEEP_TEST_ONTOLOGY_MCP_SOCKET").pipe(Config.withDefault(false))
);

const fixtureSource = `@prefix ex: <https://example.test/> .
ex:alice a ex:Person ; ex:name "Alice" .
ex:bob a ex:Person ; ex:name "Bob" .
`;

const initializeBody =
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"ontology-mcp-http-test","version":"0.0.0"}}}';

const transportServer = (
  root: string,
  options: { readonly mutationsEnabled: boolean; readonly approvedMutationTools: ReadonlyArray<string> }
) => {
  const routes = makeOntologyMcpTransportLayer({ token, ...options }).pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
    Layer.provide(NodeServices.layer),
    Layer.orDie,
    Layer.provide(HttpRouter.layer)
  );
  return routes.pipe(Layer.provide(HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true })));
};

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const nodeLoopbackLayer = HttpServer.layerTestClient.pipe(
  Layer.provide(
    Layer.fresh(FetchHttpClient.layer).pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ keepalive: false }))
    )
  ),
  Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))
);

const mcpSessionClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const sessionId = yield* Ref.make(O.none<string>());
    return client.pipe(
      HttpClient.mapRequestEffect((request) =>
        Ref.get(sessionId).pipe(
          Effect.map(
            O.match({
              onNone: () => request,
              onSome: (value) => HttpClientRequest.setHeader(request, "mcp-session-id", value),
            })
          )
        )
      ),
      HttpClient.transformResponse(
        Effect.tap((response) =>
          pipe(
            O.fromUndefinedOr(response.headers["mcp-session-id"]),
            O.match({
              onNone: () => Effect.void,
              onSome: (value) => Ref.set(sessionId, O.some(value)),
            })
          )
        )
      )
    );
  })
);

const mcpClientProtocol = RpcClient.layerProtocolHttp({
  url: useSocketTransport ? "" : "http://localhost",
  transformClient: HttpClient.mapRequest((request) =>
    request.pipe(
      HttpClientRequest.appendUrl("/mcp"),
      HttpClientRequest.setHeaders({
        authorization: rpcSessionAuthorizationHeader(token),
        origin: allowedOrigin,
      })
    )
  ),
}).pipe(Layer.provideMerge(RpcSerialization.layerJsonRpc()));

const withHttpServer = <A2, E>(
  options: { readonly mutationsEnabled: boolean; readonly approvedMutationTools: ReadonlyArray<string> },
  run: (
    root: string,
    ontologyPath: OntologyFilePath
  ) => Effect.Effect<
    A2,
    E,
    HttpClient.HttpClient | FileSystem.FileSystem | Path.Path | RpcClient.Protocol | Scope.Scope
  >
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "ontology-mcp-http-" });
      yield* fileSystem.writeFileString(path.join(root, "ontology.ttl"), fixtureSource);
      const ontologyPath = yield* S.decodeUnknownEffect(OntologyFilePath)("ontology.ttl");
      if (useSocketTransport) {
        const server = transportServer(root, options).pipe(Layer.provideMerge(nodeLoopbackLayer));
        const client = mcpSessionClientLayer.pipe(Layer.provideMerge(server));
        return yield* run(root, ontologyPath).pipe(
          provideScopedLayer(mcpClientProtocol.pipe(Layer.provideMerge(client)))
        );
      }

      const routes = makeOntologyMcpTransportLayer({ token, ...options }).pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
        Layer.provide(NodeServices.layer),
        Layer.orDie
      );
      const { dispose, handler } = HttpRouter.toWebHandler(routes, { disableLogger: true });
      yield* Effect.addFinalizer(() => Effect.promise(dispose));
      function customFetch(
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1]
      ): ReturnType<typeof globalThis.fetch> {
        return handler(new Request(input, init));
      }
      customFetch.preconnect = globalThis.fetch.preconnect;
      const clientLayer = mcpSessionClientLayer.pipe(
        Layer.provideMerge(FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, customFetch))))
      );
      return yield* run(root, ontologyPath).pipe(
        provideScopedLayer(mcpClientProtocol.pipe(Layer.provideMerge(clientLayer)))
      );
    }).pipe(provideScopedLayer(NodeServices.layer))
  );

const makeMcpClient = Effect.fn("OntologyMcpHttpTest.makeClient")(function* () {
  const client = yield* RpcClient.make(McpSchema.ClientRpcs);
  yield* client.initialize({
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "ontology-mcp-http-test", version: "0.0.0" },
  });
  return client;
});

const rawInitialize = Effect.fn("OntologyMcpHttpTest.rawInitialize")(function* (
  headers: Readonly<Record<string, string>>
) {
  const client = yield* HttpClient.HttpClient;
  return yield* HttpClientRequest.post(useSocketTransport ? "/mcp" : "http://localhost/mcp").pipe(
    HttpClientRequest.setHeaders(headers),
    HttpClientRequest.bodyText(initializeBody, "application/json"),
    client.execute
  );
});

const addName = (person: string, name: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${person}`),
      makeNamedNode("https://example.test/name"),
      makeLiteral(name, XSD_STRING.value)
    ),
  });

const openThroughMcp = Effect.fn("OntologyMcpHttpTest.open")(function* (
  client: Effect.Success<ReturnType<typeof makeMcpClient>>,
  ontologyPath: OntologyFilePath
) {
  const request = yield* S.encodeUnknownEffect(OpenInspectRequest)(OpenInspectRequest.make({ path: ontologyPath }));
  const result = yield* client["tools/call"]({ name: "ontology_open_inspect", arguments: request });
  return yield* S.decodeUnknownEffect(OpenInspectResponse)(result.structuredContent);
});

describe("professional desktop ontology MCP streamable HTTP mount", { concurrent: false }, () => {
  it.effect(
    "proves initialize, tools/list, and the read-only first slice while mutation registration is disabled",
    () =>
      withHttpServer({ mutationsEnabled: false, approvedMutationTools: [] }, (_root, ontologyPath) =>
        Effect.gen(function* () {
          const client = yield* makeMcpClient();
          const listed = yield* client["tools/list"](undefined);
          const names = A.map(listed.tools, (tool) => tool.name);
          expect(A.contains(names, "ontology_capability_metadata")).toBe(true);
          expect(A.contains(names, "ontology_sparql_query")).toBe(true);
          expect(A.contains(names, "ontology_propose_change_batch")).toBe(false);
          expect(A.contains(names, "ontology_repair")).toBe(false);

          const metadataCall = yield* client["tools/call"]({
            name: "ontology_capability_metadata",
            arguments: {},
          });
          const metadata = yield* S.decodeUnknownEffect(CapabilityMetadataResponse)(metadataCall.structuredContent);
          const queryRequest = yield* S.encodeUnknownEffect(OntologySparqlQueryRequest)(
            OntologySparqlQueryRequest.make({
              path: ontologyPath,
              profile: "select",
              query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }",
            })
          );
          const queryCall = yield* client["tools/call"]({ name: "ontology_sparql_query", arguments: queryRequest });
          const query = yield* S.decodeUnknownEffect(OntologySparqlQueryResponse)(queryCall.structuredContent);

          expect(metadataCall.isError).toBe(false);
          expect(metadata.budgets.maxQueryResults).toBe(200);
          expect(queryCall.isError).toBe(false);
          expect(query.query.displayedResultCount).toBe(4);
        })
      )
  );

  it.effect("rejects untrusted Origins with typed 403 and rejects unauthenticated requests", () =>
    withHttpServer({ mutationsEnabled: false, approvedMutationTools: [] }, () =>
      Effect.gen(function* () {
        const forbidden = yield* rawInitialize({
          authorization: rpcSessionAuthorizationHeader(token),
          origin: "https://attacker.example",
        });
        const forbiddenBody = yield* forbidden.text;
        const unauthorized = yield* rawInitialize({ origin: allowedOrigin });

        expect(forbidden.status).toBe(403);
        expect(Str.includes("OntologyMcpOriginForbidden")(forbiddenBody)).toBe(true);
        expect(unauthorized.status).toBe(401);
      })
    )
  );

  it.effect("fails mutation closed through TierGate when no tool approval resolves", () =>
    withHttpServer({ mutationsEnabled: true, approvedMutationTools: [] }, (_root, ontologyPath) =>
      Effect.gen(function* () {
        const client = yield* makeMcpClient();
        const opened = yield* openThroughMcp(client, ontologyPath);
        const request = yield* S.encodeUnknownEffect(ProposeChangeBatchRequest)(
          ProposeChangeBatchRequest.make({
            path: ontologyPath,
            expectedFingerprint: opened.fingerprint,
            operations: [addName("carol", "Carol")],
          })
        );
        const call = yield* client["tools/call"]({
          name: ProposeChangeBatchTool.name,
          arguments: request,
        });
        const refusal = yield* S.decodeUnknownEffect(OntologyToolFailure)(call.structuredContent);

        expect(call.isError).toBe(true);
        expect(refusal._tag).toBe("OntologyTierGateRefusal");
      })
    )
  );

  it.effect("records the authenticated MCP caller and surfaces budget and CAS failures as typed tool errors", () =>
    withHttpServer(
      { mutationsEnabled: true, approvedMutationTools: [ProposeChangeBatchTool.name] },
      (root, ontologyPath) =>
        Effect.gen(function* () {
          const client = yield* makeMcpClient();
          const opened = yield* openThroughMcp(client, ontologyPath);
          const firstRequest = yield* S.encodeUnknownEffect(ProposeChangeBatchRequest)(
            ProposeChangeBatchRequest.make({
              path: ontologyPath,
              expectedFingerprint: opened.fingerprint,
              operations: [addName("carol", "Carol")],
            })
          );
          const firstCall = yield* client["tools/call"]({
            name: ProposeChangeBatchTool.name,
            arguments: firstRequest,
          });
          const first = yield* S.decodeUnknownEffect(ProposeChangeBatchResponse)(firstCall.structuredContent);
          const fileSystem = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const provenance = yield* fileSystem.readFileString(
            path.join(root, `ontology.ttl.${first.currentFingerprint}.prov.ttl`)
          );

          const budgetRequest = yield* S.encodeUnknownEffect(ProposeChangeBatchRequest)(
            ProposeChangeBatchRequest.make({
              path: ontologyPath,
              expectedFingerprint: first.currentFingerprint,
              operations: A.makeBy(257, (index) => addName(`budget-${index}`, `Name ${index}`)),
            })
          );
          const budgetCall = yield* client["tools/call"]({
            name: ProposeChangeBatchTool.name,
            arguments: budgetRequest,
          });
          const budget = yield* S.decodeUnknownEffect(OntologyToolFailure)(budgetCall.structuredContent);

          const staleRequest = yield* S.encodeUnknownEffect(ProposeChangeBatchRequest)(
            ProposeChangeBatchRequest.make({
              path: ontologyPath,
              expectedFingerprint: opened.fingerprint,
              operations: [addName("dave", "Dave")],
            })
          );
          const staleCall = yield* client["tools/call"]({
            name: ProposeChangeBatchTool.name,
            arguments: staleRequest,
          });
          const stale = yield* S.decodeUnknownEffect(OntologyToolFailure)(staleCall.structuredContent);

          expect(firstCall.isError).toBe(false);
          expect(Str.includes("urn:beep:desktop-rpc-session:mcp-client:")(provenance)).toBe(true);
          expect(Str.includes("prov:Agent")(provenance)).toBe(true);
          expect(Str.includes("prov:wasAssociatedWith")(provenance)).toBe(true);
          expect(budgetCall.isError).toBe(true);
          expect(budget._tag).toBe("OntologyBudgetRefusal");
          expect(staleCall.isError).toBe(true);
          expect(stale._tag).toBe("OntologyCasConflict");
        })
    )
  );
});
