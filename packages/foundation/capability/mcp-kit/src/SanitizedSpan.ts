/**
 * Sanitized-span wrapper.
 *
 * Upstream `Toolkit.ts:263-265` annotates the current span with the tool's
 * raw, undecoded call `parameters` before decoding or validation runs:
 * `Effect.annotateCurrentSpan({ tool: name, parameters: params })`. Doctrine
 * `standards/architecture/12-observability.md` §3 forbids raw user input on
 * spans. `Effect.annotateCurrentSpan` mutates whatever `Tracer.Span` object
 * is already the fiber's current span (`fiber.currentSpanLocal`) — it does
 * not re-resolve the `Tracer` service — so suppressing the attribute
 * requires the current span itself to already be a filtering wrapper by the
 * time `Toolkit`'s dispatch runs.
 *
 * {@link withSanitizedToolSpan} does exactly that: it wraps the ambient
 * `Tracer` in a filtering proxy and opens a **new** span through that proxy
 * around the wrapped effect, so the span that becomes current for the
 * toolkit dispatch is already filtering.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { Context, Effect, Layer, Sink, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CallToolResult, McpServerClient, Tool as WireTool } from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as AiTool from "effect/unstable/ai/Tool";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { ApiKeyRequiredFailure } from "./ApiKeyRequired.ts";
import { CurrentMcpCaller, McpCallerIdentity } from "./McpCaller.ts";
import type * as Tracer from "effect/Tracer";
import type * as Toolkit from "effect/unstable/ai/Toolkit";

/**
 * Span attribute keys suppressed by default: the raw, undecoded tool call
 * parameters set by upstream `Toolkit.ts:263-265`.
 *
 * **Example** (Log default sanitized keys)
 *
 * ```ts
 * import { defaultSanitizedSpanKeys } from "@beep/mcp-kit"
 *
 * console.log(defaultSanitizedSpanKeys)
 * // ["parameters"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultSanitizedSpanKeys: ReadonlyArray<string> = ["parameters"];

/**
 * Wraps a `Tracer` so that any span it creates suppresses attribute values
 * set under the given keys, while every other attribute passes through
 * unchanged.
 *
 * **Example** (Wrap tracer suppressing keys)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { sanitizeTracerAttributes } from "@beep/mcp-kit"
 *
 * const program = Effect.gen(function* () {
 *   const tracer = yield* Effect.tracer
 *   const sanitized = sanitizeTracerAttributes(tracer, ["parameters"])
 *   return typeof sanitized.span
 * })
 * console.log(Effect.runSync(program))
 * // "function"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const sanitizeTracerAttributes: {
  (sanitizedKeys?: ReadonlyArray<string>): (tracer: Tracer.Tracer) => Tracer.Tracer;
  (tracer: Tracer.Tracer, sanitizedKeys?: ReadonlyArray<string>): Tracer.Tracer;
} = dual(
  (args) => args.length >= 1 && (args.length >= 2 || !A.isArray(args[0])),
  (tracer: Tracer.Tracer, sanitizedKeys: ReadonlyArray<string> = defaultSanitizedSpanKeys): Tracer.Tracer => ({
    ...tracer,
    span(options) {
      const span = tracer.span(options);
      // Span implementations (e.g. `NativeSpan`) define their methods on the
      // class prototype, so a shallow `{ ...span }` spread would silently drop
      // `end`/`event`/`addLinks` (only own instance fields survive a spread).
      // Every member below is an explicit delegate so the wrapper stays a
      // fully conformant `Span`, with `attribute` the only overridden method.
      return {
        get _tag() {
          return span._tag;
        },
        get name() {
          return span.name;
        },
        get spanId() {
          return span.spanId;
        },
        get traceId() {
          return span.traceId;
        },
        get parent() {
          return span.parent;
        },
        get annotations() {
          return span.annotations;
        },
        get status() {
          return span.status;
        },
        get attributes() {
          return span.attributes;
        },
        get links() {
          return span.links;
        },
        get sampled() {
          return span.sampled;
        },
        get kind() {
          return span.kind;
        },
        end: (endTime: bigint, exit) => span.end(endTime, exit),
        attribute: (key: string, value: unknown) => {
          if (A.contains(sanitizedKeys, key)) {
            return;
          }
          span.attribute(key, value);
        },
        event: (name: string, startTime: bigint, attributes?: Record<string, unknown>) =>
          span.event(name, startTime, attributes),
        addLinks: (links) => span.addLinks(links),
      };
    },
  })
);

/**
 * Runs `effect` inside a freshly opened span named `spanName`, created
 * through a sanitizing tracer that suppresses `sanitizedKeys` (default:
 * {@link defaultSanitizedSpanKeys}) on every attribute set during the span's
 * lifetime — including the raw `parameters` attribute upstream `Toolkit`
 * dispatch sets via `Effect.annotateCurrentSpan`.
 *
 * **When to use**
 *
 * Wrap MCP `tools/call` dispatch (e.g. around `built.handle(name, params)`
 * or `McpServer.callTool(...)`) with this combinator so tool parameters
 * never reach exported span attributes.
 *
 * **Example** (Run under sanitized span)
 *
 * ```ts import.meta.vitest name="Run under sanitized span"
 * import { Effect } from "effect"
 * import { withSanitizedToolSpan } from "@beep/mcp-kit"
 *
 * const program = withSanitizedToolSpan(Effect.annotateCurrentSpan({ parameters: { secret: "x" } }), "mcp.tool.call")
 * Effect.runSync(program) // => undefined
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withSanitizedToolSpan: {
  <A, E, R>(
    spanName: string,
    options?: { readonly sanitizedKeys?: ReadonlyArray<string> }
  ): (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    spanName: string,
    options?: { readonly sanitizedKeys?: ReadonlyArray<string> }
  ): Effect.Effect<A, E, R>;
} = dual(
  (args) => Effect.isEffect(args[0]),
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    spanName: string,
    options?: { readonly sanitizedKeys?: ReadonlyArray<string> }
  ): Effect.Effect<A, E, R> =>
    Effect.flatMap(Effect.tracer, (tracer) =>
      Effect.withTracer(
        Effect.withSpan(effect, spanName),
        sanitizeTracerAttributes(tracer, options?.sanitizedKeys ?? defaultSanitizedSpanKeys)
      )
    )
);

type JsonObject = Readonly<Record<string, unknown>>;

// The session header upstream mints at `initialize` and echoes on every later
// request of the same MCP session (`McpServer.ts` `mcpSessionIdHeader`), which
// upstream keeps private.
const mcpSessionIdHeader = "mcp-session-id";

const localDefsRefPrefix = "#/$defs/";
const toolBoundaryFailureText = "Tool call failed before producing a structured result.";
const isApiKeyRequiredFailure = S.is(ApiKeyRequiredFailure);

const isJsonObject = (value: unknown): value is JsonObject => P.isObject(value) && !A.isArray(value);

const decodeJsonPointerSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");

const localDefsRefKey = (ref: unknown): O.Option<string> =>
  P.isString(ref) && ref.startsWith(localDefsRefPrefix)
    ? O.some(decodeJsonPointerSegment(ref.slice(localDefsRefPrefix.length)))
    : O.none();

const localDefsRefTarget = (schema: JsonObject): O.Option<JsonObject> =>
  O.flatMap(localDefsRefKey(schema.$ref), (key) => {
    const defs = schema.$defs;
    return isJsonObject(defs) && isJsonObject(defs[key]) ? O.some(defs[key]) : O.none();
  });

// A parameter class with no fields renders as `anyOf: [object, array]` rather
// than a bare `type: "object"`, so the object branch has to be recognized too —
// otherwise a no-argument tool produces an inputSchema with no top-level `type`
// and fails `McpSchema.Tool`'s validation at registration.
const isObjectInputTarget = (target: JsonObject): boolean =>
  target.type === "object" ||
  (A.isArray(target.anyOf) && target.anyOf.some((branch) => isJsonObject(branch) && branch.type === "object"));

const withTopLevelObjectInputSchema = (schema: JsonObject): JsonObject =>
  schema.type === "object" || !O.exists(localDefsRefTarget(schema), isObjectInputTarget)
    ? schema
    : { type: "object", ...schema };

const registerSanitizedToolkit = Effect.fnUntraced(function* <Tools extends Record<string, AiTool.Any>>(
  toolkit: Toolkit.Toolkit<Tools>
) {
  const registry = yield* McpServer.McpServer;
  const built = yield* toolkit as unknown as Effect.Effect<
    Toolkit.WithHandler<Tools>,
    never,
    Exclude<AiTool.HandlersFor<Tools>, McpServerClient>
  >;
  const services = yield* Effect.context<never>();
  for (const tool of R.values<string, AiTool.Any>(built.tools)) {
    const annotations = tool.annotations;
    const toolMeta = Context.getOrUndefined(annotations, AiTool.Meta);
    const wireTool = WireTool.make({
      name: tool.name,
      description: AiTool.getDescription(tool),
      inputSchema: withTopLevelObjectInputSchema(AiTool.getJsonSchema(tool)),
      annotations: {
        ...Context.getOption(annotations, AiTool.Title).pipe(
          O.map((title) => ({ title })),
          O.getOrUndefined
        ),
        readOnlyHint: Context.get(annotations, AiTool.Readonly),
        destructiveHint: Context.get(annotations, AiTool.Destructive),
        idempotentHint: Context.get(annotations, AiTool.Idempotent),
        openWorldHint: Context.get(annotations, AiTool.OpenWorld),
      },
      _meta: toolMeta,
    });
    yield* registry.addTool({
      tool: wireTool,
      annotations,
      // Contextually typed from `addTool`'s own `handle: (payload: any) => ...`
      // parameter position (mirrors upstream McpServer.registerToolkit,
      // effect/unstable/ai/McpServer.ts:711); dispatch is looked up by tool
      // name at runtime, so no narrower parameter type is available here.
      handle: Effect.fn("McpKit.handle")(function* (payload) {
        const client = yield* Effect.serviceOption(McpServerClient);
        // Read the session header here, at the request boundary, rather than
        // inside the handler. `provideContext` below *merges* — the provided
        // services win on key collisions and request-only services survive
        // (`internal/effect.ts`: `updateContext(self, Context.merge(context))`,
        // measured 2026-07-27) — so `HttpServerRequest` would still be
        // reachable downstream. Reading it once, here, keeps the caller
        // identity a fact of the dispatch instead of something each handler
        // rediscovers. `clientId` is minted per request by the HTTP protocol,
        // so this header is the only stable per-session key a dispatch sees.
        const httpRequest = yield* Effect.serviceOption(HttpServerRequest.HttpServerRequest);
        const sessionId = O.flatMap(httpRequest, (request) =>
          O.filter(Headers.get(request.headers, mcpSessionIdHeader), Str.isNonEmpty)
        );
        const requestServices = Context.add(
          services,
          CurrentMcpCaller,
          O.map(client, (current) =>
            McpCallerIdentity.make({ clientId: NonNegativeInt.make(current.clientId), sessionId })
          )
        );
        return yield* withSanitizedToolSpan(built.handle(tool.name, payload), `mcp.tool.call.${tool.name}`).pipe(
          Stream.unwrap,
          Stream.run(Sink.last()),
          Effect.flatMap(Effect.fromOption),
          Effect.provideContext(requestServices),
          Effect.tapCause(Effect.log),
          Effect.matchCauseEffect({
            onFailure: () =>
              Effect.succeed(
                CallToolResult.make({ isError: true, content: [{ type: "text", text: toolBoundaryFailureText }] })
              ),
            onSuccess: (result: {
              readonly encodedResult: unknown;
              readonly isFailure: boolean;
              readonly result: unknown;
            }) =>
              UnknownFromJsonString.encodeUnknownEffect(result.encodedResult).pipe(
                Effect.tapCause(Effect.log),
                Effect.matchCause({
                  onFailure: () =>
                    CallToolResult.make({ isError: true, content: [{ type: "text", text: toolBoundaryFailureText }] }),
                  onSuccess: (text) =>
                    CallToolResult.make({
                      isError: result.isFailure && !isApiKeyRequiredFailure(result.result),
                      structuredContent: P.isObject(result.encodedResult) ? result.encodedResult : undefined,
                      content: [{ type: "text", text }],
                    }),
                })
              ),
          })
        );
      }),
    });
  }
});

/**
 * Registers an `effect/unstable/ai` `Toolkit` with the ambient `McpServer`,
 * wrapping every tool's dispatch in {@link withSanitizedToolSpan} so raw,
 * undecoded call parameters never reach span attributes.
 *
 * **When to use**
 *
 * Drop-in replacement for `McpServer.toolkit(toolkit)` wherever a host wants
 * its tool dispatch spans sanitized; same signature, same registration
 * semantics (McpTool wire shape, hint annotations, `CallToolResult` mapping),
 * only the dispatch wrapping differs.
 *
 * **Details**
 *
 * **Why this exists**
 *
 * Upstream `McpServer.toolkit` (`effect/unstable/ai/McpServer.ts:749-758`)
 * registers each tool's dispatch closure once, at layer-construction time,
 * with no seam for a consumer to wrap the closure's own later invocation.
 * Wrapping only the *outer* `Layer.launch(...)`/`server.callTool(...)` call
 * site does not help: the closure's `Effect.provideContext(services)`
 * restores whatever context was ambient at construction, and `services` does
 * not carry forward a build-time span/tracer override to later, separately
 * dispatched calls (verified empirically — a build-time-only wrap still
 * leaked `parameters`). Wrapping `built.handle(tool.name, payload)` *inside*
 * the stored `handle` closure — the only place proven, empirically, to
 * suppress the leak regardless of when or how the closure is later invoked
 * (matching the `12-observability.md` §3 fix this module exists for) —
 * requires mirroring `registerToolkit`'s per-tool registration loop, since
 * upstream offers no dispatch-wrapping hook.
 *
 * **Example** (Register sanitized toolkit)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { sanitizedToolkit } from "@beep/mcp-kit"
 * import { Tool, Toolkit } from "effect/unstable/ai"
 * import * as S from "effect/Schema"
 *
 * const ExampleTool = Tool.make("example_tool", { success: S.String })
 * const ExampleToolkit = Toolkit.make(ExampleTool)
 * const ExampleHandlersLive = ExampleToolkit.toLayer({ example_tool: () => Effect.succeed("ok") })
 *
 * const registered = sanitizedToolkit(ExampleToolkit).pipe(Layer.provide(ExampleHandlersLive))
 * console.log(registered)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const sanitizedToolkit = <Tools extends Record<string, AiTool.Any>>(
  toolkit: Toolkit.Toolkit<Tools>
): Layer.Layer<never, never, AiTool.HandlersFor<Tools> | Exclude<AiTool.HandlerServices<Tools>, McpServerClient>> =>
  Layer.effectDiscard(registerSanitizedToolkit(toolkit)).pipe(Layer.provide(McpServer.McpServer.layer));
