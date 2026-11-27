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
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { McpServerClient } from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { fixtureHost } from "./fixtures/FixtureHost.ts";
import { makeStubMcpClient, StubMcpClientLayer } from "./fixtures/McpClient.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const FixtureTool = Tool.make("fixture_tool", {
  parameters: S.Struct({ secret: S.String }),
  success: S.String,
});

class ExpectedFixtureFailure extends S.TaggedError<ExpectedFixtureFailure, { readonly brand: unique symbol }>()(
  "ExpectedFixtureFailure",
  {
    message: S.String,
  }
) {}
const decodeUnknownExpectedFixtureFailure = S.decodeUnknownEffect(ExpectedFixtureFailure);

const ExpectedFailureTool = Tool.make("expected_failure_tool", {
  failure: ExpectedFixtureFailure,
  failureMode: "return",
  success: S.String,
});

class RefParameters extends S.Opaque<RefParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    secret: S.String,
  }).annotate({ identifier: "RefParameters" })
) {}

const RefTool = Tool.make("ref_tool", {
  parameters: RefParameters,
  success: S.String,
});

class EmptyParameters extends S.Opaque<EmptyParameters, { readonly brand: unique symbol }>()(
  S.Struct({}).annotate({ identifier: "EmptyParameters" })
) {}

const EmptyParamsTool = Tool.make("empty_params_tool", {
  parameters: EmptyParameters,
  success: S.String,
});

const CallerTool = Tool.make("caller_tool", { success: S.String });

const AnnotatedTool = Tool.make("annotated_tool", {
  description: "Annotated fixture tool",
  success: S.String,
}).annotate(Tool.Meta, { fixture: true });

class DeclaredErrorFailure extends S.TaggedError<DeclaredErrorFailure, { readonly brand: unique symbol }>()(
  "DeclaredErrorFailure",
  {
    message: S.String,
  }
) {}

const DeclaredErrorTool = Tool.make("declared_error_tool", {
  failure: DeclaredErrorFailure,
  success: S.String,
});

const RefinedFailureTool = Tool.make("refined_failure_tool", {
  failure: S.Int,
  parameters: S.Struct({ declared: S.Boolean }),
  success: S.String,
});

const DieTool = Tool.make("die_tool", { success: S.String });

const InterruptTool = Tool.make("interrupt_tool", { success: S.String });

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

const callerReport = <A = string>(result: { readonly content: ReadonlyArray<unknown> }): A => {
  const [first] = result.content;
  return Result.getOrThrowWith(S.decodeResult(UnknownJson)((first as { readonly text: string }).text), identity) as A;
};

const withSessionClient = (clientId: number) => Effect.provideService(McpServerClient, makeStubMcpClient(clientId));

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
  it.layer(fullLayer, { timeout: "5 seconds" })("with the fixture toolkit registered via sanitizedToolkit", (it) => {
    it.effect(
      "suppresses raw tool parameters from span attributes on real McpServer dispatch, with no span wrap at the call site",
      Effect.fnUntraced(function* () {
        const { captured, tracer } = makeRecordingTracer();
        const server = yield* McpServer.McpServer;

        const result = yield* Effect.withTracer(
          server
            .callTool({ name: "fixture_tool", arguments: { secret: "super-secret-value" } })
            .pipe(Effect.provideService(Toolkit.RecordToolArguments, true)),
          tracer
        );

        assert.isFalse(result.isError);

        assertNone(
          A.findFirst(captured, (entry) => entry.key === "parameters" || entry.key === "gen_ai.tool.call.arguments")
        );

        assertSome(
          O.map(
            A.findFirst(captured, (entry) => entry.key === "gen_ai.tool.name"),
            (entry) => entry.value
          ),
          "fixture_tool"
        );
      })
    );

    it.effect(
      "registers described tools with their wire description, _meta and outputSchema",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const entry = O.getOrThrow(A.findFirst(server.tools, (candidate) => candidate.tool.name === "annotated_tool"));

        assert.strictEqual(entry.tool.description, "Annotated fixture tool");
        assert.deepStrictEqual(entry.tool._meta, { fixture: true });
        assert.deepStrictEqual(entry.tool.outputSchema, { type: "string" });

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
        const failure = yield* decodeUnknownExpectedFixtureFailure(callerReport(result));

        assert.isTrue(result.isError);
        assert.isUndefined(
          result.structuredContent,
          "a declared failure travels in content[].text; structuredContent must conform to outputSchema"
        );
        assert.strictEqual(failure._tag, "ExpectedFixtureFailure");
        assert.strictEqual(failure.message, "expected refusal");
      })
    );

    it.effect(
      "invalid arguments surface as InvalidParams",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const error = yield* Effect.flip(server.callTool({ name: "fixture_tool", arguments: { secret: 1 } }));

        assert.isTrue(P.isTagged(error, "InvalidParams"), "parameter validation is a JSON-RPC error, no canned result");
      })
    );

    it.effect(
      "dispatches tools/call on a 2025 host through McpServerClient and reports no session id without an HTTP request",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "caller_tool", arguments: {} }).pipe(withSessionClient(7));

        assert.strictEqual(
          callerReport(result),
          "client=7;session=none",
          "without an HTTP request there is no mcp-session-id header, yet the caller identity still exists"
        );
      })
    );

    it.effect(
      "surfaces the mcp-session-id header to the handler as the caller's session id",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;

        const result = yield* server
          .callTool({ name: "caller_tool", arguments: {} })
          .pipe(withSessionHeader("session-under-test"), withSessionClient(11));

        assert.strictEqual(
          callerReport(result),
          "client=11;session=session-under-test",
          "the header is read from the request fiber, before dispatch swaps in the layer-build context"
        );
      })
    );

    it.effect(
      "treats an empty mcp-session-id header as absent",
      Effect.fnUntraced(function* () {
        const server = yield* McpServer.McpServer;

        const result = yield* server
          .callTool({ name: "caller_tool", arguments: {} })
          .pipe(withSessionHeader(""), withSessionClient(13));

        assert.strictEqual(
          callerReport(result),
          "client=13;session=none",
          'keying run state on "" would merge every empty-header caller into one run'
        );
      })
    );
  });

  it.layer(refFullLayer, { timeout: "5 seconds" })(
    "with a named schema parameter toolkit registered via sanitizedToolkit",
    (it) => {
      it.effect(
        "inlines a ref-backed input schema to an object root for strict MCP clients",
        Effect.fnUntraced(function* () {
          const server = yield* McpServer.McpServer;
          const registered = O.getOrThrow(A.findFirst(server.tools, ({ tool }) => tool.name === "ref_tool"));

          const inputSchema = registered.tool.inputSchema as {
            readonly $ref?: unknown;
            readonly type?: unknown;
            readonly properties?: Record<string, unknown>;
          };
          assert.strictEqual(
            inputSchema.type,
            "object",
            "the root is the object itself; the definition stays in $defs"
          );
          assert.isUndefined(inputSchema.$ref);
          assert.isDefined(inputSchema.properties?.secret);
        })
      );

      it.effect(
        "adds a top-level object type to a no-argument tool's input schema",
        Effect.fnUntraced(function* () {
          const server = yield* McpServer.McpServer;
          const registered = O.getOrThrow(A.findFirst(server.tools, ({ tool }) => tool.name === "empty_params_tool"));

          const inputSchema = registered.tool.inputSchema as { readonly type?: unknown };
          assert.strictEqual(
            inputSchema.type,
            "object",
            "an empty parameter class renders as anyOf [object, array]; registration validates a top-level type"
          );
        })
      );
    }
  );

  it.layer(failureFullLayer, { timeout: "5 seconds" })(
    "with the failure-classification toolkit registered via sanitizedToolkit",
    (it) => {
      it.effect(
        "answers a declared Error failure with its message",
        Effect.fnUntraced(function* () {
          const server = yield* McpServer.McpServer;
          const result = yield* server.callTool({ name: "declared_error_tool", arguments: {} });

          assert.isTrue(result.isError);
          const [first] = result.content;
          assert.strictEqual(
            (first as { readonly text: string }).text,
            "declared refusal",
            "an Error failure answers with its message, not its encoded payload"
          );
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

          const undeclared = yield* server.callTool({
            arguments: { declared: false },
            name: "refined_failure_tool",
          });

          assert.isTrue(undeclared.isError);
          const [first] = undeclared.content;
          assert.strictEqual(
            (first as { readonly text: string }).text,
            "Tool call failed before producing a structured result.",
            "1.5 types as the declared failure but fails S.Int, so it is scrubbed to the boundary text"
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
        "propagates interruption instead of logging, reporting or answering it as a tool failure",
        Effect.fnUntraced(function* () {
          const server = yield* McpServer.McpServer;
          const exit = yield* Effect.exit(server.callTool({ name: "interrupt_tool", arguments: {} }));

          assertExitFailure(
            Exit.match(exit, {
              onSuccess: Exit.succeed,
              onFailure: (cause) =>
                Exit.failCause(
                  Cause.fromReasons(
                    A.map(cause.reasons, (reason) =>
                      Cause.isInterruptReason(reason) ? Cause.makeInterruptReason() : reason
                    )
                  )
                ),
            }),
            Cause.interrupt()
          );
        })
      );

      it.effect(
        "classifies a returned parameter failure as InvalidParams",
        Effect.fnUntraced(function* () {
          const server = yield* McpServer.McpServer;
          const error = yield* Effect.flip(
            server.callTool({ arguments: { count: "not-a-number" }, name: "lenient_params_tool" })
          );

          assert.isTrue(
            P.isTagged(error, "InvalidParams"),
            'under failureMode "return" the non-handler origin, not the envelope, decides the classification'
          );
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
          const registered = O.getOrThrow(A.findFirst(server.tools, ({ tool }) => tool.name === "dynamic_tool"));

          assert.deepStrictEqual(
            registered.tool.inputSchema,
            {
              type: "object",
              properties: { q: { type: "string" } },
            },
            "a dynamic tool's schema is the host's own document, never re-rendered"
          );

          const result = yield* server.callTool({ arguments: { q: "hi" }, name: "dynamic_tool" });
          assert.isFalse(result.isError);
        })
      );
    }
  );

  it.effect(
    "refuses to register a strict dynamic tool",
    Effect.fnUntraced(function* () {
      const exit = yield* StrictDynamicToolkit.pipe(
        sanitizedToolkit,
        Layer.provide(StrictDynamicHandlersLive),
        Layer.build,
        Effect.exit
      );

      assertExitFailure(
        exit,
        Cause.die(
          "sanitizedToolkit cannot strictly validate the raw JSON Schema for tool 'strict_dynamic_tool'; use an Effect Schema instead"
        )
      );
      assert.include(
        Cause.pretty(exit.cause),
        "strict_dynamic_tool",
        "strictness is a decode option with nothing to apply to, so the layer build fails"
      );
    })
  );

  it.layer(layerConformanceHttp(fixtureHost), { timeout: "5 seconds" })(
    "on a 2026-only host over streamable HTTP",
    (it) => {
      it.effect("dispatches tools/call on a 2026-only host with McpRequestContext and no McpServerClient", () =>
        Effect.gen(function* () {
          const { rpc } = yield* connectHttp();
          const result = yield* rpc["tools/call"]({ name: "caller_report", arguments: {} });

          assert.notStrictEqual(result.isError, true);
          assert.match(
            callerReport(result),
            /^client=\d+;session=none$/,
            "the stateless transport yields a per-POST client id and never a session"
          );
        })
      );
    }
  );
});

const templateLiteralReply = S.Struct({ content: S.NonEmptyArray(S.Struct({ text: S.String })) });

describe("named template literal tool schemas", () => {
  const identifier = S.TemplateLiteral([
    "item:",
    S.Union([S.Literal("a"), S.Literal("b")]).annotate({ identifier: "TemplatePrefix" }),
    ":",
    S.String.annotate({ identifier: "TemplateTail" }),
  ]);
  const tool = Tool.make("template_literal_tool", {
    parameters: S.Struct({ id: identifier }),
    success: S.Struct({ id: identifier }),
  });
  const toolkit = Toolkit.make(tool);
  const handlers = toolkit.toLayer(
    Effect.succeed(
      toolkit.of({
        template_literal_tool: Effect.fn("TemplateLiteralTool.echo")(({ id }) => Effect.succeed({ id })),
      })
    )
  );
  const layer = Layer.mergeAll(
    McpServer.McpServer.layer,
    sanitizedToolkit(toolkit).pipe(Layer.provide(handlers)),
    StubMcpClientLayer
  );
  it.layer(layer, { timeout: "30 seconds" })((it) => {
    it.effect("registers named scalar/union fragments in both schemas and retains runtime validation", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        const result = yield* server.callTool({ name: "template_literal_tool", arguments: { id: "item:a:42" } });
        const decoded = yield* S.decodeUnknownEffect(templateLiteralReply)(result);
        const value = yield* S.decodeEffect(S.fromJsonString(S.Struct({ id: identifier })))(
          A.headNonEmpty(decoded.content).text
        );
        assert.strictEqual(value.id, "item:a:42");
        const invalid = yield* Effect.exit(
          server.callTool({ name: "template_literal_tool", arguments: { id: "other:a:42" } })
        );
        invalid.pipe(Exit.isFailure, assertTrue);
      })
    );
  });
});
