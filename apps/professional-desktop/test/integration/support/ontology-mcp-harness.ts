import { EpistemicConfigTest } from "@beep/epistemic-config/test";
import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import { OntologyMcpConfigLive } from "@beep/ontology-config/layer";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import { OpenInspectRequest, OpenInspectResponse } from "@beep/ontology-use-cases/tools";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import { HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/unstable/http";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { makeOntologyMcpTransportLayer } from "../../../server/OntologyMcpTransport.ts";
import { rpcSessionAuthorizationHeader } from "../../../server/RpcSessionAuth.ts";
import type { EpistemicConfig } from "@beep/epistemic-config/server";
import type { ExecutionDecisionRecord, ExecutionOutcomeRecord } from "@beep/epistemic-domain/values/ExecutionRecord";
import type * as Scope from "effect/Scope";
export const token = Redacted.make("ontology-mcp-http-test-token");
export const allowedOrigin = "http://professional-desktop.beep.localhost:1355";
const socketTransportConfig = Config.boolean("BEEP_TEST_ONTOLOGY_MCP_SOCKET").pipe(Config.withDefault(false));
// unary by contract: `options` stays reachable through `S.decodeUnknownEffect(OntologyFilePath)`;
// a dual is undecidable here because `input` is `unknown`.
export const decodeOntologyFilePath: (input: unknown) => Effect.Effect<OntologyFilePath, S.SchemaError> =
  S.decodeUnknownEffect(OntologyFilePath);
const encodeOpenInspectRequest = S.encodeUnknownEffect(OpenInspectRequest);
const decodeOpenInspectResponse = S.decodeUnknownEffect(OpenInspectResponse);
const NodeHttp = process.getBuiltinModule("node:http");

const fixtureSource = `@prefix ex: <https://example.test/> .
ex:alice a ex:Person ; ex:name "Alice" .
ex:bob a ex:Person ; ex:name "Bob" .
`;

export type TransportOptions = {
  readonly mutationsEnabled: boolean;
  readonly approvedMutationTools: ReadonlyArray<string>;
  readonly egressFetch?: typeof globalThis.fetch | undefined;
  readonly epistemicConfig?: Layer.Layer<EpistemicConfig> | undefined;
  readonly ledger?: Layer.Layer<ExecutionLedger> | undefined;
};

// Tests that make no ledger assertions still need one for the governed gate.
const silentLedgerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const decisions = yield* Ref.make<ReadonlyArray<ExecutionDecisionRecord>>([]);
    const outcomes = yield* Ref.make<ReadonlyArray<ExecutionOutcomeRecord>>([]);
    return Layer.succeed(
      ExecutionLedger,
      ExecutionLedger.of({
        appendDecision: Effect.fn("OntologyMcpHarness.appendDecision")((record) =>
          Ref.update(decisions, A.append(record))
        ),
        appendOutcome: Effect.fn("OntologyMcpHarness.appendOutcome")((record) =>
          Ref.update(outcomes, A.append(record))
        ),
        readDecisions: Effect.fn("OntologyMcpHarness.readDecisions")((runKey) =>
          Effect.map(
            Ref.get(decisions),
            A.filter((record) => record.runKey === runKey)
          )
        ),
        readOutcomes: Effect.fn("OntologyMcpHarness.readOutcomes")((runKey) =>
          Effect.map(
            Ref.get(outcomes),
            A.filter((record) => record.runKey === runKey)
          )
        ),
        readUnsettledAllowed: Effect.fn("OntologyMcpHarness.readUnsettledAllowed")(function* (runKey) {
          const settled = A.map(yield* Ref.get(outcomes), (record) => record.decisionHash);
          return A.filter(
            yield* Ref.get(decisions),
            (record) => record.runKey === runKey && record.verdict === "allowed" && !A.contains(settled, record.hash)
          );
        }),
      })
    );
  })
);

// `mutationsEnabled` now travels the real config path (ConfigProvider ->
// OntologyMcpConfigLive -> Layer.unwrap) rather than being handed to the
// transport as a literal, so these tests exercise the wiring main.ts uses.
// `approvedMutationTools` stays an explicit argument: registering the mutation
// tools while approving none of them is the fail-closed proof, and it is a
// state no environment variable can produce.
const transportConfigProvider = (root: string, options: TransportOptions) =>
  ConfigProvider.layer(
    ConfigProvider.fromUnknown({
      ONTOLOGY_MCP_MUTATIONS_ENABLED: options.mutationsEnabled ? "true" : "false",
      ONTOLOGY_WORKSPACE_ROOT: root,
    })
  );

const transportLayer = (root: string, options: TransportOptions) =>
  makeOntologyMcpTransportLayer({
    token,
    approvedMutationTools: options.approvedMutationTools,
    egressFetch: options.egressFetch,
  }).pipe(
    Layer.provide(OntologyMcpConfigLive),
    Layer.provide(options.ledger ?? silentLedgerLayer),
    Layer.provide(options.epistemicConfig ?? EpistemicConfigTest),
    Layer.provide(transportConfigProvider(root, options)),
    Layer.provide(NodeServices.layer),
    Layer.orDie
  );

const transportServer = (root: string, options: TransportOptions) => {
  const routes = transportLayer(root, options).pipe(Layer.provide(HttpRouter.layer));
  return routes.pipe(Layer.provide(HttpRouter.serve(routes, { disableListenLog: true, disableLogger: true })));
};

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
      Effect.scoped
    );

const nodeLoopbackLayer = HttpServer.layerTestClient.pipe(
  Layer.provide(
    Layer.fresh(FetchHttpClient.layer).pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ keepalive: false }))
    )
  ),
  Layer.provideMerge(NodeHttpServer.layer(NodeHttp.createServer, { host: "127.0.0.1", port: 0 }))
);

const mcpSessionClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    // `initialize` negotiates both a session id and a protocol version, and the
    // streamable HTTP transport answers 400 to any later request that fails to
    // echo them back. Capture whatever the server returns rather than pinning a
    // literal, so the harness follows the negotiated revision.
    const sessionId = yield* Ref.make(O.none<string>());
    const protocolVersion = yield* Ref.make(O.none<string>());
    const replay = (header: string, ref: Ref.Ref<O.Option<string>>) => (request: HttpClientRequest.HttpClientRequest) =>
      Effect.map(
        Ref.get(ref),
        O.match({
          onNone: () => request,
          onSome: (value) => HttpClientRequest.setHeader(request, header, value),
        })
      );
    const capture = (header: string, ref: Ref.Ref<O.Option<string>>) => (headers: Record<string, string | undefined>) =>
      O.match(O.fromUndefinedOr(headers[header]), {
        onNone: () => Effect.void,
        onSome: (value) => Ref.set(ref, O.some(value)),
      });
    return client.pipe(
      HttpClient.mapRequestEffect((request) =>
        replay(
          "mcp-session-id",
          sessionId
        )(request).pipe(Effect.flatMap(replay("mcp-protocol-version", protocolVersion)))
      ),
      HttpClient.transformResponse(
        Effect.tap((response) =>
          capture(
            "mcp-session-id",
            sessionId
          )(response.headers).pipe(Effect.andThen(capture("mcp-protocol-version", protocolVersion)(response.headers)))
        )
      )
    );
  })
);

const makeMcpClientProtocol = (useSocketTransport: boolean) =>
  RpcClient.layerProtocolHttp({
    url: useSocketTransport ? "" : "http://localhost",
    transformClient: HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.appendUrl("/mcp"),
        HttpClientRequest.setHeaders({
          // The streamable HTTP transport answers 406 unless the client accepts
          // both media types, since any response may upgrade to an SSE stream.
          accept: "application/json, text/event-stream",
          authorization: rpcSessionAuthorizationHeader(token),
          origin: allowedOrigin,
        })
      )
    ),
  }).pipe(Layer.provideMerge(RpcSerialization.layerJsonRpc()));

type WithHttpServerRun<A2, E> = (
  root: string,
  ontologyPath: OntologyFilePath,
  useSocketTransport: boolean
) => Effect.Effect<A2, E, HttpClient.HttpClient | FileSystem.FileSystem | Path.Path | RpcClient.Protocol | Scope.Scope>;

const withHttpServerImpl = <A2, E>(options: TransportOptions, run: WithHttpServerRun<A2, E>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "ontology-mcp-http-" });
      yield* fileSystem.writeFileString(path.join(root, "ontology.ttl"), fixtureSource);
      const ontologyPath = yield* decodeOntologyFilePath("ontology.ttl");
      const useSocketTransport = yield* socketTransportConfig;
      if (useSocketTransport) {
        const server = transportServer(root, options).pipe(Layer.provideMerge(nodeLoopbackLayer));
        const client = mcpSessionClientLayer.pipe(Layer.provideMerge(server));
        return yield* run(root, ontologyPath, useSocketTransport).pipe(
          provideScopedLayer(makeMcpClientProtocol(useSocketTransport).pipe(Layer.provideMerge(client)))
        );
      }

      const routes = transportLayer(root, options);
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
      return yield* run(root, ontologyPath, useSocketTransport).pipe(
        provideScopedLayer(makeMcpClientProtocol(useSocketTransport).pipe(Layer.provideMerge(clientLayer)))
      );
    }).pipe(provideScopedLayer(NodeServices.layer))
  );

export const withHttpServer: {
  <A2, E>(run: WithHttpServerRun<A2, E>): (options: TransportOptions) => ReturnType<typeof withHttpServerImpl<A2, E>>;
  <A2, E>(options: TransportOptions, run: WithHttpServerRun<A2, E>): ReturnType<typeof withHttpServerImpl<A2, E>>;
} = dual(2, withHttpServerImpl);

export const makeMcpClient = Effect.fn("OntologyMcpHttpTest.makeClient")(function* () {
  const client = yield* RpcClient.make(McpSchema.ClientRpcs);
  yield* client.initialize({
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "ontology-mcp-http-test", version: "0.0.0" },
  });
  return client;
});

export const openThroughMcp = Effect.fn("OntologyMcpHttpTest.open")(function* (
  client: Effect.Success<ReturnType<typeof makeMcpClient>>,
  ontologyPath: OntologyFilePath
) {
  const request = yield* encodeOpenInspectRequest(OpenInspectRequest.make({ path: ontologyPath }));
  const result = yield* client["tools/call"]({ name: "ontology_open_inspect", arguments: request });
  return yield* decodeOpenInspectResponse(result.structuredContent);
});
