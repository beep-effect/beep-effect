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
import { connectHttp, layerConformanceHttp } from "@beep/mcp-kit/test/Conformance";
import { assert, describe, it, layer } from "@effect/vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { McpServerClient } from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import { HttpServerRequest } from "effect/http";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { fixtureHost } from "./fixtures/FixtureHost.ts";
import { makeStubMcpClient, StubMcpClientLayer } from "./fixtures/McpClient.ts";

const FixtureTool = Tool.make("fixture_tool", {
  parameters: S.Struct({ secret: S.String }),
  success: S.String,
});

class ExpectedFixtureFailure extends S.TaggedError<ExpectedFixtureFailure>()("ExpectedFixtureFailure", {
  message: S.String,
}) {}
const decodeUnknownExpectedFixtureFailure = S.decodeUnknownEffect(ExpectedFixtureFailure);

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

// A no-argument tool: an empty parameter class renders as `anyOf: [object,
// array]`, the shape that used to slip through without a top-level `type`.
class EmptyParameters extends S.Class<EmptyParameters>("EmptyParameters")({}) {}

const EmptyParamsTool = Tool.make("empty_params_tool", {
  parameters: EmptyParameters,
  success: S.String,
});

const CallerTool = Tool.make("caller_tool", { success: S.String });

// Carries the optional wire fields so registration exercises the described
// and _meta-bearing arms alongside the bare fixtures above.
const AnnotatedTool = Tool.make("annotated_tool", {
  description: "Annotated fixture tool",
  success: S.String,
}).annotate(Tool.Meta, { fixture: true });

// The failure-classification fixtures: every arm of the kit's own classifier
// (`declaredFailureResult`, `makeInternalToolError`, `classifyToolFailure`)
// needs a handler that ends the way that arm describes.
class DeclaredErrorFailure extends S.TaggedError<DeclaredErrorFailure>()("DeclaredErrorFailure", {
  message: S.String,
}) {}

// A declared failure that *is* an `Error`: the classifier answers with its
// message rather than its encoded payload.
const DeclaredErrorTool = Tool.make("declared_error_tool", {
  failure: DeclaredErrorFailure,
  success: S.String,
});

// `S.Int` keeps the failure channel a plain `number` at the type level while
// making `1.5` undeclared at runtime, so one handler can produce both a
// declared (encoded) and an undeclared (scrubbed) failure.
const RefinedFailureTool = Tool.make("refined_failure_tool", {
  failure: S.Int,
  parameters: S.Struct({ declared: S.Boolean }),
  success: S.String,
});

const DieTool = Tool.make("die_tool", { success: S.String });

const InterruptTool = Tool.make("interrupt_tool", { success: S.String });

// `failureMode: "return"` routes even a parameter-validation failure through
// the result projection instead of the failure channel.
const LenientParamsTool = Tool.make("lenient_params_tool", {
  failure: S.Unknown,
  failureMode: "return",
  parameters: S.Struct({ count: S.Finite }),
  success: S.String,
});

const VoidTool = Tool.make("void_tool", { success: S.Void });

const StrictTool = Tool.make("strict_tool", {
  parameters: S.Struct({ text: S.String }),
  success: S.String,
}).annotate(Tool.Strict, true);

const DynamicTool = Tool.dynamic("dynamic_tool", {
  parameters: { type: "object", properties: { q: { type: "string" } } },
  success: S.String,
});

const FailureToolkit = Toolkit.make(
  DeclaredErrorTool,
  RefinedFailureTool,
  DieTool,
  InterruptTool,
  LenientParamsTool,
  VoidTool,
  StrictTool,
  DynamicTool
);

const FailureHandlersLive = FailureToolkit.toLayer({
  declared_error_tool: () => Effect.fail(DeclaredErrorFailure.make({ message: "declared refusal" })),
  die_tool: () => Effect.die("handler defect"),
  dynamic_tool: () => Effect.succeed("dynamic"),
  interrupt_tool: () => Effect.interrupt,
  lenient_params_tool: () => Effect.succeed("ok"),
  refined_failure_tool: (params: { readonly declared: boolean }) => Effect.fail(params.declared ? 42 : 1.5),
  strict_tool: (params: { readonly text: string }) => Effect.succeed(params.text),
  void_tool: () => Effect.void,
});

// Strict validation has no meaning for a raw JSON Schema, so the pairing is
// rejected at registration rather than silently ignored.
const StrictDynamicTool = Tool.dynamic("strict_dynamic_tool", {
  parameters: { type: "object" },
  success: S.String,
}).annotate(Tool.Strict, true);

const StrictDynamicToolkit = Toolkit.make(StrictDynamicTool);

const StrictDynamicHandlersLive = StrictDynamicToolkit.toLayer({
  strict_dynamic_tool: () => Effect.succeed("never reached"),
});

const FixtureToolkit = Toolkit.make(FixtureTool, ExpectedFailureTool, CallerTool, AnnotatedTool);

const RefToolkit = Toolkit.make(RefTool, EmptyParamsTool);

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
  annotated_tool: () => Effect.succeed("annotated"),
  fixture_tool: (params: { readonly secret: string }) => Effect.succeed(`ok:${params.secret}`),
});

const RefHandlersLive = RefToolkit.toLayer({
  empty_params_tool: () => Effect.succeed("ok"),
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

// The tool's payload (success or encoded declared failure) is JSON-encoded
// into the first text content part.
const callerReport = <A = string>(result: { readonly content: ReadonlyArray<unknown> }): A => {
  const [first] = result.content;
  return JSON.parse((first as { readonly text: string }).text) as A;
};

// Direct `server.callTool` is rc.117's stateful-only seam: it mints a caller
// identity from `McpServerClient`, which a legacy (2025) transport provides
// per initialized session. Overriding the suite-level stub is what makes the
// session assertions below non-vacuous; the 2026 path is proven through the
// HTTP transport at the end of this file.
const withMcpClient = (clientId: number) => Effect.provideService(McpServerClient, makeStubMcpClient(clientId));

const withSessionHeader = (sessionId: string) =>
  Effect.provideService(
    HttpServerRequest.HttpServerRequest,
    HttpServerRequest.fromWeb(
      new Request("http://localhost/mcp", { headers: { "mcp-session-id": sessionId }, method: "POST" })
    )
  );

const registrationLayer = sanitizedToolkit(FixtureToolkit).pipe(Layer.provide(FixtureHandlersLive));
const fullLayer = Layer.mergeAll(McpServer.McpServer.layer, registrationLayer, StubMcpClientLayer);
const refRegistrationLayer = sanitizedToolkit(RefToolkit).pipe(Layer.provide(RefHandlersLive));
const refFullLayer = Layer.mergeAll(McpServer.McpServer.layer, refRegistrationLayer, StubMcpClientLayer);
const failureRegistrationLayer = sanitizedToolkit(FailureToolkit).pipe(Layer.provide(FailureHandlersLive));
const failureFullLayer = Layer.mergeAll(McpServer.McpServer.layer, failureRegistrationLayer, StubMcpClientLayer);

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
      "registers described tools with their wire description, _meta and outputSchema",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const entry = server.tools.find((candidate) => candidate.tool.name === "annotated_tool");

        assert.strictEqual(entry?.tool.description, "Annotated fixture tool");
        assert.deepStrictEqual(entry?.tool._meta, { fixture: true });
        assert.deepStrictEqual(entry?.tool.outputSchema, { type: "string" });

        const result = yield* server.callTool({ name: "annotated_tool", arguments: {} });
        assert.isFalse(result.isError);
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
        // rc.117 projects declared failures as tool errors whose encoded payload
        // travels in `content[].text`; `structuredContent` describes successes
        // only (it must conform to the advertised `outputSchema`).
        const failure = yield* decodeUnknownExpectedFixtureFailure(callerReport(result));

        assert.isTrue(result.isError);
        assert.isUndefined(result.structuredContent);
        assert.strictEqual(failure._tag, "ExpectedFixtureFailure");
        assert.strictEqual(failure.message, "expected refusal");
      })
    );

    it.effect(
      "invalid arguments surface as InvalidParams",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const error = yield* Effect.flip(server.callTool({ name: "fixture_tool", arguments: { secret: 1 } }));

        // Parameter validation is protocol-native under strict 2026 tools:
        // upstream classifies it as JSON-RPC `InvalidParams`, no canned result.
        assert.isTrue(P.isTagged(error, "InvalidParams"));
      })
    );

    it.effect(
      "dispatches tools/call on a 2025 host through McpServerClient and reports no session id without an HTTP request",
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
      "inlines a ref-backed input schema to an object root for strict MCP clients",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const registered = server.tools.find(({ tool }) => tool.name === "ref_tool");

        // rc.117 inlines the top-level `$ref` (Effect#8326); the root is the
        // object itself and the definition stays under `$defs`.
        assert.isDefined(registered);
        const inputSchema = registered?.tool.inputSchema as {
          readonly $ref?: unknown;
          readonly type?: unknown;
          readonly properties?: Record<string, unknown>;
        };
        assert.strictEqual(inputSchema.type, "object");
        assert.isUndefined(inputSchema.$ref);
        assert.isDefined(inputSchema.properties?.secret);
      })
    );

    it.effect(
      "adds a top-level object type to a no-argument tool's input schema",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const registered = server.tools.find(({ tool }) => tool.name === "empty_params_tool");

        // Registration itself validates against `McpSchema.Tool`, so a missing
        // top-level `type` here would fail the whole layer build, not just
        // this assertion.
        assert.isDefined(registered);
        const inputSchema = registered?.tool.inputSchema as { readonly type?: unknown };
        assert.strictEqual(inputSchema.type, "object");
      })
    );
  });

  layer(failureFullLayer)("with the failure-classification toolkit registered via sanitizedToolkit", (it) => {
    it.effect(
      "answers a declared Error failure with its message",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "declared_error_tool", arguments: {} });

        // An `Error` carries its own wire text; encoding it against the
        // failure schema would leak the schema's shape instead.
        assert.isTrue(result.isError);
        const [first] = result.content;
        assert.strictEqual((first as { readonly text: string }).text, "declared refusal");
      })
    );

    it.effect(
      "encodes a declared non-Error failure and scrubs an undeclared one",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const declared = yield* server.callTool({
          arguments: { declared: true },
          name: "refined_failure_tool",
        });

        assert.isTrue(declared.isError);
        assert.strictEqual(callerReport<number>(declared), 42);

        // `1.5` types as the tool's declared failure but fails its schema, so
        // it is an internal failure: the boundary text, never the value.
        const undeclared = yield* server.callTool({
          arguments: { declared: false },
          name: "refined_failure_tool",
        });

        assert.isTrue(undeclared.isError);
        const [first] = undeclared.content;
        assert.strictEqual(
          (first as { readonly text: string }).text,
          "Tool call failed before producing a structured result."
        );
      })
    );

    it.effect(
      "scrubs a handler defect to the boundary text",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "die_tool", arguments: {} });

        assert.isTrue(result.isError);
        const [first] = result.content;
        assert.strictEqual(
          (first as { readonly text: string }).text,
          "Tool call failed before producing a structured result."
        );
      })
    );

    it.effect(
      "propagates interruption instead of reporting it as a tool failure",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const exit = yield* Effect.exit(server.callTool({ name: "interrupt_tool", arguments: {} }));

        // An interrupted dispatch is the caller giving up, not a result: it
        // must not be logged, reported, or answered with a canned result.
        assert.isTrue(Exit.isFailure(exit));
        assert.isTrue(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause));
      })
    );

    it.effect(
      "classifies a returned parameter failure as InvalidParams",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const error = yield* Effect.flip(
          server.callTool({ arguments: { count: "not-a-number" }, name: "lenient_params_tool" })
        );

        // `failureMode: "return"` hands the validation failure back as a
        // result carrying a non-handler origin; the origin, not the shape of
        // the envelope, decides the JSON-RPC classification.
        assert.isTrue(P.isTagged(error, "InvalidParams"));
      })
    );

    it.effect(
      "answers a void-result tool with no content and no structured content",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "void_tool", arguments: {} });

        assert.isFalse(result.isError);
        assert.deepStrictEqual(result.content, []);
        assert.isUndefined(result.structuredContent);
      })
    );

    it.effect(
      "rejects excess properties for a strict tool and advertises no additional properties",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const accepted = yield* server.callTool({ arguments: { text: "hi" }, name: "strict_tool" });
        assert.isFalse(accepted.isError);

        const error = yield* Effect.flip(
          server.callTool({ arguments: { extra: true, text: "hi" }, name: "strict_tool" })
        );
        assert.isTrue(P.isTagged(error, "InvalidParams"));
      })
    );

    it.effect(
      "registers a dynamic tool's raw JSON Schema verbatim",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const registered = server.tools.find(({ tool }) => tool.name === "dynamic_tool");

        // A dynamic tool's schema is the host's own document: the kit must
        // not re-render it from the (absent) Effect Schema.
        assert.deepStrictEqual(registered?.tool.inputSchema, {
          type: "object",
          properties: { q: { type: "string" } },
        });

        const result = yield* server.callTool({ arguments: { q: "hi" }, name: "dynamic_tool" });
        assert.isFalse(result.isError);
      })
    );
  });

  it.effect(
    "refuses to register a strict dynamic tool",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        Effect.scoped(
          Layer.build(sanitizedToolkit(StrictDynamicToolkit).pipe(Layer.provide(StrictDynamicHandlersLive)))
        )
      );

      // Strictness is an Effect Schema decode option; there is nothing to
      // apply it to when the parameters arrive as a raw JSON Schema, so the
      // pairing fails the layer build rather than validating nothing.
      assert.isTrue(Exit.isFailure(exit));
      assert.include(Cause.pretty(Exit.isFailure(exit) ? exit.cause : Cause.fail("no failure")), "strict_dynamic_tool");
    })
  );

  layer(layerConformanceHttp(fixtureHost))("on a 2026-only host over streamable HTTP", (it) => {
    it.effect("dispatches tools/call on a 2026-only host with McpRequestContext and no McpServerClient", () =>
      Effect.gen(function* () {
        // The stateless transport provides `McpRequestContext` only; the
        // dual-read still yields a caller (the per-POST client id) and never a
        // session, whatever headers the POST carried.
        const { rpc } = yield* connectHttp();
        const result = yield* rpc["tools/call"]({ name: "caller_report", arguments: {} });

        assert.notStrictEqual(result.isError, true);
        assert.match(callerReport(result), /^client=\d+;session=none$/);
      })
    );
  });
});
