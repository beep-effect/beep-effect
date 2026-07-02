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

import { Effect, Layer } from "effect";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { CallToolResult, Tool as WireTool } from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as AiTool from "effect/unstable/ai/Tool";
import type * as Tracer from "effect/Tracer";
import type { McpServerClient } from "effect/unstable/ai/McpSchema";
import type * as Toolkit from "effect/unstable/ai/Toolkit";

/**
 * Span attribute keys suppressed by default: the raw, undecoded tool call
 * parameters set by upstream `Toolkit.ts:263-265`.
 *
 * @example
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
 * @example
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
export const sanitizeTracerAttributes = (
  tracer: Tracer.Tracer,
  sanitizedKeys: ReadonlyArray<string> = defaultSanitizedSpanKeys
): Tracer.Tracer => ({
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
        if (sanitizedKeys.includes(key)) {
          return;
        }
        span.attribute(key, value);
      },
      event: (name: string, startTime: bigint, attributes?: Record<string, unknown>) =>
        span.event(name, startTime, attributes),
      addLinks: (links) => span.addLinks(links),
    };
  },
});

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
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { withSanitizedToolSpan } from "@beep/mcp-kit"
 *
 * const program = withSanitizedToolSpan("mcp.tool.call", Effect.annotateCurrentSpan({ parameters: { secret: "x" } }))
 * Effect.runSync(program)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withSanitizedToolSpan = <A, E, R>(
  spanName: string,
  effect: Effect.Effect<A, E, R>,
  options?: { readonly sanitizedKeys?: ReadonlyArray<string> }
): Effect.Effect<A, E, R> =>
  Effect.flatMap(Effect.tracer, (tracer) =>
    Effect.withTracer(
      Effect.withSpan(effect, spanName),
      sanitizeTracerAttributes(tracer, options?.sanitizedKeys ?? defaultSanitizedSpanKeys)
    )
  );

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
  for (const tool of Object.values(built.tools) as ReadonlyArray<AiTool.Any>) {
    const annotations = tool.annotations;
    const toolMeta = Context.getOrUndefined(annotations, AiTool.Meta);
    const wireTool = WireTool.make({
      name: tool.name,
      description: AiTool.getDescription(tool),
      inputSchema: AiTool.getJsonSchema(tool),
      annotations: {
        ...Context.getOption(annotations, AiTool.Title).pipe(
          Option.map((title) => ({ title })),
          Option.getOrUndefined
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
      handle: (payload) =>
        withSanitizedToolSpan(`mcp.tool.call.${tool.name}`, built.handle(tool.name, payload)).pipe(
          Stream.unwrap,
          Stream.run(Sink.last()),
          Effect.flatMap(Effect.fromOption),
          Effect.provideContext(services),
          Effect.matchCause({
            onFailure: (cause) =>
              CallToolResult.make({ isError: true, content: [{ type: "text", text: Cause.pretty(cause) }] }),
            onSuccess: (result: { readonly encodedResult: unknown }) =>
              CallToolResult.make({
                isError: false,
                structuredContent:
                  typeof result.encodedResult === "object" && result.encodedResult !== null
                    ? (result.encodedResult as Record<string, unknown>)
                    : undefined,
                content: [{ type: "text", text: JSON.stringify(result.encodedResult) }],
              }),
          }),
          Effect.tapCause(Effect.log)
        ) as Effect.Effect<CallToolResult, never, McpServerClient>,
    });
  }
});

/**
 * Registers an `effect/unstable/ai` `Toolkit` with the ambient `McpServer`,
 * wrapping every tool's dispatch in {@link withSanitizedToolSpan} so raw,
 * undecoded call parameters never reach span attributes.
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
 * **When to use**
 *
 * Drop-in replacement for `McpServer.toolkit(toolkit)` wherever a host wants
 * its tool dispatch spans sanitized; same signature, same registration
 * semantics (McpTool wire shape, hint annotations, `CallToolResult` mapping),
 * only the dispatch wrapping differs.
 *
 * @example
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
