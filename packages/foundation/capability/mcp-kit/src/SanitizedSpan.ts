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
import { Cause, Context, Effect, Layer, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as ErrorReporter from "effect/ErrorReporter";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as AiError from "effect/unstable/ai/AiError";
import {
  CallToolResult,
  InvalidParams,
  McpRequestContext,
  McpServerClient,
  ToolJson,
  ToolOutputJson,
  Tool as WireTool,
} from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as AiTool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { translateApiKeyRequired } from "./ApiKeyRequired.ts";
import { CurrentMcpCaller, CurrentMcpDispatchAnchor, McpCallerIdentity } from "./McpCaller.ts";
import type * as JsonSchema from "effect/JsonSchema";
import type * as SchemaAST from "effect/SchemaAST";
import type * as Tracer from "effect/Tracer";

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

// The session header a stateful (pre-2026-07-28) transport mints at
// `initialize` and echoes on every later request of that session
// (`McpServer.ts` `mcpSessionIdHeader`, which upstream keeps private). The
// stateless runtime never issues it; the read stays for hosts still on a
// session-era adapter and is deleted with the last such host.
const mcpSessionIdHeader = "mcp-session-id";

const toolBoundaryFailureText = "Tool call failed before producing a structured result.";

const isJsonObject = (value: unknown): value is JsonObject => P.isObject(value) && !A.isArray(value);

const localDefsRefPrefix = "#/$defs/";

const decodeJsonPointerSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");

const localDefsRefKey = (ref: string): O.Option<string> =>
  ref.startsWith(localDefsRefPrefix)
    ? O.some(decodeJsonPointerSegment(ref.slice(localDefsRefPrefix.length)))
    : O.none();

// rc.117 encodes a no-argument tool's params as the non-null wildcard
// `{ not: { type: "null" } }`, which admits objects but carries no `type`;
// a parameter class with no fields may also render as `anyOf: [object, array]`.
// `McpSchema.ToolJson` requires a top-level `type: "object"`, and upstream
// `registerToolkit` dies on that decode, so the object branch is recognized
// and the root type added here (measured against the installed rc.117,
// 2026-09-22, after upstream's own top-level `$ref` inlining).
const isNonNullWildcard = (target: JsonObject): boolean =>
  !("type" in target) && isJsonObject(target.not) && target.not.type === "null";

const isObjectInputTarget = (target: JsonObject): boolean =>
  isNonNullWildcard(target) ||
  (A.isArray(target.anyOf) && target.anyOf.some((branch) => isJsonObject(branch) && branch.type === "object"));

const withTopLevelObjectInputSchema = (schema: JsonObject): JsonObject =>
  schema.type === "object" || !isObjectInputTarget(schema) ? schema : { type: "object", ...schema };

/**
 * Test-only handle for the wire input-schema patch helper.
 *
 * **Example** (Patch a wildcard input schema)
 *
 * ```ts
 * import { withTopLevelObjectInputSchemaForTesting } from "@beep/mcp-kit/SanitizedSpan"
 *
 * const patched = withTopLevelObjectInputSchemaForTesting({ not: { type: "null" } })
 * console.log(patched.type) // "object"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const withTopLevelObjectInputSchemaForTesting = withTopLevelObjectInputSchema;

// Mirrors rc.117 `McpServer.ts` `toolJsonSchema`: MCP requires an object
// root, so a top-level `$ref` is inlined from the document's definitions
// (`internal/structured-output.ts` `resolveTopLevelReference`).
const inlineTopLevelReference = (
  document: JsonSchema.Document<"draft-2020-12">
): JsonSchema.Document<"draft-2020-12"> => {
  const ref = document.schema.$ref;
  if (!P.isString(ref)) {
    return document;
  }
  return O.match(
    O.flatMap(localDefsRefKey(ref), (key) => R.get(document.definitions, key)),
    {
      onNone: () => document,
      onSome: (schema) => ({ ...document, schema }),
    }
  );
};

const toolJsonSchema = (schema: S.Constraint, strict: boolean): JsonObject => {
  const document = inlineTopLevelReference(
    S.toJsonSchemaDocument(schema, { onExcessProperty: strict ? "error" : "ignore" })
  );
  return R.isEmptyRecord(document.definitions) ? document.schema : { ...document.schema, $defs: document.definitions };
};

// Request services must come from the invocation, including when a handler
// is registered during a request (rc.117 `McpServer.ts` `omitRequestServices`).
// The dispatch anchor joins the list so a value app composition provides per
// request is never shadowed by one captured at layer build.
const omitRequestServices = Context.omit(
  McpRequestContext,
  McpServerClient,
  HttpServerRequest.HttpServerRequest,
  References.CurrentLogLevel,
  CurrentMcpDispatchAnchor
);

const decodeToolJson = S.decodeUnknownEffect(ToolJson);
const decodeToolOutputJson = S.decodeUnknownEffect(ToolOutputJson);

const isParameterValidationError = (
  error: unknown
): error is AiError.AiError & { readonly reason: AiError.ToolParameterValidationError } =>
  AiError.isAiError(error) && error.reason._tag === "ToolParameterValidationError";

const boundaryFailureResult = CallToolResult.make({
  isError: true,
  content: [{ type: "text", text: toolBoundaryFailureText }],
});

// Dual-read of the caller: `McpRequestContext` is present on every rc.117
// dispatch (stateless and legacy); `McpServerClient` only on an initialized
// legacy session. The session header is a stateful-transport fact, so it is
// read only when such a client exists; a stateless dispatch always reports
// `sessionId: None`, whatever headers the POST carried.
const readCaller = (
  requestContext: O.Option<McpRequestContext["Service"]>,
  client: O.Option<McpServerClient["Service"]>,
  httpRequest: O.Option<HttpServerRequest.HttpServerRequest>
): O.Option<McpCallerIdentity> => {
  const clientId = O.orElse(
    O.map(requestContext, (context) => context.clientId),
    () => O.map(client, (current) => current.clientId)
  );
  const sessionId = O.isSome(client)
    ? O.flatMap(httpRequest, (request) => O.filter(Headers.get(request.headers, mcpSessionIdHeader), Str.isNonEmpty))
    : O.none<string>();
  return O.map(clientId, (id) => McpCallerIdentity.make({ clientId: NonNegativeInt.make(id), sessionId }));
};

// What a handler can fail with: a declared failure (a tagged schema class or
// an `Error`), or upstream's `AiError` for parameter validation. The
// classifier below narrows with guards, so no wider channel is needed.
type ToolHandlerError = Error | AiError.AiError | { readonly _tag: string };

type ToolHandlerResult = {
  readonly isFailure: boolean;
  readonly failureOrigin?: AiTool.FailureOrigin | undefined;
  readonly result: unknown;
  readonly encodedResult: unknown;
};

const textContent = (encoded: unknown): CallToolResult["content"] =>
  encoded === undefined ? [] : [{ type: "text", text: JSON.stringify(encoded) }];

// Declared failures return their encoded payload; anything else is classified
// by origin in `classifyToolFailure`. The `api_key_required` envelope is the
// one declared failure translated to a non-error.
const projectToolResult = (result: ToolHandlerResult): Effect.Effect<CallToolResult, ToolHandlerError> =>
  result.isFailure && result.failureOrigin !== "handler"
    ? Effect.failCause(
        Cause.annotate(
          Cause.fail(result.result as ToolHandlerError),
          Context.make(Toolkit.FailureOrigin, result.failureOrigin ?? "result")
        )
      )
    : Effect.succeed(
        O.getOrElse(translateApiKeyRequired(result), () =>
          CallToolResult.make({
            isError: result.isFailure,
            ...(result.isFailure || !isJsonObject(result.encodedResult)
              ? {}
              : { structuredContent: result.encodedResult }),
            content: textContent(result.encodedResult),
          })
        )
      );

// Interruption propagates; anything else is logged, reported and scrubbed to
// the boundary text so schema stacks and local paths never reach the wire.
const makeInternalToolError =
  (services: Context.Context<never>) =>
  (cause: Cause.Cause<unknown>): Effect.Effect<CallToolResult, never> => {
    const failure = Cause.findFail(cause);
    return Result.isFailure(failure) && !Cause.hasDies(cause)
      ? Effect.failCause(failure.failure)
      : Effect.logError(cause).pipe(
          Effect.andThen(Effect.provideContext(ErrorReporter.report(cause), services)),
          Effect.as(boundaryFailureResult)
        );
  };

// Upstream classification (rc.117 `registerToolkit` `handleCause`):
// parameter-origin validation errors are JSON-RPC `InvalidParams`,
// handler-origin declared failures are tool errors, the rest is internal.
const makeToolFailureClassifier = <Tools extends Record<string, AiTool.Any>>(
  tool: AiTool.Any,
  internalToolError: (cause: Cause.Cause<unknown>) => Effect.Effect<CallToolResult, never>
) => {
  const isDeclaredFailure = S.is(tool.failureSchema);
  const encodeFailure = S.encodeUnknownEffect(tool.failureSchema) as (
    error: unknown
  ) => Effect.Effect<unknown, S.SchemaError, AiTool.HandlerServices<Tools[keyof Tools]>>;
  const declaredFailureResult = (error: unknown) =>
    error instanceof Error
      ? Effect.succeed(CallToolResult.make({ isError: true, content: [{ type: "text", text: error.message }] }))
      : Effect.map(encodeFailure(error), (encoded) =>
          CallToolResult.make({ isError: true, content: textContent(encoded) })
        );
  return (cause: Cause.Cause<unknown>) => {
    const failure = Cause.findFail(cause);
    if (Result.isFailure(failure)) {
      return internalToolError(cause);
    }
    const error = failure.success.error;
    const origin = Context.get(Cause.reasonAnnotations(failure.success), Toolkit.FailureOrigin);
    if (origin === "parameters" && isParameterValidationError(error)) {
      return Effect.fail(InvalidParams.make({ message: error.reason.message }));
    }
    return origin === "handler" && isDeclaredFailure(error)
      ? Effect.catchCause(declaredFailureResult(error), internalToolError)
      : internalToolError(cause);
  };
};

// Wire schemas mirror rc.117: strict tools reject excess properties, dynamic
// tools carry their raw JSON Schema, and the no-argument root patch applies
// after upstream's top-level `$ref` inlining.
const wireToolSchemas = Effect.fnUntraced(function* (tool: AiTool.Any) {
  const strict = AiTool.getStrictMode(tool) === true;
  const rawJsonSchema = AiTool.isDynamic(tool) ? tool.jsonSchema : undefined;
  if (strict && rawJsonSchema !== undefined) {
    return yield* Effect.die(
      `sanitizedToolkit cannot strictly validate the raw JSON Schema for tool '${tool.name}'; use an Effect Schema instead`
    );
  }
  const outputSchema = yield* decodeToolOutputJson(toolJsonSchema(tool.successSchema, false)).pipe(Effect.orDie);
  const inputSchema = yield* decodeToolJson(
    withTopLevelObjectInputSchema(rawJsonSchema ?? toolJsonSchema(tool.parametersSchema, strict))
  ).pipe(Effect.orDie);
  const decodeOptions: SchemaAST.ParseOptions | undefined = strict ? { onExcessProperty: "error" } : undefined;
  return { inputSchema, outputSchema, decodeOptions };
});

const wireToolFor = (
  tool: AiTool.Any,
  schemas: { readonly inputSchema: ToolJson; readonly outputSchema: ToolOutputJson }
) => {
  const annotations = tool.annotations;
  const toolMeta = Context.getOrUndefined(annotations, AiTool.Meta);
  const description = AiTool.getDescription(tool);
  return WireTool.make({
    name: tool.name,
    // Optional wire fields decode as absent-or-valued, never as an explicit
    // undefined, so they are spread in conditionally.
    ...(description === undefined ? {} : { description }),
    inputSchema: schemas.inputSchema,
    outputSchema: schemas.outputSchema,
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
    ...(toolMeta === undefined ? {} : { _meta: toolMeta }),
  });
};

// Read the caller at the request boundary, not inside the handler:
// `provideContext` below *merges* (provided services win on key collisions and
// request-only services survive), so reading once here keeps the caller
// identity a fact of the dispatch instead of something each handler rediscovers.
const readRequestCaller = Effect.gen(function* () {
  const requestContext = yield* Effect.serviceOption(McpRequestContext);
  const client = yield* Effect.serviceOption(McpServerClient);
  const httpRequest = yield* Effect.serviceOption(HttpServerRequest.HttpServerRequest);
  return readCaller(requestContext, client, httpRequest);
});

const registerSanitizedToolkit = Effect.fnUntraced(function* <Tools extends Record<string, AiTool.Any>>(
  toolkit: Toolkit.Toolkit<Tools>
) {
  const registry = yield* McpServer.McpServer;
  const built = yield* (
    toolkit as unknown as Effect.Effect<
      Toolkit.WithHandler<Tools>,
      never,
      Exclude<AiTool.HandlersFor<Tools>, McpRequestContext>
    >
  ).pipe(
    Effect.updateContext((context: Context.Context<Exclude<AiTool.HandlersFor<Tools>, McpRequestContext>>) => {
      // Toolkit handlers also retain the context in which their layer was built.
      const handlerServices = new Map(context.mapUnsafe);
      for (const tool of R.values<string, AiTool.Any>(toolkit.tools)) {
        const handler = handlerServices.get(tool.id) as AiTool.Handler<string> | undefined;
        if (handler !== undefined) {
          handlerServices.set(tool.id, { ...handler, context: omitRequestServices(handler.context) });
        }
      }
      return Context.makeUnsafe(handlerServices);
    })
  );
  const services = omitRequestServices(yield* Effect.context<never>());
  const internalToolError = makeInternalToolError(services);
  for (const tool of R.values<string, AiTool.Any>(built.tools)) {
    const schemas = yield* wireToolSchemas(tool);
    const classifyToolFailure = makeToolFailureClassifier<Tools>(tool, internalToolError);
    yield* registry.addTool({
      tool: wireToolFor(tool, schemas),
      annotations: tool.annotations,
      // Contextually typed from `addTool`'s own `handle: (payload: any) => ...`
      // parameter position (mirrors rc.117 McpServer.registerToolkit); dispatch
      // is looked up by tool name at runtime, so no narrower parameter type is
      // available here.
      handle: Effect.fn("McpKit.handle")(function* (payload) {
        const requestServices = Context.add(services, CurrentMcpCaller, yield* readRequestCaller) as Context.Context<
          AiTool.HandlerServices<Tools[keyof Tools]>
        >;
        return yield* withSanitizedToolSpan(
          built.handle(tool.name as keyof Tools, payload ?? {}, undefined, schemas.decodeOptions),
          `mcp.tool.call.${tool.name}`
        ).pipe(
          Stream.unwrap,
          Stream.runLast,
          Effect.flatMap(Effect.fromOption),
          Effect.flatMap(projectToolResult),
          Effect.catchCause(classifyToolFailure),
          Effect.provideContext(requestServices)
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
 * semantics (wire tool shape with `inputSchema`/`outputSchema`, hint
 * annotations, strict decode, upstream failure classification), with the
 * exclusions listed below.
 *
 * **Details**
 *
 * **What differs from rc.117 `McpServer.registerToolkit`**
 *
 * 1. Every dispatch runs under {@link withSanitizedToolSpan} — upstream
 *    offers no dispatch-wrapping seam, so the per-tool registration loop is
 *    mirrored here (wrapping the outer `callTool` site does not reach the
 *    stored closure).
 * 2. The dispatch provides `CurrentMcpCaller`, dual-read from
 *    `McpRequestContext` (every rc.117 dispatch) or `McpServerClient`
 *    (initialized legacy sessions only); a stateless dispatch yields
 *    `sessionId: None`.
 * 3. A no-argument tool's `inputSchema` gains its top-level `type: "object"`
 *    (rc.117 still renders an empty parameter class as a non-null wildcard,
 *    which `McpSchema.ToolJson` rejects).
 * 4. The `api_key_required` envelope is projected as a non-error result by
 *    `translateApiKeyRequired`; every other failure follows upstream
 *    (declared failures are tool errors, invalid arguments are `InvalidParams`).
 * 5. Internal failures are scrubbed to a fixed boundary text.
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
): Layer.Layer<never, never, AiTool.HandlersFor<Tools> | Exclude<AiTool.HandlerServices<Tools>, McpRequestContext>> =>
  Layer.effectDiscard(registerSanitizedToolkit(toolkit)).pipe(Layer.provide(McpServer.McpServer.layer));
