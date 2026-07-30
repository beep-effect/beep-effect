/**
 * Proof: `sanitizedToolkit` suppresses raw tool `parameters` from reaching
 * span attributes end-to-end through the real `McpServer.callTool` dispatch
 * surface — not just the low-level `withSanitizedToolSpan` primitive tested
 * in `SanitizedSpan.test.ts` — including when dispatch happens later, outside
 * the effect that registered the toolkit (mirrors how a real stdio transport
 * loop invokes `callTool` from its own, separately-scoped request handling).
 *
 * @since 0.0.0
 */
import { CurrentMcpCaller, sanitizedToolkit } from "@beep/mcp-kit";
import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { Tool, Toolkit } from "effect/unstable/ai";
import { McpServerClient } from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { HttpServerRequest } from "effect/unstable/http";

const FixtureTool = Tool.make("fixture_tool", {
  parameters: S.Struct({ secret: S.String }),
  success: S.String,
});

class ExpectedFixtureFailure extends TaggedErrorClass<ExpectedFixtureFailure>("ExpectedFixtureFailure")(
  "ExpectedFixtureFailure",
  { message: S.String }
) {}

const ExpectedFailureTool = Tool.make("expected_failure_tool", {
  failure: ExpectedFixtureFailure,
  failureMode: "return",
  success: S.String,
});

class RefParameters extends S.Class<RefParameters>("RefParameters")({
  secret: S.String,
}) {}

const RefTool = Tool.make("ref_tool", {
  parameters: RefParameters,
  success: S.String,
});

const CallerTool = Tool.make("caller_tool", { success: S.String });

const FixtureToolkit = Toolkit.make(FixtureTool, ExpectedFailureTool, CallerTool);

const RefToolkit = Toolkit.make(RefTool);

const FixtureHandlersLive = FixtureToolkit.toLayer({
  // Returns what the sanitized dispatch put on `CurrentMcpCaller`, so each
  // test reads its own dispatch's result rather than shared mutable state.
  caller_tool: Effect.fn("SanitizedToolkitTest.callerTool")(function* () {
    const caller = yield* CurrentMcpCaller;
    return O.match(caller, {
      onNone: () => "caller=none",
      onSome: (identity) => `client=${identity.clientId};session=${O.getOrElse(identity.sessionId, () => "none")}`,
    });
  }),
  expected_failure_tool: () => Effect.fail(ExpectedFixtureFailure.make({ message: "expected refusal" })),
  fixture_tool: (params: { readonly secret: string }) => Effect.succeed(`ok:${params.secret}`),
});

const RefHandlersLive = RefToolkit.toLayer({
  ref_tool: (params: RefParameters) => Effect.succeed(`ok:${params.secret}`),
});

interface RecordedAttribute {
  readonly key: string;
  readonly value: unknown;
}

const makeRecordingTracer = (): { readonly tracer: Tracer.Tracer; readonly captured: Array<RecordedAttribute> } => {
  const captured: Array<RecordedAttribute> = [];
  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      const original = span.attribute.bind(span);
      span.attribute = (key: string, value: unknown) => {
        captured.push({ key, value });
        original(key, value);
      };
      return span;
    },
  });
  return { captured, tracer };
};

// `sanitizedToolkit` mints a caller identity only when `McpServerClient` is in
// scope — the HTTP transport's own middleware provides it per request. Without
// this stub the identity is `None` and every session assertion below would pass
// vacuously.
const stubMcpClient = (clientId: number) =>
  McpServerClient.of({
    clientId,
    getClient: Effect.die("the fixture client is never dereferenced") as never,
    initializePayload: {
      capabilities: {},
      clientInfo: { name: "sanitized-toolkit-test", version: "0.0.0" },
      protocolVersion: "2025-06-18",
    } as never,
  });

// The tool's success payload is JSON-encoded into the first text content part.
const callerReport = (result: { readonly content: ReadonlyArray<unknown> }): string => {
  const [first] = result.content;
  return JSON.parse((first as { readonly text: string }).text) as string;
};

const withMcpClient = (clientId: number) => Effect.provideService(McpServerClient, stubMcpClient(clientId));

const withSessionHeader = (sessionId: string) =>
  Effect.provideService(
    HttpServerRequest.HttpServerRequest,
    HttpServerRequest.fromWeb(
      new Request("http://localhost/mcp", { headers: { "mcp-session-id": sessionId }, method: "POST" })
    )
  );

const registrationLayer = sanitizedToolkit(FixtureToolkit).pipe(Layer.provide(FixtureHandlersLive));
const fullLayer = Layer.mergeAll(McpServer.McpServer.layer, registrationLayer);
const refRegistrationLayer = sanitizedToolkit(RefToolkit).pipe(Layer.provide(RefHandlersLive));
const refFullLayer = Layer.mergeAll(McpServer.McpServer.layer, refRegistrationLayer);

describe("sanitizedToolkit", () => {
  layer(fullLayer)("with the fixture toolkit registered via sanitizedToolkit", (it) => {
    it.effect(
      "suppresses raw tool parameters from reaching span attributes on real McpServer dispatch",
      Effect.fnUntraced(function* () {
        const { captured, tracer } = makeRecordingTracer();
        const server = yield* McpServer.McpServer;

        // No explicit span wrap at this call site -- proves sanitization is
        // baked into the registered handler itself, not dependent on ambient
        // tracer state at layer-build time (the layer above is memoized and
        // built once, shared across both tests in this suite).
        const result = yield* Effect.withTracer(
          server.callTool({ name: "fixture_tool", arguments: { secret: "super-secret-value" } }),
          tracer
        );

        assert.isFalse(result.isError);

        const parameterAttribute = captured.find((entry) => entry.key === "parameters");
        assert.isUndefined(parameterAttribute);

        const toolAttribute = captured.find((entry) => entry.key === "tool");
        assert.strictEqual(toolAttribute?.value, "fixture_tool");
      })
    );

    it.effect(
      "still dispatches successfully and preserves the tool's real result",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "fixture_tool", arguments: { secret: "value" } });

        assert.isFalse(result.isError);
        const [first] = result.content;
        assert.strictEqual(first?.type, "text");
        assert.strictEqual((first as { readonly text: string }).text, '"ok:value"');
      })
    );

    it.effect(
      "keeps typed failures other than api_key_required classified as tool errors",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "expected_failure_tool", arguments: {} });
        const failure = yield* S.decodeUnknownEffect(ExpectedFixtureFailure)(result.structuredContent);

        assert.isTrue(result.isError);
        assert.strictEqual(failure._tag, "ExpectedFixtureFailure");
        assert.strictEqual(failure.message, "expected refusal");
      })
    );

    it.effect(
      "does not expose schema stacks or local paths in boundary error text",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "fixture_tool", arguments: { secret: 1 } });
        const [first] = result.content;

        assert.isTrue(result.isError);
        assert.strictEqual(first?.type, "text");
        assert.strictEqual(
          (first as { readonly text: string }).text,
          "Tool call failed before producing a structured result."
        );
      })
    );

    it.effect(
      "reports no session id when the dispatch carries no HTTP request",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "caller_tool", arguments: {} }).pipe(withMcpClient(7));

        // The session id comes from the `mcp-session-id` request header, so a
        // dispatch with no HTTP request in scope — a direct `callTool`, or a
        // stdio transport, where the connection itself is the session —
        // reports `none` rather than inventing one. The caller identity still
        // exists (asserted here, so the missing session is the header's
        // absence and not a missing client), and consumers key on the client
        // id instead.
        assert.strictEqual(callerReport(result), "client=7;session=none");
      })
    );

    it.effect(
      "surfaces the mcp-session-id header to the handler as the caller's session id",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;

        // The header must be read from the request fiber, before dispatch
        // replaces the context with the layer-build services — so this asserts
        // the read happens on the right side of that boundary. It is the only
        // stable per-session key a dispatch can see: the HTTP protocol mints
        // `clientId` per request.
        const result = yield* server
          .callTool({ name: "caller_tool", arguments: {} })
          .pipe(withSessionHeader("session-under-test"), withMcpClient(11));

        assert.strictEqual(callerReport(result), "client=11;session=session-under-test");
      })
    );

    it.effect(
      "treats an empty mcp-session-id header as absent",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;

        const result = yield* server
          .callTool({ name: "caller_tool", arguments: {} })
          .pipe(withSessionHeader(""), withMcpClient(13));

        // An empty header is not a session: keying run state on "" would merge
        // every such caller into one shared run.
        assert.strictEqual(callerReport(result), "client=13;session=none");
      })
    );
  });

  layer(refFullLayer)("with a named schema parameter toolkit registered via sanitizedToolkit", (it) => {
    it.effect(
      "adds a top-level object type to ref-backed input schemas for strict MCP clients",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const registered = server.tools.find(({ tool }) => tool.name === "ref_tool");

        assert.isDefined(registered);
        const inputSchema = registered?.tool.inputSchema as { readonly $ref?: unknown; readonly type?: unknown };
        assert.strictEqual(inputSchema.type, "object");
        assert.strictEqual(inputSchema.$ref, "#/$defs/RefParametersJsonEncoding");
      })
    );
  });
});
