import { ExecutionAuthorityConfigTest } from "@beep/execution-authority-config/test";
import { ExecutionLedger } from "@beep/execution-authority-use-cases/ExecutionLedger";
import { OntologyMcpConfigLive } from "@beep/ontology-config/layer";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import { OpenInspectRequest, OpenInspectResponse } from "@beep/ontology-use-cases/tools";
import { NodeHttpServer } from "@effect/platform-node";
import * as A from "effect/Array";
import * as McpSchema from "effect/ai/McpSchema";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, identity } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { makeOntologyMcpTransportLayer, OntologyMcpTransportOptions } from "../../../server/OntologyMcpTransport.ts";
import { rpcSessionAuthorizationHeader } from "../../../server/RpcSessionAuth.ts";
import type { ExecutionAuthorityConfig } from "@beep/execution-authority-config/server";
import type {
  ExecutionDecisionRecord,
  ExecutionOutcomeRecord,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";

const UnknownJson = S.fromJsonString(S.Unknown);
export const token = Redacted.make("ontology-mcp-http-test-token");
export const allowedOrigin = "http://professional-desktop.beep.localhost:1355";
const streamableHttpRequiredAccept = "application/json, text/event-stream";
const socketTransportConfig = Config.Boolean("BEEP_TEST_ONTOLOGY_MCP_SOCKET").pipe(Config.withDefault(false));
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
  readonly egressFetch?: typeof globalThis.fetch;
  readonly executionAuthorityConfig?: Layer.Layer<ExecutionAuthorityConfig> | undefined;
  readonly ledger?: Layer.Layer<ExecutionLedger> | undefined;
};

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
          const got = yield* Ref.get(outcomes);
          const settled = A.map(got, (record) => record.decisionHash);
          const got1 = yield* Ref.get(decisions);
          return A.filter(
            got1,
            (record) => record.runKey === runKey && record.verdict === "allowed" && !A.contains(settled, record.hash)
          );
        }),
      })
    );
  })
);

const transportConfigProvider = (root: string, options: TransportOptions) =>
  ConfigProvider.layer(
    ConfigProvider.fromUnknown({
      ONTOLOGY_MCP_MUTATIONS_ENABLED: options.mutationsEnabled ? "true" : "false",
      ONTOLOGY_WORKSPACE_ROOT: root,
    })
  );

const transportLayer = (root: string, options: TransportOptions) =>
  makeOntologyMcpTransportLayer(
    OntologyMcpTransportOptions.make({
      token,
      approvedMutationTools: options.approvedMutationTools,
      ...Struct.pick(options, ["egressFetch"]),
    })
  ).pipe(
    Layer.provide(OntologyMcpConfigLive),
    Layer.provide(options.ledger ?? silentLedgerLayer),
    Layer.provide(options.executionAuthorityConfig ?? ExecutionAuthorityConfigTest),
    Layer.provide(transportConfigProvider(root, options)),
    Layer.orDie
  );

const transportServer = (root: string, options: TransportOptions) =>
  HttpRouter.serve(transportLayer(root, options), { disableListenLog: true, disableLogger: true });

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
    const sessionId = yield* Ref.make(O.none<string>());
    const protocolVersion = yield* Ref.make(O.none<string>());
    const echoNegotiatedHeader =
      (header: string, ref: Ref.Ref<O.Option<string>>) => (request: HttpClientRequest.HttpClientRequest) =>
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
        echoNegotiatedHeader(
          "mcp-session-id",
          sessionId
        )(request).pipe(Effect.flatMap(echoNegotiatedHeader("mcp-protocol-version", protocolVersion)))
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

const dropOneLeadingSpace = Str.replace(/^ /, "");

const unwrapServerSentEvents = (response: HttpClientResponse.HttpClientResponse) =>
  Str.startsWith("text/event-stream")(response.headers["content-type"] ?? "")
    ? Effect.map(Effect.orDie(response.text), (text) => {
        const lfOnlyText = Str.replaceAll(/\r\n?/g, "\n")(text);
        const blankLineDelimitedEvents = Str.split("\n\n")(lfOnlyText);
        const payloads = A.filter(
          A.map(blankLineDelimitedEvents, (event) =>
            A.join(
              A.map(A.filter(Str.split("\n")(event), Str.startsWith("data:")), flow(Str.slice(5), dropOneLeadingSpace)),
              "\n"
            )
          ),
          Str.isNonEmpty
        );
        const messages = A.map(payloads, (payload): unknown =>
          Result.getOrThrowWith(S.decodeResult(UnknownJson)(payload), identity)
        );
        const responsesWithoutNotifications = A.filter(messages, P.hasProperty("id"));
        return HttpClientResponse.fromWeb(
          response.request,
          new Response(
            Result.getOrThrowWith(
              S.encodeUnknownResult(UnknownJson)(
                responsesWithoutNotifications.length === 1
                  ? responsesWithoutNotifications[0]
                  : responsesWithoutNotifications
              ),
              identity
            ),
            {
              status: response.status,
              headers: Headers.set(response.headers, "content-type", "application/json"),
            }
          )
        );
      })
    : Effect.succeed(response);

const makeMcpClientProtocol = (useSocketTransport: boolean) =>
  RpcClient.layerProtocolHttp({
    url: useSocketTransport ? "" : "http://localhost",
    transformClient: flow(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.appendUrl("/mcp"),
          HttpClientRequest.setHeaders({
            accept: streamableHttpRequiredAccept,
            authorization: rpcSessionAuthorizationHeader(token),
            origin: allowedOrigin,
          })
        )
      ),
      HttpClient.transformResponse(Effect.flatMap(unwrapServerSentEvents))
    ),
  }).pipe(Layer.provideMerge(RpcSerialization.layerJsonRpc()));

/**
 * Workspace and transport mode owned by one ontology HTTP fixture.
 *
 * **Example** (Read the fixture workspace)
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { HttpServerFixture } from "./ontology-mcp-harness.ts"
 *
 * const workspace = Effect.map(HttpServerFixture, ({ root }) => root)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class HttpServerFixture extends Context.Service<
  HttpServerFixture,
  {
    readonly root: string;
    readonly ontologyPath: OntologyFilePath;
    readonly useSocketTransport: boolean;
  }
>()("@beep/professional-desktop/test/integration/support/ontology-mcp-harness/HttpServerFixture") {}

/**
 * Own an isolated ontology workspace, HTTP transport, and MCP protocol in a layer.
 *
 * **Details**
 * Public test layers own static fixtures. Tests comparing separate execution
 * windows build fresh layers in explicit shorter scopes so cleanup precedes
 * subsequent ledger observations. Both transport modes release their resources.
 *
 * **Example** (Provide host services to the fixture)
 * ```ts
 * import { NodeServices } from "@effect/platform-node"
 * import * as Layer from "effect/Layer"
 * import { makeHttpServerLayer } from "./ontology-mcp-harness.ts"
 *
 * const fixture = makeHttpServerLayer({
 *   mutationsEnabled: false,
 *   approvedMutationTools: []
 * }).pipe(Layer.provide(NodeServices.layer))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeHttpServerLayer = (options: TransportOptions) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "ontology-mcp-http-" });
      yield* fileSystem.writeFileString(path.join(root, "ontology.ttl"), fixtureSource);
      const ontologyPath = yield* decodeOntologyFilePath("ontology.ttl");
      const useSocketTransport = yield* socketTransportConfig;
      const fixture = Layer.succeed(HttpServerFixture, { root, ontologyPath, useSocketTransport });
      if (useSocketTransport) {
        const server = transportServer(root, options).pipe(Layer.provideMerge(nodeLoopbackLayer));
        const client = mcpSessionClientLayer.pipe(Layer.provideMerge(server));
        return Layer.merge(fixture, makeMcpClientProtocol(useSocketTransport).pipe(Layer.provideMerge(client)));
      }

      const routesWithBridgedServices = transportLayer(root, options).pipe(
        Layer.provide(Layer.succeed(FileSystem.FileSystem, fileSystem)),
        Layer.provide(Layer.succeed(Path.Path, path))
      );
      const { dispose, handler } = HttpRouter.toWebHandler(routesWithBridgedServices, { disableLogger: true });
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
      return Layer.merge(fixture, makeMcpClientProtocol(useSocketTransport).pipe(Layer.provideMerge(clientLayer)));
    })
  );

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
